# Putting Prism on the phones

Prism goes on a free Cloudflare website. Phones save it to their home screen and open it like an app. No app stores.

- **Workers (Android):** the **Prism** app
- **Admins (iPhone):** the **Prism Admin** app at `/admin`, which opens straight on Reports

**Before you start:** set up the Google Sheet ([google-sheet/SETUP.md](google-sheet/SETUP.md)), then:
- put your **real recipes** in its **Recipes** tab and the worker names in **Workers**
- change the **Owner PIN** in its **Settings** tab

The website never contains recipes or the secret key. Phones get the recipes from the Sheet once they're connected.

---

## A. Put the app online (once, about 10 minutes)

1. **Make the upload file.** In Terminal, in the PrismApp folder:
   ```bash
   python3 tools/make_website.py
   ```
   This creates **`prism-website.zip`** in the PrismApp folder.
2. **Create a free Cloudflare account** at **dash.cloudflare.com/sign-up** and confirm your email.
3. **Start the upload:** in the Cloudflare dashboard, open **Workers & Pages** → **Create application** → **Get started** → **Drag and drop your files**.
4. **Pick a project name,** for example `prism-tracker`. Your link looks like **`https://prism-tracker.<your-account>.workers.dev`**.
   **Your link:** https://prism-tracker.workiket.workers.dev (admins: https://prism-tracker.workiket.workers.dev/admin)
5. **Upload:** drag **`prism-website.zip`** into the upload box → **Deploy site**.
6. **Check it:** open the link on the Mac. You should see the Prism "Who are you?" screen.

**Updating later (automatic, through GitHub):**

The project is in the private GitHub repository **unbiddenautonomy/prism-tracker**. Cloudflare publishes the `site/` folder from it every time a new version is pushed.

1. Rebuild the website copy:
   ```bash
   python3 tools/make_website.py
   ```
   Add `--demo` to include the sample products.
2. Save and push:
   ```bash
   git add -A && git commit -m "What changed" && git push
   ```
3. The site updates within a minute or two. Build logs are in Cloudflare: **prism-tracker → Deployments → View build history**.

No more zip uploads.

Phones pick up the new version the next time they open the app with internet. If one doesn't, close the app fully and open it again.

---

## B. Worker phones (Android, Chrome)

1. Open the link in **Chrome**.
2. Tap **⋮** (top right) → **Install app**. On some phones it says **Add to Home screen** → **Install**. A **Prism** icon appears on the home screen.
3. Open Prism **from that icon**, choose the language and tap the worker's name.
4. Connect it to the Sheet (owner does this once per phone):
   1. Tap **Settings** and enter the PIN.
   2. Paste the **Sheet link** and the **Secret key**.
   3. Tap **Save and test**. You should see ✓ Connected.
   4. The products appear.

**Tip:** send yourself the Sheet link and key on WhatsApp, copy-paste them on the phone, then delete the message.

---

## C. Admin phones (iPhone, Safari)

1. Open **`https://<your-link>/admin`** in **Safari**. Note the `/admin` on the end.
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**. A colorful **Prism Admin** icon appears.
3. Open Prism Admin **from that icon**. The iPhone keeps home-screen apps separate from Safari, so do the next step inside the icon app.
4. Tap **Settings** → PIN → paste the **Sheet link** and **Secret key** → **Save and test**.

Reports now show every phone's entries. The daily email keeps coming from Google as before.

Admins on Android can do the same in Chrome with the `/admin` link.

---

## Safety

- **What's on the website:** only the app's screens, the raw material codes and the default PIN. Without the secret key, someone who finds the link sees an empty app that can't send or read anything.
- **Secret key:** keep it private.
  - **If it leaks:** change **Secret key** in the Sheet's **Settings** tab, then enter the new key on each phone.
  - **Each phone stores its own copy.** On a phone that leaves the company, open Settings → **Disconnect**.
- **Owner PIN:** the PIN that unlocks Settings comes from the Sheet once a phone is connected. Until then it's the default `1234`.

## If something's off

- **No "Install app" option:** use **⋮ → Add to Home screen**.
- **iPhone:** "Add to Home Screen" only appears in **Safari's Share** menu (and in some other browsers on newer iPhones).
- **"Sheet problem · tell your supervisor":** the key is wrong or the Sheet's columns were changed. Entries wait safely on the phone until it's fixed.
- **Products missing:** the phone isn't connected to the Sheet yet (see B4 / C4), or the Recipes tab is empty.

## Showing a demo (sample products on the website)

```bash
python3 tools/make_website.py --demo
```

This puts the **sample** products from `app/config.json` (currently Y111, Y48 and Pink7) on the website, so the app can be shown without the Google Sheet. Only use it with samples. Once real recipes are in the Sheet, build again **without** `--demo` and upload that.
