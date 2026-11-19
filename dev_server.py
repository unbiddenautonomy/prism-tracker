#!/usr/bin/env python3
"""Local test server for the Prism app. Uses only Python's built-in library.

    python3 dev_server.py            open http://localhost:8080 on this Mac
    python3 dev_server.py --lan      also open it from phones on the same Wi-Fi

It also runs a pretend Google Sheet at /mock-sheet so syncing can be tested
before the real Google Sheet is set up (in the app: Settings -> "Use the test
sheet on this computer"). See what it received at /mock-sheet/view.
"""
import argparse
import datetime
import html
import json
import os
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "app")
DATA_DIR = os.path.join(ROOT, "dev-data")
DB_PATH = os.path.join(DATA_DIR, "mock-sheet.json")
MOCK_CONFIG_PATH = os.path.join(DATA_DIR, "mock-config.json")
TEST_KEY = "test-key"

LOCK = threading.Lock()
STATE = {"offline": False}


def now_text():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M")


def load_db():
    try:
        with open(DB_PATH, encoding="utf-8") as f:
            db = json.load(f)
    except (OSError, ValueError):
        db = {}
    db.setdefault("entries", {})
    db.setdefault("phones", {})
    db.setdefault("lowStock", {})
    return db


def save_db(db):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = DB_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DB_PATH)


def raw_config():
    """The pretend sheet's own tabs. Starts as app/config.json; once the admin app
    changes a recipe it is kept in dev-data/mock-config.json."""
    path = MOCK_CONFIG_PATH if os.path.exists(MOCK_CONFIG_PATH) else os.path.join(APP_DIR, "config.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_raw_config(cfg):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = MOCK_CONFIG_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=1)
    os.replace(tmp, MOCK_CONFIG_PATH)


def sheet_config(db=None):
    """What the real sheet would return from its Materials/Recipes/Workers tabs."""
    cfg = raw_config()
    keep = ("appName", "ownerPin", "categoryColors", "materials", "products", "workers", "warnings")
    out = {k: cfg[k] for k in keep if k in cfg}
    low = (db or load_db()).get("lowStock", {})
    for m in out.get("materials", []):
        m["lowStock"] = low.get(m.get("code"), 0)
    return out


def r3(v):
    return round(float(v or 0) * 1000) / 1000


def compute_stock(entries, cfg, date):
    """Same rules as computeStock() in app/js/report.js: counted from each
    material's first stock entry; left = added - removed - used - wasted."""
    key = lambda e: str(e.get("date", "")) + " " + (str(e.get("time") or "") or "00:00")
    live = [e for e in entries if e.get("status") != "deleted" and len(str(e.get("date", ""))) == 10 and str(e.get("date")) <= date]
    start = {}
    for e in live:
        if e.get("type") == "stock":
            for l in e.get("lines") or []:
                code = l.get("material")
                if code and (code not in start or key(e) < start[code]):
                    start[code] = key(e)
    rows, order = {}, []

    def row(code, unit, low):
        if code not in rows:
            rows[code] = {"code": code, "unit": unit or "", "color": "", "lowStock": r3(low), "tracked": False, "since": "",
                          "added": 0, "removed": 0, "used": 0, "wasted": 0, "left": 0, "low": False,
                          "day": {"added": 0, "removed": 0, "used": 0, "wasted": 0}}
            order.append(code)
        return rows[code]

    for m in cfg.get("materials", []):
        row(m["code"], m.get("unit", "kg"), m.get("lowStock") or 0)
    for e in live:
        t = e.get("type")
        field = ("removed" if e.get("move") == "out" else "added") if t == "stock" else {"production": "used", "waste": "wasted"}.get(t)
        if t == "waste" and not e.get("material") and e.get("madeBefore") is True:
            continue  # spoiled batch already recorded as made
        if not field:
            continue
        for l in e.get("lines") or []:
            code = l.get("material")
            if not code or code not in start or key(e) < start[code]:
                continue
            r = row(code, l.get("unit"), 0)
            r[field] = r3(r[field] + r3(l.get("qty")))
            if e.get("date") == date:
                r["day"][field] = r3(r["day"][field] + r3(l.get("qty")))
    for code in order:
        r = rows[code]
        r["tracked"] = code in start
        r["since"] = start[code][:10] if r["tracked"] else ""
        r["left"] = r3(r["added"] - r["removed"] - r["used"] - r["wasted"])
        r["low"] = r["tracked"] and r["lowStock"] > 0 and r["left"] < r["lowStock"]
    return [rows[c] for c in order]


def handle_mock(req):
    if req.get("key") != TEST_KEY:
        return {"ok": False, "error": "bad-key"}
    action = req.get("action")
    if action == "ping":
        return {"ok": True, "sheetName": "Test sheet on this computer", "products": len(sheet_config().get("products", []))}
    if action == "sync":
        saved = []
        with LOCK:
            db = load_db()
            for e in req.get("entries") or []:
                eid = e.get("id")
                if not eid:
                    continue
                old = db["entries"].get(eid)
                if old is None or str(e.get("updatedAt", "")) >= str(old.get("updatedAt", "")):
                    db["entries"][eid] = e
                saved.append(eid)
            phone = req.get("phone")
            if phone:
                db["phones"][phone] = {"phone": phone, "lastSync": now_text(), "worker": req.get("worker", ""), "appVersion": req.get("appVersion", "")}
            save_db(db)
        return {"ok": True, "saved": saved, "config": sheet_config(db), "serverTime": datetime.datetime.utcnow().isoformat() + "Z"}
    if action == "report":
        day = str(req.get("day") or datetime.date.today().isoformat())
        month = day[:7]
        db = load_db()
        cfg = sheet_config(db)
        entries = [e for e in db["entries"].values() if str(e.get("date", "")).startswith(month)]
        stock = compute_stock(list(db["entries"].values()), cfg, day)
        return {"ok": True, "entries": entries, "phones": list(db["phones"].values()), "config": cfg, "stock": stock, "today": datetime.date.today().isoformat()}
    if action == "stock":
        db = load_db()
        cfg = sheet_config(db)
        today = datetime.date.today().isoformat()
        return {"ok": True, "stock": compute_stock(list(db["entries"].values()), cfg, today), "config": cfg, "today": today}
    if action == "setLowStock":
        code = str(req.get("material") or "")
        value = req.get("value")
        try:
            value = 0 if value in ("", None) else float(value)
        except (TypeError, ValueError):
            return {"ok": False, "error": "bad-number"}
        if value < 0:
            return {"ok": False, "error": "bad-number"}
        with LOCK:
            db = load_db()
            if code not in [m.get("code") for m in sheet_config(db).get("materials", [])]:
                return {"ok": False, "error": "unknown-material"}
            if value:
                db["lowStock"][code] = value
            else:
                db["lowStock"].pop(code, None)
            save_db(db)
        cfg = sheet_config(db)
        today = datetime.date.today().isoformat()
        return {"ok": True, "config": cfg, "stock": compute_stock(list(db["entries"].values()), cfg, today), "today": today}
    if action == "saveProduct":
        name = str(req.get("name") or "").strip()
        if not name:
            return {"ok": False, "error": "no-name"}
        recipe = {}
        for code, value in (req.get("recipe") or {}).items():
            try:
                v = float(value)
            except (TypeError, ValueError):
                return {"ok": False, "error": "bad-amount"}
            if v < 0:
                return {"ok": False, "error": "bad-amount"}
            if v > 0:
                recipe[code] = v
        if not recipe:
            return {"ok": False, "error": "no-amounts"}
        with LOCK:
            cfg = raw_config()
            products = cfg.setdefault("products", [])
            found = next((p for p in products if str(p.get("name", "")).lower() == name.lower()), None)
            row = found if found is not None else {"color": ""}
            row.update({
                "name": name,
                "name_hi": req.get("name_hi", ""),
                "batchNote": req.get("batchNote", ""),
                "batchNote_hi": req.get("batchNote_hi", ""),
                "category": req.get("category", ""),
                "recipe": recipe,
            })
            if found is None:
                products.append(row)
            save_raw_config(cfg)
            db = load_db()
        return {"ok": True, "created": found is None, "config": sheet_config(db)}
    if action == "deleteProduct":
        name = str(req.get("name") or "").strip()
        with LOCK:
            cfg = raw_config()
            kept = [p for p in cfg.get("products", []) if str(p.get("name", "")).lower() != name.lower()]
            if len(kept) == len(cfg.get("products", [])):
                return {"ok": False, "error": "unknown-product"}
            cfg["products"] = kept
            save_raw_config(cfg)
            db = load_db()
        return {"ok": True, "config": sheet_config(db)}
    return {"ok": False, "error": "unknown-action"}


def view_page():
    db = load_db()
    rows = sorted(db["entries"].values(), key=lambda e: (e.get("date", ""), e.get("time", "")), reverse=True)
    esc = lambda v: html.escape("" if v is None else str(v))

    def lines(e):
        return ", ".join("%s %s %s" % (l.get("material"), l.get("qty"), l.get("unit", "")) for l in e.get("lines") or [])

    trs = "".join(
        "<tr class='%s'><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
        % (
            "del" if e.get("status") == "deleted" else "",
            esc(e.get("date")), esc(e.get("time")), esc(e.get("type")), esc(e.get("product")), esc(e.get("batches")),
            esc(e.get("material")), esc(e.get("qty")), esc(e.get("reason")), esc(lines(e)),
            esc(e.get("worker")) + " / " + esc(e.get("phone")), esc((e.get("status") or "").upper()),
        )
        for e in rows
    )
    phones = "".join(
        "<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % (esc(p.get("phone")), esc(p.get("lastSync")), esc(p.get("worker")))
        for p in db["phones"].values()
    )
    stock = compute_stock(list(db["entries"].values()), sheet_config(db), datetime.date.today().isoformat())
    stock_rows = "".join(
        "<tr class='%s'><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
        % ("low" if r["low"] else "", esc(r["code"]), esc(r["since"] or "not counted yet"), esc(r["added"]), esc(r["removed"]),
           esc(r["used"]), esc(r["wasted"]), esc(r["left"] if r["tracked"] else ""), esc(r["lowStock"] or ""))
        for r in stock
    )
    status = "OFF (phones can't reach it)" if STATE["offline"] else "ON"
    return """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test sheet</title><style>
body{font-family:system-ui,sans-serif;margin:16px;color:#0f172a;background:#fff}
table{border-collapse:collapse;width:100%%;font-size:14px;margin-bottom:24px}
th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top}
th{background:#f1f5f9} tr.low td{background:#fef2f2;color:#b91c1c} tr.del td{color:#94a3b8;text-decoration:line-through}
form{display:inline-block;margin-right:8px} button{font-size:15px;padding:8px 12px;border-radius:8px;border:1px solid #94a3b8;background:#f8fafc;cursor:pointer}
.box{padding:10px 12px;border-radius:8px;background:#f1f5f9;margin-bottom:14px}
</style></head><body>
<h1>Pretend Google Sheet</h1>
<div class="box">Internet for phones: <b>%s</b> &nbsp;
<form method="post" action="/mock-sheet/admin"><input type="hidden" name="do" value="toggle"><button>Switch %s</button></form>
<form method="post" action="/mock-sheet/admin" onsubmit="return confirm('Clear all test data?')"><input type="hidden" name="do" value="clear"><button>Clear test data</button></form>
<a href="/mock-sheet/view">Refresh</a></div>
<h2>Entries (%d)</h2>
<table><tr><th>Date</th><th>Time</th><th>Type</th><th>Product</th><th>Batches</th><th>Material</th><th>Qty</th><th>Reason</th><th>Raw material</th><th>Worker / Phone</th><th>Status</th></tr>%s</table>
<h2>Stock</h2>
<table><tr><th>Material</th><th>Counted since</th><th>Added</th><th>Removed</th><th>Used</th><th>Wasted</th><th>Left</th><th>Alert below</th></tr>%s</table>
<h2>Phones</h2><table><tr><th>Phone</th><th>Last sync</th><th>Worker</th></tr>%s</table>
</body></html>""" % (status, "on" if STATE["offline"] else "off", len(rows), trs, stock_rows, phones)


class Handler(SimpleHTTPRequestHandler):
    extensions_map = dict(
        SimpleHTTPRequestHandler.extensions_map,
        **{".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".png": "image/png"}
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "/mock-sheet" in (self.path or ""):
            super().log_message(fmt, *args)

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, text):
        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/admin":  # clean address, same as Cloudflare
            self.path = "/admin.html" + self.path[len("/admin"):]
        if path.startswith("/mock-sheet/view"):
            return self.send_html(view_page())
        if path == "/mock-sheet":
            return self.send_json({"ok": True, "app": "Prism test sheet", "note": "Phones talk to this link with POST."})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""
        if path == "/mock-sheet/admin":
            form = body.decode("utf-8")
            if "do=toggle" in form:
                STATE["offline"] = not STATE["offline"]
            elif "do=clear" in form:
                with LOCK:
                    save_db({"entries": {}, "phones": {}, "lowStock": {}})
            self.send_response(303)
            self.send_header("Location", "/mock-sheet/view")
            self.end_headers()
            return
        if path != "/mock-sheet":
            return self.send_error(404)
        if STATE["offline"]:
            return self.send_error(503, "Pretending the internet is off")
        try:
            req = json.loads(body.decode("utf-8") or "{}")
        except ValueError:
            return self.send_json({"ok": False, "error": "bad-json"})
        self.send_json(handle_mock(req))


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packet is sent; this just picks the Wi-Fi address
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    ap = argparse.ArgumentParser(description="Prism local test server")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--lan", action="store_true", help="also allow phones on the same Wi-Fi")
    args = ap.parse_args()
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    server = ThreadingHTTPServer((host, args.port), Handler)
    print("Prism test server is running.")
    print("  App on this Mac:   http://localhost:%d" % args.port)
    print("  Pretend sheet:     http://localhost:%d/mock-sheet/view" % args.port)
    if args.lan:
        ip = lan_ip()
        if ip:
            print("  On a phone (same Wi-Fi): http://%s:%d" % (ip, args.port))
    print("Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
