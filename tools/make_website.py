#!/usr/bin/env python3
"""Builds the website copy of the app for Cloudflare Pages.

    python3 tools/make_website.py

Makes:
  site/                 the files to upload
  prism-website.zip     the same files zipped (Cloudflare accepts the zip)

Safety: every file on a website can be downloaded by anyone who has the link.
So the website copy of config.json NEVER has the recipes, the worker names or
the secret key, and there is no switch to put them there. Phones receive all
three from the Google Sheet once the key is entered in Settings, and the admin
app's Recipes screen is where products are added and changed.
"""
import json
import os
import shutil
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
  X-Robots-Tag: noindex, nofollow
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
    if os.path.exists(SITE):
        shutil.rmtree(SITE)
    shutil.copytree(APP, SITE, ignore=shutil.ignore_patterns(".DS_Store", "*.tmp"))

    # 1. config.json without recipes or keys
    path = os.path.join(SITE, "config.json")
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    safe = {
        "_help": "Website copy. The recipes, the worker names and the Sheet key are NOT here on purpose: anyone with the link can download this file. Phones receive all three from the Google Sheet once the key is entered in Settings.",
        "appName": cfg.get("appName", "Prism"),
        "ownerPin": cfg.get("ownerPin", "1234"),
        "sheet": {"url": "", "key": ""},
        "categoryColors": cfg.get("categoryColors", {}),
        # Raw material codes only: they are on the phones' own screens anyway.
        "materials": cfg.get("materials", []),
        # Never published. Products come from the Sheet, and the admin app's
        # Recipes screen is where they are added and changed.
        "products": [],
        "workers": [],
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
    # The link is meant to be shared with the phones, not found in a search.
    with open(os.path.join(SITE, "robots.txt"), "w", encoding="utf-8") as f:
        f.write("User-agent: *\nDisallow: /\n")

    # 4. final safety check
    with open(path, encoding="utf-8") as f:
        check = json.load(f)
    assert not check["products"], "recipes must not be on the website"
    assert not check["workers"], "worker names must not be on the website"
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
    print("Not included, and cannot be: recipes, worker names, secret key.")


if __name__ == "__main__":
    main()
