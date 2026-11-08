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
3. On the Mac, open `google-sheet/Code.gs` from this folder. Right-click → Open With → TextEdit works. Select all (⌘A), copy (⌘C), and paste it into the Apps Script editor (⌘V).
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
| **Materials** | The 9 raw materials (code, name, Hindi name, unit, optional container like "Bag = 25 kg", optional **Color**) | You |
| **Recipes** | One row per product, with optional **Category** and **Color**, then one column per raw material: the amount used in **ONE batch** | You |
| **Categories** | Optional color per product category (e.g. Industrial Solvents = #FF9F00) | You |
| **Workers** | Names shown on the phones' "Who are you?" screen | You |
| **Settings** | Report email, report hour, secret key, owner PIN | You |
| **Entries** | Every entry from every phone (one row each) | The phones (don't edit) |
| **Material Use** | One row per raw material used or wasted, ready for pivot tables | The phones (don't edit) |
| **Phones** | When each phone last sent data | The phones (don't edit) |

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

Pick one of these:

- **Every phone at once (recommended):** put the link and key in `app/config.json` before building the Android app:
  ```json
  "sheet": { "url": "https://script.google.com/macros/s/…/exec", "key": "the secret key" },
  ```
- **One phone at a time:**
  1. On the phone, open **⚙ Settings** and enter the PIN (1234 to start).
  2. Paste the **Sheet link** and the **Secret key**.
  3. Tap **Save and test**. You should see ✅ Connected.

To see the key again later, use the **Prism** menu in the Sheet → **Show secret key**. (Reload the Sheet once if the menu isn't there yet.)

## 6. Set up the daily email

In the **Settings** tab:

- **Report email**: who gets it. Separate several with commas. If you leave it empty, it goes to you.
- **Report hour**: 0–23. For example `20` means the email goes out between 8 pm and 9 pm.

To test it now, use the **Prism** menu → **Send today's report now**.

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
- **Cancel a wrong entry from an earlier day:** in **Entries**, change its **Status** to `DELETED`. Reports and the email then ignore it. Also delete its rows in **Material Use**, which share the same Entry ID. Today's entries can be fixed on the phone itself.
- **Don't rename, move or delete columns** in Entries, Material Use or Phones. If that happens, phones stop sending and show "Sheet problem" until it's fixed. Their entries wait safely on the phone in the meantime. Build your own summaries in new tabs instead.

If something in the Recipes tab is wrong (text instead of a number, a column code that isn't in Materials), it's listed:
- at the top of the daily email
- on the phone under **⚙ Settings → Recipes**

## Updating the script later

When you get a new `Code.gs`:

1. Paste it over the old one and click **Save**.
2. Go to **Deploy → Manage deployments** and click ✏️ **Edit**.
3. Set **Version: New version** and click **Deploy**.

The link stays the same, so nothing changes on the phones.

## Limits worth knowing

- These are Google's free limits, far more than a small factory needs:
  - 100 emails a day
  - 30 phones sending at the same moment
  - about 10 million cells per Sheet, which is years of entries
- The email is sent some time **within** the report hour, not at an exact minute.
