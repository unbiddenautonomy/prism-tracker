> **Superseded snapshot.** Captured from the old chat on 2026-11-20 and kept for history only. Several points were already out of date when it was written (version, branches, which findings were fixed, `--demo`, the repo being private). The current facts are in [../BRIEF.md](../BRIEF.md).

# Prism tracker: project brief (captured 2026-11-20 from the old session)

## Objective
A production tracker called Prism for a small chemical factory in India. The workers are Salimbhai and Son, who are Hindi speakers, plus an owner/admin.
- Workers log batches. The app works out raw material use from recipes.
- Workers log waste and spills. Entries can be edited, deleted or undone.
- Offline-first. Syncs to a Google Sheet.
- Daily email report and low-stock alerts.
- Web app now, Android later.

## Order of work
1. Build the app (done)
2. Host on Cloudflare (done)
3. Google Sheet (done)
4. Connect phones (laptop done, phones pending)
5. Admin stock tracking (done)
6. Spoiled-batch question (done)
7. Analysis doc (done, on the `analysis` branch)
8. Real recipes and a rebuild without --demo (pending)

## Apps
### Prism (worker app)
- File: app/index.html. Live at https://prism-tracker.workiket.workers.dev
- Flow: Who are you? > Batches made / Waste-Spill / Today's entries
- English and Hindi, dark and light modes, big buttons
- Data in localStorage (key prism.entries.v1), with a service worker in app/sw.js
- Raw material colours by first letter of the code: R red, Y yellow, S white, P purple

### Prism Admin
- Page: app/admin.html, which sets window.PRISM_ADMIN. Live at /admin
- Opens on Reports
- Raw material stock screen (app/js/screens/stock.js):
  - Add or remove stock in kg or in containers (4 bags = 100 kg)
  - Low-stock alert levels
- Stock left = added - removed - used in batches - wasted
- Each entry uses the recipe as it was on the day it was entered
- Prism and Prism Admin share localStorage in the same browser. Each home-screen icon has its own storage.

### Backend
- Google Apps Script web app built from google-sheet/server.js plus app/js/recipes.js and app/js/report.js
- tools/build_apps_script.py builds these into google-sheet/Code.gs (ASCII-only)
- Deployment: Execute as me, access Anyone, protected by the secret key
- An hourly trigger sends the daily email after the report hour (20, IST)
- PRISM_VERSION is 0.2.0

### Hosting and dev
- Cloudflare builds on every push to main
- tools/make_website.py builds site/ (it currently uses --demo, with sample recipes Y111, Y48 and Pink7)
- Local server: python3 dev_server.py, with a mock sheet at /mock-sheet and key test-key
- Sheet tests: bash tools/sheet-tests/run.sh (115 checks)
- Guides: google-sheet/SETUP.md, WEBSITE-AND-PHONES.md, README.md

## Repo
unbiddenautonomy/prism-tracker
- main is live
- main-deeqe7 is the work branch
- analysis has docs/IMPROVEMENTS.md (22 findings) and no pull request
- Commit history was rewritten to remove the real name and email

## Google Sheet "Prism Production" (IST)
Phones use the Apps Script /exec link, not the Sheet's own address.
Menu: Set up / repair this sheet; Send today's report now.

| Tab | Columns |
|---|---|
| Entries | Date, Time, Type, Product, Batches, Material, Qty, Unit, Entered as, Reason, Note, Worker, Phone, Status, Raw material used, Entry ID, Created, Updated, Raw material (data), Already made |
| Material Use | Date, Type, Material, Qty, Unit, Product, Reason, Worker, Phone, Entry ID |
| Materials | Code, Name, Name (Hindi), Unit, Container, Container (Hindi), Container size, Color, Low stock alert |
| Recipes | Product, Product (Hindi), Batch note, Batch note (Hindi), Category, Color, then one column per material |
| Categories | Category, Color |
| Workers | Salimbhai, Son |
| Phones | Phone, Last sync, Worker, App version |
| Stock | Material, Unit, Counted since, Added, Removed, Used in batches, Wasted, Left, Alert below, Status, Updated |
| Settings | Report email, Report hour, Secret key, Owner PIN, App name, Last report sent |

How data flows:
1. An entry is saved on the phone.
2. It syncs to the web app (POST with the key).
3. The server dedups by Entry ID and updatedAt, and newer edits replace older rows.
4. The server refreshes the Stock tab.
5. Emails go from the owner's Gmail.

A spoiled batch marked "already recorded" counts as waste in reports, but is not taken off stock again.

## Roles and permissions (no real RBAC yet)
- Worker vs admin is decided only by the address (/ vs /admin). Anyone with the link can open /admin, which is a known gap.
- An Owner PIN guards Settings on each phone. It comes from the Sheet after the first sync.
- One shared secret key for all phones, stored in the Settings tab. A wrong key gets bad-key.
- Workers pick their name. There is no login.

## Preferences
- Short, plain, step-by-step messages.
- Save CI/Cloudflare minutes: fewer, larger commits, one push per finished task, and [skip ci] for docs-only changes.
- Never commit the secret key, and keep it out of the website and config.json.
- Keep personal names and emails out of docs and commits.

## Next steps
1. Confirm the live /exec link returns version 0.2.0. If not, paste Code.gs again, deploy a new version, then run Set up / repair.
2. Check that the Stock tab and the low-stock alert column exist.
3. Connect the worker phones and the admin iPhone.
4. Add real recipes, then rebuild without --demo.
5. Fix the top findings in IMPROVEMENTS.md:
   - Entries lost when two copies of the app are open
   - About 20 seconds to open on a weak signal
   - Hand edits in the Sheet don't fix the stock totals
6. Decide on the site address in the guide, whether the repo goes private, and VolTr access.

## Sheet web-app link (phones use this)
https://script.google.com/macros/s/AKfycbwJ5RhqKU-hZ3xmo1fTb2AdULoDmFl4eQiO8q2sElzeIRigEJNgNvCqtYoJMZOGuzGa4g/exec
