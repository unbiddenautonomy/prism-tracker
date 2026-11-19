# Prism: what to improve

Reviewed 18 Nov 2026 (app 0.2.0). **Fixes applied 19 Nov 2026** — see below.

## Summary

The review found 22 things worth changing. **Eighteen have now been fixed**, including all three of the most serious: entries could be lost when two copies of the app were open, the app took about 20 seconds to open on a weak signal, and correcting a number in the Google Sheet left the raw material totals and stock wrong. Each one was reproduced before the fix and checked again after.

Five are still open, and none of them loses data. The Sheet now copies itself to Drive every week, and entries now leave a phone even with the app shut, so the two biggest gaps are closed. The admin app also gained a **Recipes screen**, so products and their amounts can be added and changed from the phone instead of only in the Sheet.

Checks that run on this machine: `bash tools/sheet-tests/run.sh` — **169 checks pass** (115 before this work, 54 added).

## Fixed

| # | What was wrong | What happens now |
|---|---|---|
| 1 | **High.** Two copies of the app open at once (Prism and Prism Admin, or two tabs) erased each other's entries. | Every save is merged with what is already saved, so nothing is lost; a copy also picks up what the other one wrote. |
| 2 | **High.** The app took ~20 s to open whenever the signal was weak enough that requests were accepted but never answered. | It opens from the saved copy at once (measured 0.1 s) and fetches a fresh copy quietly for the next open. |
| 3 | **High.** Correcting **Batches** or **Qty** in the Entries tab left the raw material totals, the stock and the email on the old number. | The amounts now follow the correction by themselves. Entries made before this still keep their old amounts — cancel and re-enter those. |
| 4 | The big button in Waste / Spill read "Enter how muchnull" and "nullTap a reason", in both languages. | Plain wording in both languages. |
| 5 | Anyone who opened the `/admin` link could remove stock and change alert levels with no PIN. | The stock list stays readable; changing anything asks for the owner PIN, and the keypad waits half a minute after five wrong tries. The worker app's long-press shortcut into `/admin` is gone. |
| 6 | A dead sheet link looked like "waiting for internet" forever, and a wrong key showed the code "(bad-key)". | Plain words in both languages ("Wrong secret key", "Can't reach the sheet"), and a link that keeps failing for an hour while the phone is online is reported as a real problem. |
| 10 | Inserting a column in the **Materials** tab scrambled units and container sizes on every phone. | Columns are found by their heading, and a renamed heading is reported in the daily email. |
| 12a | Offline, a spoiled batch marked "already recorded as made" was taken off stock twice. | The offline figure now matches what comes back from the sheet. |
| 14 | Text starting with `=` could become a live formula in the Sheet. | Every text column of Entries, Material Use, Phones and Stock is stored as plain text. |
| 15 | A waste entry of −500 kg *added* 500 kg to stock, and an entry dated 2031 was accepted. | Negative amounts are refused, and a date years out lands on the sheet's own today. |
| 16 | Old or test phones stayed in the daily email as "NOT sent today" forever. | Only phones used in the last 7 days are warned about; the rest are still listed. |
| 17 | The guides told you to put the secret key in a file the website build empties, and said stock wasn't in this version. | README, SETUP.md and WEBSITE-AND-PHONES.md match what the code does. |
| 20 | "बैच बनाए" on the home button but "बैच बने" in the question and the report; a Hindi phone still started in English. | One name everywhere, and a phone set to Hindi opens in Hindi. Still worth having a native speaker read every line once. |
| 21 | Back, light/dark, language (40 px) and Change (36 px) were under the 48 px minimum; the phone's Back button left the screen instead of closing the "Delete this entry?" box; labels were English-only. | All those buttons are at least 44–48 px, Back (and Escape) closes the box and stays put, the smallest report text is at least 13 px, and the screen-reader labels are translated. |
| 22 | The website carried the workers' names and nothing kept it out of search engines. A `--demo` switch could publish the recipes, and the guide said to remember to stop using it once the real ones went in. | No names in the published copy, plus a "stay away" header and `robots.txt`. The `--demo` switch is **gone**: the published copy can no longer contain recipes, names or the key whatever anyone types, so there is no build step left to get wrong. Products come from the Sheet and are managed in the admin app. |
| 7 | Entries only left a phone while the app was open on the screen. | Android Chrome now sends them with the app shut, as soon as there is signal, and the app ticks them off when it next opens. iPhones don't offer this, so there nothing changes. |
| 9 | Nothing said when the Sheet script was older than the app — a forgotten "New version" on deploy was invisible. | Both carry a real version number (now 0.3.0). Settings shows the Sheet's and warns in plain words when it is behind. |
| 13 | The Sheet was the only long-term copy, with no backup. | A dated copy is saved in a "Prism backups" folder in Drive every Sunday, newest 8 kept, with **Prism → Back up this sheet now** for one on demand. |

## Still open

Effort: **S** = under a day, **M** = a few days, **L** = a week or more.

**8. The daily email is a one-time 8 pm snapshot. (Medium, S)**
`google-sheet/server.js` sends once a day and marks the day done. Entries made or sent later never appear under "Today" in any email, and a day the timer misses is never sent.
→ Send yesterday's final report each morning as well, and catch up on missed days.

**11. The phone screens have no automatic test. (Medium, M — deferred by the owner)**
`tools/sheet-tests/` covers the Sheet script only. Everything on the phone was checked by driving a real browser, but that happens only when someone asks; nothing stops it breaking again.
→ A small browser test set run before each push (so it costs no build minutes): save a batch, the waste flow in both languages, offline then online, two copies open, stock numbers, recipes. **Parked for a later discussion.**

**12b. Stock rules are written three times, and a deleted entry isn't undone offline. (Medium, M)**
`app/js/report.js`, `app/js/screens/stock.js` and `dev_server.py` each have their own copy. With no signal, deleting an entry the sheet already has leaves the old amount in the figure on screen (it corrects itself as soon as the phone is online).
→ One shared stock function used by the app, the sheet and the test server.

**18. Every sync re-reads the whole Entries tab. (Low, M — not urgent)**
`google-sheet/server.js` reads all entries on every sync and every hour. From the code, not timed on Google: it will slow down over the years.
→ Move finished years to an archive tab, or keep running stock totals.

**19. Amounts are rounded to 3 decimals. (Low, S)**
A recipe amount of 0.0025 kg is saved as 0.003 for one batch; 0.0004 kg is saved as 0.
→ Only matters if a recipe has amounts under about 5 g per batch. If so, keep more decimals or use grams.

## Checked, no problem found

- Sending the same entry twice, editing during a send, delete and undo: no duplicate rows, newest version wins.
- The secret key and real recipes are not in the website copy; the build refuses to include them.
- `Code.gs` and `site/` match their sources.
- Text in the email and on screen is escaped, so entered text cannot run as code there.
- Full phone storage gives a clear "not saved" message. The app opens and records in airplane mode. Email use is far below Google's 100 a day.
