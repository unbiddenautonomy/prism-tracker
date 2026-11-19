# Prism: what to improve

Reviewed 18 Nov 2026 (app 0.2.0). **Fixes applied 19 Nov 2026** — see below.

## Summary

The review found 22 things worth changing. **Fifteen have now been fixed**, including all three of the most serious: entries could be lost when two copies of the app were open, the app took about 20 seconds to open on a weak signal, and correcting a number in the Google Sheet left the raw material totals and stock wrong. All three were reproduced before the fix and checked again after.

Seven things are still open. None of them loses data; they are mostly about catching up later (a daily email that is only a snapshot, no second copy of the Sheet, no automatic test of the phone screens). The two worth doing next are a **weekly backup of the Sheet** and **sending entries in the background** so a phone left in a pocket doesn't hold them.

Checks that run on this machine: `bash tools/sheet-tests/run.sh` — **139 checks pass** (115 before, 24 added for the new behaviour).

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
| 22 | The website carried the workers' names and nothing kept it out of search engines. | No names in the published copy (phones read them from the Sheet), plus a "stay away" header and `robots.txt`. |

## Still open

Effort: **S** = under a day, **M** = a few days, **L** = a week or more.

**7. Entries only go to the sheet while the app is open on the screen. (Medium, M)**
Sending runs on timers inside the page (`app/js/sync.js:121-131`); `app/sw.js` has no background sending. An entry saved without signal waits until someone opens the app again.
→ Add background sync (Android Chrome supports it), or say plainly "open the app when you have signal".

**8. The daily email is a one-time 8 pm snapshot. (Medium, S)**
`google-sheet/server.js` sends once a day and marks the day done. Entries made or sent later never appear under "Today" in any email, and a day the timer misses is never sent.
→ Send yesterday's final report each morning as well, and catch up on missed days.

**9. Nothing tells you when the Sheet script is older than the app. (Medium, S)**
Forgetting "New version" when deploying leaves the old script running, and no screen shows it.
→ Stamp a build number into both at build time, send it with every sync, and warn in Prism Admin when the Sheet's is older.

**11. The phone screens have no automatic test. (Medium, M)**
`tools/sheet-tests/` covers the Sheet script only. The fixes above were checked by hand with a real browser; nothing stops them breaking again.
→ A small browser test set run on the Mac before each push (so it costs no build minutes): save a batch, the waste flow in both languages, offline then online, two copies open, stock numbers.

**12b. Stock rules are written three times, and a deleted entry isn't undone offline. (Medium, M)**
`app/js/report.js`, `app/js/screens/stock.js` and `dev_server.py` each have their own copy. With no signal, deleting an entry the sheet already has leaves the old amount in the figure on screen (it corrects itself as soon as the phone is online).
→ One shared stock function used by the app, the sheet and the test server.

**13. The Sheet is the only long-term copy, with no backup. (Medium, S)**
Phones keep sent entries for 62 days (`app/js/store.js:12`) and have no way to send them again.
→ A weekly automatic copy of the spreadsheet (keep the last 8), plus a "send everything on this phone again" button in Settings.

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
