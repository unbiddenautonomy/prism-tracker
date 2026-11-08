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
    return db


def save_db(db):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = DB_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DB_PATH)


def sheet_config():
    """What the real sheet would return from its Materials/Recipes/Workers tabs.
    Put a dev-data/mock-config.json next to test "recipes changed in the sheet"."""
    path = MOCK_CONFIG_PATH if os.path.exists(MOCK_CONFIG_PATH) else os.path.join(APP_DIR, "config.json")
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    keep = ("appName", "ownerPin", "categoryColors", "materials", "products", "workers", "warnings")
    return {k: cfg[k] for k in keep if k in cfg}


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
        return {"ok": True, "saved": saved, "config": sheet_config(), "serverTime": datetime.datetime.utcnow().isoformat() + "Z"}
    if action == "report":
        day = str(req.get("day") or datetime.date.today().isoformat())
        month = day[:7]
        db = load_db()
        entries = [e for e in db["entries"].values() if str(e.get("date", "")).startswith(month)]
        return {"ok": True, "entries": entries, "phones": list(db["phones"].values()), "config": sheet_config()}
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
    status = "OFF (phones can't reach it)" if STATE["offline"] else "ON"
    return """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test sheet</title><style>
body{font-family:system-ui,sans-serif;margin:16px;color:#0f172a;background:#fff}
table{border-collapse:collapse;width:100%%;font-size:14px;margin-bottom:24px}
th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top}
th{background:#f1f5f9} tr.del td{color:#94a3b8;text-decoration:line-through}
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
<h2>Phones</h2><table><tr><th>Phone</th><th>Last sync</th><th>Worker</th></tr>%s</table>
</body></html>""" % (status, "on" if STATE["offline"] else "off", len(rows), trs, phones)


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
                    save_db({"entries": {}, "phones": {}})
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
