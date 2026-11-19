# Prism production tracker

A simple phone app for the factory floor that records two things:

- **Batches made**: pick a product and the number of batches. The app works out the raw materials used from the recipe.
- **Waste / Spill**: what was lost (a raw material or a spoiled batch), how much, and why.

The **Prism Admin** app also keeps **raw material stock**: the admin adds deliveries and removals, the app subtracts what batches used and what was wasted, and warns (in the app and by email) when a material falls below its alert level.

Entries are saved on the phone first, so the app works without internet. They're sent to a **Google Sheet** that acts as the shared database. Google sends you a **daily email** with today's and this month's totals from every phone. Screens are in **English and Hindi**.

## Try it on this Mac (nothing to install)

Open **Terminal** in this folder and run:

```bash
python3 dev_server.py
```

Then open **http://localhost:8080** in Chrome or Safari. Press **Ctrl+C** in Terminal to stop.

- **Phone-sized view:** in Chrome, press ⌥⌘I, then click the phone icon. Or test on a real phone, below.
- **Test syncing without Google:** in the app, go to **⚙ Settings** (PIN `1234`) → **Use the test sheet on this computer**.
  - See what arrived at **http://localhost:8080/mock-sheet/view**.
  - That page has a button to pretend the internet is off, so you can watch entries wait on the phone and then send.
- **Try a second "phone":** open the app in another browser, or a private window. Give it a different phone name in Settings.

### Desktop shortcuts

`PrismAPP` and `PrismAdmin` on the Desktop start the server if it isn't running, then open Chrome:

- **PrismAPP:** the worker app, in a phone-sized window.
- **PrismAdmin:** straight to the Reports dashboard.

Both use the same data in Chrome. When the Google Sheet is connected (⚙ Settings, or `config.json`), PrismAdmin shows every phone's entries.

- **First time:** macOS may ask whether the shortcut can access the **Documents** folder. Click **Allow**.
- **The server keeps running quietly in the background** until the Mac restarts. To stop it sooner, run `pkill -f dev_server.py`.
- **Server log:** `~/Library/Logs/PrismApp-server.log`
- **To rebuild the shortcuts** (for example, after moving this folder), run:

```bash
bash tools/shortcuts/make_shortcuts.sh
```

### On a real Android phone, over Wi-Fi

```bash
python3 dev_server.py --lan
```

It prints an address like `http://192.168.1.20:8080`. Open that in Chrome on a phone connected to the same Wi-Fi. If macOS asks whether Python may accept incoming connections, click **Allow**.

## Change products and recipes

- **Before the Google Sheet exists:** edit `app/config.json`.
  - `materials`: the 9 raw materials. The unit is assumed **kg**; change it if needed.
    - You can add a container so workers can count bags or drums instead of kg, e.g. `"containers": [{ "name": "Bag", "name_hi": "बोरी", "size": 25 }]`. The one on R1 is only an example.
  - `products`: each product's `recipe` is the amount of each raw material in **ONE batch**. The three `SAMPLE` products are placeholders.
  - `workers`: names on the "Who are you?" screen.
  - **Colors** (all optional):
    - **Raw materials** are colored by their first letter: **R = red, Y = yellow, S = white, P = purple**. Each material in a family gets its own shade (e.g. R1 bright red, R5 deep red). A new code such as `R7` picks up the next red automatically. To override, set `"color": "#hex"`.
    - **Products** use their own `"color"`. If that's blank, they use their `"category"` color from `categoryColors`. If both are blank, they get an automatic neon color.
    - **Hindi notes:** `batchNote_hi` is the Hindi version of a product's note.
  - `ownerPin`: PIN for ⚙ Settings.
- **After the Google Sheet is connected:** edit the **Recipes / Materials / Workers** tabs in the Sheet. Phones pick up changes by themselves, and the Sheet wins over `config.json`.

After editing `config.json`, `app/js/recipes.js`, `app/js/report.js` or `google-sheet/server.js`, rebuild the script you paste into Google:

```bash
python3 tools/build_apps_script.py
```

## Connect the Google Sheet

Follow **[google-sheet/SETUP.md](google-sheet/SETUP.md)**. It takes about 10 minutes and is all clicking.

## Put it on the phones

Prism is a free website that phones save to their home screen. Workers' Android phones get **Prism**, and admins' iPhones get **Prism Admin**, which opens on Reports. There's no app store and no Android Studio.

Follow **[WEBSITE-AND-PHONES.md](WEBSITE-AND-PHONES.md)**:
- `python3 tools/make_website.py` builds `prism-website.zip`. It has no recipes or keys.
- You drag that zip into Cloudflare Pages.
- Each phone installs the app from the link.

The app works offline after the first open, and new versions reach phones automatically.

## Folder map

| Path | What it is |
|---|---|
| `app/` | The app itself: screens, styles and `config.json`. The website copy is built from this. |
| `app/js/i18n.js` | All English and Hindi wording |
| `app/js/recipes.js` | Recipe math (shared with the Google Sheet script) |
| `app/js/report.js` | Daily/monthly report (shared with the Google Sheet script) |
| `app/js/sync.js` | Sending entries to the Sheet, with an offline queue |
| `app/js/screens/` | One file per screen |
| `google-sheet/Code.gs` | Paste this into the Google Sheet. It's generated, so don't edit it directly. |
| `google-sheet/server.js` | The Sheet-side code (source for Code.gs) |
| `google-sheet/SETUP.md` | Click-by-click Google setup |
| `dev_server.py` | Local test server plus the pretend Google Sheet |
| `tools/build_apps_script.py` | Rebuilds `Code.gs` |
| `dev-data/` | Test data from the pretend sheet. Safe to delete. |
| `tools/make_website.py` | Builds the website copy (`site/`, `prism-website.zip`) for Cloudflare |
| `app/sw.js`, `app/*.webmanifest` | Offline support and the home-screen install details |
| `app/admin.html` | The Prism Admin entry, which opens on Reports |

## How the data stays safe

- Every entry gets a unique ID. Sending it twice never makes a duplicate row.
- An entry stays marked "waiting" on the phone until the Sheet confirms it.
- **Delete and Undo** don't erase anything. The entry is marked deleted, so the Sheet hears about it too, and the Entries tab keeps an audit trail.
- **Workers can only change entries made today on their phone.** Older fixes are done in the Sheet.
- **What stays on each phone:** the last ~2 months of sent entries, plus anything not yet sent.
- **Two copies of the app open at once** (Prism and Prism Admin, or two tabs) share the same saved entries instead of overwriting each other.
- **Adding or removing stock, and alert levels, need the owner PIN,** even though anyone with the link can open `/admin`.

## Not in this version

- Purchases and suppliers. Raw material stock itself is in the admin app.
- Changing an older entry on the phone. Those are fixed in the Sheet (see [google-sheet/SETUP.md](google-sheet/SETUP.md)).
