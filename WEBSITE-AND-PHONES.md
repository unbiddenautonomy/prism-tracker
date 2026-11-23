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

The project is in the public GitHub repository **unbiddenautonomy/prism-tracker**. Cloudflare publishes the `site/` folder from it every time a new version is pushed.

1. Rebuild the website copy:
   ```bash
   python3 tools/make_website.py
   ```
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
3. Open Prism **from that icon** and choose the language.
4. Connect it to the Sheet (owner does this once per phone):
   1. On the "Who are you?" screen, tap **My name is not in the list**, type any name and save. (The workers' real names are not on the website; they arrive with the recipes in the next step.)
   2. Tap **Settings** and enter the PIN.
   3. Paste the **Sheet link** and the **Secret key**.
   4. Tap **Save and test**. You should see ✓ Connected.
   5. The products and the worker names appear. Tap **Change** next to the name and pick the right worker.

**Tip:** send yourself the Sheet link and key on WhatsApp, copy-paste them on the phone, then delete the message.

---

## C. Admin phones (iPhone, Safari)

1. Open **`https://<your-link>/admin`** in **Safari**. Note the `/admin` on the end.
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**. A colorful **Prism Admin** icon appears.
3. Open Prism Admin **from that icon**. The iPhone keeps home-screen apps separate from Safari, so do the next step inside the icon app.
4. Tap **Settings** → PIN → paste the **Sheet link** and **Secret key** → **Save and test**.

Reports now show every phone's entries. The daily email keeps coming from Google as before.

**Raw material stock** (the button at the top of Prism Admin):
1. Tap a material. **Enter the PIN** — the list is readable by anyone with the link, but changing stock is not.
2. Choose **Add stock** (a delivery arrived) or **Remove stock** (returned, given away, counted less).
3. Enter the amount, in kg or in bags/drums, and tap the big button.
4. Under **Low stock alert**, enter the amount at which you want a warning, then tap **Save alert**. This needs internet.

**Recipes** (the button at the bottom of Prism Admin):
1. Tap a product to change what **one batch** uses, or **Add a product**.
2. Enter the PIN.
3. Fill in the amount of each raw material for a single batch; leave the ones it doesn't use empty.
4. **Save product**. Workers see it within about 15 minutes, or straight away when they next open the app.

Removing a product only stops workers seeing it — everything already recorded keeps its amounts. This needs internet, because recipes live in the Sheet.

Admins on Android can do the same in Chrome with the `/admin` link.

---

## Safety

- **What's on the website:** only the app's screens, the raw material codes and the default PIN. No recipes, no worker names, no secret key. Without the key, someone who finds the link sees an empty app that can't send or read anything. The website also asks search engines to stay away, so the link has to be shared to be found.
- **Secret key:** keep it private.
  - **If it leaks:** change **Secret key** in the Sheet's **Settings** tab, then enter the new key on each phone.
  - **Each phone stores its own copy.** On a phone that leaves the company, open Settings → **Disconnect**.
- **Owner PIN:** unlocks ⚙ Settings and any change to stock or alert levels. It comes from the Sheet once a phone is connected; until then it's the default `1234`. **Change it** in the Sheet's **Settings** tab. After five wrong tries the keypad waits half a minute.

## If something's off

- **No "Install app" option:** use **⋮ → Add to Home screen**.
- **iPhone:** "Add to Home Screen" only appears in **Safari's Share** menu (and in some other browsers on newer iPhones).
- **"Sheet problem · tell your supervisor":** the key is wrong or the Sheet's columns were changed. Entries wait safely on the phone until it's fixed.
- **Products missing:** the phone isn't connected to the Sheet yet (see B4 / C4), or the Recipes tab is empty.

## Why the website has no recipes

Every file on a website can be downloaded by anyone who has the address, and a recipe is the one thing in Prism worth stealing. So the published copy never contains the recipes, the worker names or the secret key — and there is no switch to put them there.

Phones get all three from the Google Sheet the moment the key is entered in Settings, and products are added and changed in **Prism Admin → Recipes**. Nothing about the recipes is ever part of an upload, so there is no build step to get wrong.
