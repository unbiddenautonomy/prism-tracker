# Connect the app to a Google Sheet (one-time, about 10 minutes)

The Google Sheet becomes the shared database for all phones, and Google sends the daily email from your own Gmail. Nothing needs to be installed and it costs nothing.

Use the Google account that should **own the data and send the email**.

## 1. Make the Sheet

1. Open **https://sheets.new** (a new blank Google Sheet).
2. Rename it at the top left, for example **Prism Production**.
3. Set the time zone: **File → Settings → Time zone → (GMT+05:30) India Standard Time** (or yours) → **Save settings**.
   The daily email hour and "today" use this time zone.

## 2. Paste the script

1. In the Sheet: **Extensions → Apps Script**. A new tab opens with a file called `Code.gs`.
2. Delete everything in that editor.
3. Open https://github.com/unbiddenautonomy/prism-tracker/blob/main/google-sheet/Code.gs and click **Copy raw file** (the two-squares button at the top right of the code). Paste it into the Apps Script editor (⌘V). Opening `google-sheet/Code.gs` from this folder in TextEdit works too.
4. Click the **💾 Save** icon.

## 3. Run setup once

1. In the toolbar, pick **`setup`** in the function dropdown next to **Run**, then click **Run**.
2. Google asks for permission. This happens every time, because it's your own script:
   - **Review permissions**, then choose your account.
   - "Google hasn't verified this app": click **Advanced**, then **Go to … (unsafe)**, then **Allow**.
   - The permission screen says the script can edit your spreadsheets, send email as you and run on a timer. The code only ever opens this one Sheet.
3. The **Execution log** at the bottom shows **"Prism sheet is ready"** and a **Secret key**.

Back in the Sheet, you now have these tabs:

| Tab | What it's for | Who edits it |
|---|---|---|
| **Materials** | The 9 raw materials (code, name, Hindi name, unit, optional container like "Bag = 25 kg", optional **Color**, optional **Low stock alert**) | You, or the admin app |
| **Recipes** | One row per product, with optional **Category** and **Color**, then one column per raw material: the amount used in **ONE batch** | You |
| **Categories** | Optional color per product category (e.g. Industrial Solvents = #FF9F00) | You |
| **Workers** | Names shown on the phones' "Who are you?" screen | You |
| **Settings** | Report email, report hour, secret key, owner PIN | You |
| **Entries** | Every entry from every phone (one row each) | The phones (don't edit) |
| **Material Use** | One row per raw material used or wasted, ready for pivot tables | The phones (don't edit) |
| **Phones** | When each phone last sent data | The phones (don't edit) |
| **Stock** | What's left of each raw material, refreshed after every sync | The script (don't edit) |

## 4. Publish it so the phones can reach it

1. In Apps Script: **Deploy → New deployment**.
2. Click the ⚙ next to "Select type" and choose **Web app**.
3. Fill in:
   - Description: `Prism v1`
   - Execute as: **Me**
   - Who has access: **Anyone**. The phones don't log into Google; the secret key protects the sheet instead.
4. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.
5. Check it: paste that URL into a browser. You should see `{"ok":true,"app":"Prism sheet",...}`.

## 5. Tell the app where the Sheet is

Do this once on each phone:

1. On the phone, open **⚙ Settings** and enter the PIN (1234 to start).
2. Paste the **Sheet link** and the **Secret key**.
3. Tap **Save and test**. You should see ✅ Connected.

The link and key are deliberately **not** built into the website: every file on a website can be downloaded by anyone who has the address. `app/config.json` has a `"sheet"` entry for testing on your own computer only — `tools/make_website.py` always empties it in the published copy.

To see the key again later, use the **Prism** menu in the Sheet → **Show secret key**. (Reload the Sheet once if the menu isn't there yet.)

## 6. Set up the daily email

In the **Settings** tab:

- **Report email**: who gets it. Separate several with commas. If you leave it empty, it goes to you.
- **Report hour**: 0–23. For example `20` means the email goes out between 8 pm and 9 pm.

To test it now, use the **Prism** menu → **Send today's report now**.

The email also has a **Raw material stock** section, once stock has been added in the admin app.

## 7. Raw material stock and low stock alerts

- **Adding or removing stock** is done in the **Prism Admin** app: tap **Raw material stock**, then a material.
- **Stock left** = stock added − stock removed − used in batches − wasted.
  - Each material is counted from its **first** stock entry. Enter everything you have in stock at that moment.
- **Low stock alert:** set it per material in the admin app, or type a number in the **Low stock alert** column of **Materials**. Leave it empty for no alert.
- **When a material falls below its alert level:**
  - The **Report email** address gets an email straight away. It's sent once, and again only after the material has gone back above the level and fallen below it again.
  - The admin app shows a red **Low stock** box.
  - The daily email lists it at the top.
- The **Stock** tab shows the same numbers, refreshed after every sync and every hour.

## 8. Backups

This Sheet is the only long-term copy of your entries: the phones keep about two months and cannot send them again. So the script emails you a copy every week.

- **Every Sunday, early morning**, an email arrives at your **Report email** address with the **Entries, Materials, Recipes, Workers and Categories** tabs attached as CSV files. The subject says the date and how many entries are in it.
- **To get one right now:** **Prism → Email a backup now**.
- **To check it's working:** the **Settings** tab has a **Last backup** row, filled in automatically.
- **To restore:** open a blank Google Sheet and use **File → Import → Upload** with the CSV file, or just open the file and paste the text in.
- **Keep the emails.** They are the backup. Don't delete them to save space; a year of a small factory is only a few MB.

**Why email and not Google Drive?** Copying a file in Drive makes Google ask for permission to *"see, edit, create and delete all of your Google Drive files"* — far more than a backup is worth, and more than you should hand to any script. Sending email is already allowed for the daily report, so backups cost no new permission at all.

**Not included on purpose:** the **Settings** tab, because it holds your secret key, and the **Material Use** and **Stock** tabs, because the script works those out from the entries.

---

## Everyday use

- **Change a recipe:** edit the number in the **Recipes** tab. Phones pick it up within about 15 minutes, or straight away when the app is opened. Old entries keep the amounts used at the time.
- **Add a product:** add a row in **Recipes**.
- **Add a raw material:**
  1. Add a row in **Materials**.
  2. Add a column with **exactly the same code** at the right of **Recipes**.
- **Add a worker:** add a row in **Workers**.
- **Colors:** type a hex color like `#00F5A0` in the **Color** column of Materials or Recipes. Products use these in order:
  1. Their own Color
  2. Their Category's color from the **Categories** tab
  3. An automatic neon color, if both are blank
- **Fix wrong stock:** in the admin app, open the material and either delete the wrong change or add/remove the difference.
- **Cancel a wrong entry from an earlier day:** in **Entries**, change its **Status** to `DELETED`. Reports and the email then ignore it. Also delete its rows in **Material Use**, which share the same Entry ID. Today's entries can be fixed on the phone itself.
- **Correct a number from an earlier day:** in **Entries**, change **Batches** (or **Qty** for a raw material). The **reports, the stock and the daily email** follow the new number by themselves.
  - Two places do **not** follow it: the readable **Raw material used** column, and the **Material Use** tab. They still show what was first recorded. If you build pivot tables on **Material Use**, cancel the entry (Status `DELETED`) and re-enter it instead of correcting the number.
  - The totals come from the hidden **Raw material (data)** column, so leave that one alone.
  - Entries made before this was added keep their old amounts; cancel and re-enter those too.
- **Don't rename, move or delete columns** in Entries, Material Use or Phones. If that happens, phones stop sending and show "Sheet problem" until it's fixed. Their entries wait safely on the phone in the meantime. Build your own summaries in new tabs instead.

If something in the Recipes tab is wrong (text instead of a number, a column code that isn't in Materials), it's listed:
- at the top of the daily email
- on the phone under **⚙ Settings → Recipes**

## Updating the script later

When you get a new `Code.gs`:

1. Paste it over the old one and click **Save**.
2. Go to **Deploy → Manage deployments** and click ✏️ **Edit**.
3. Set **Version: New version** and click **Deploy**.
4. Reload the Sheet, then click **Prism → Set up / repair this sheet**. It's safe to run any time: it keeps your data and also fixes any garbled text (like `¬∑` or `‡§`).

The link stays the same, so nothing changes on the phones.

**Did the new version really go live?** On a phone that's connected, open **⚙ Settings**. Under **Google Sheet** it now says either *"Sheet script version 0.3.1 · same as the app"* or a warning telling you the Sheet is still running an older one. (Tap **Send now** first if it hasn't synced lately.) You can also open the web app link in a browser: it prints the version it's running.

> **Google should not ask you for any new permission.** The script only uses what you allowed the first time. If a screen appears asking to *"see, edit, create and delete all of your Google Drive files"*, you are pasting an old 0.3.0 copy — **click Cancel** and paste the current `Code.gs` instead. Prism never needs access to your Drive.

## Limits worth knowing

- These are Google's free limits, far more than a small factory needs:
  - 100 emails a day
  - 30 phones sending at the same moment
  - about 10 million cells per Sheet, which is years of entries
- The email is sent some time **within** the report hour, not at an exact minute.
