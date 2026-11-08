#!/usr/bin/env python3
"""Builds the website copy of the app for Cloudflare Pages.

    python3 tools/make_website.py          normal: no recipes on the website
    python3 tools/make_website.py --demo   demo: includes the products from
                                           app/config.json (samples only!)

Makes:
  site/                 the files to upload
  prism-website.zip     the same files zipped (Cloudflare accepts the zip)

Safety: every file on a website can be downloaded by anyone who has the link,
so the website copy of config.json has NO recipes and NO secret key.
Phones get the recipes from the Google Sheet after the key is entered once
in Settings.
"""
import json
import os
import shutil
import sys
import time
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
SITE = os.path.join(ROOT, "site")
ZIP = os.path.join(ROOT, "prism-website.zip")

HEADERS = """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://script.google.com https://script.googleusercontent.com; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'

/sw.js
  Cache-Control: no-cache

/*.html
  Cache-Control: no-cache

/config.json
  Cache-Control: no-cache
"""


def main():
    demo = "--demo" in sys.argv[1:]
    if os.path.exists(SITE):
        shutil.rmtree(SITE)
    shutil.copytree(APP, SITE, ignore=shutil.ignore_patterns(".DS_Store", "*.tmp"))

    # 1. config.json without recipes or keys
    path = os.path.join(SITE, "config.json")
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    safe = {
        "_help": ("DEMO website copy: contains SAMPLE recipes only. The Sheet key is never here." if demo else
                  "Website copy. Recipes and the Sheet key are NOT here on purpose: phones receive recipes from the Google Sheet after the key is entered once in Settings."),
        "appName": cfg.get("appName", "Prism"),
        "ownerPin": cfg.get("ownerPin", "1234"),
        "sheet": {"url": "", "key": ""},
        "categoryColors": cfg.get("categoryColors", {}),
        "materials": cfg.get("materials", []),
        # Demo builds show the sample products so the app can be shown without the Sheet.
        "products": cfg.get("products", []) if demo else [],
        "workers": cfg.get("workers", []),
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(safe, f, ensure_ascii=False, indent=2)

    # 2. new offline-cache version for every upload
    sw = os.path.join(SITE, "sw.js")
    with open(sw, encoding="utf-8") as f:
        text = f.read()
    version = "prism-" + time.strftime("%Y%m%d-%H%M%S")
    assert "const VERSION = 'prism-dev';" in text
    with open(sw, "w", encoding="utf-8") as f:
        f.write(text.replace("const VERSION = 'prism-dev';", "const VERSION = '%s';" % version))

    # 3. security + caching rules for Cloudflare
    with open(os.path.join(SITE, "_headers"), "w", encoding="utf-8") as f:
        f.write(HEADERS)

    # 4. final safety check
    with open(path, encoding="utf-8") as f:
        check = json.load(f)
    assert demo or not check["products"], "recipes must not be on the website"
    assert not check["sheet"]["key"], "the secret key must not be on the website"

    # 5. zip
    if os.path.exists(ZIP):
        os.remove(ZIP)
    count = 0
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _dirs, files in os.walk(SITE):
            for name in sorted(files):
                full = os.path.join(base, name)
                z.write(full, os.path.relpath(full, SITE))
                count += 1
    size_kb = os.path.getsize(ZIP) // 1024
    print("Website ready: site/ (%d files), prism-website.zip (%d KB), version %s" % (count, size_kb, version))
    if demo:
        print("DEMO build: the %d sample products ARE included: %s" % (len(check["products"]), ", ".join(p["name"] for p in check["products"])))
        print("Once real recipes go in, build again WITHOUT --demo.")
    else:
        print("Recipes: not included.")
    print("Secret key: not included.")


if __name__ == "__main__":
    main()
