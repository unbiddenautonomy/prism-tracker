# Prism: what to improve

Reviewed 18 Nov 2026 (app 0.2.0).

## Summary

Overall health: the basics hold up (entries are saved on the phone first, the Sheet never gets duplicate rows, all 115 Sheet tests pass), but the phone app itself has no automated tests and has some real gaps. Fix these three first:

1. **Entries can vanish without any warning** when two copies of the app are open on one phone or computer, for example Prism and Prism Admin together.
2. **On a weak signal the app takes about 20 seconds to open**, although everything it needs is already saved on the phone.
3. **Correcting a number directly in the Google Sheet does not correct stock or raw material totals**, yet the app tells workers to ask for exactly that.

Every finding below was reproduced on a test copy (Sheet tests, the local test server, a phone-sized Chrome) or is quoted from the code. Not checked: the live website, real Google speed and limits, real phones.

## Findings, most important first

Effort: **S** = under a day, **M** = a few days, **L** = a week or more.

### High

**1. Two copies of the app open on one phone can erase entries. (S)**
- Evidence: each copy loads the entry list once (`app/js/store.js:61`) and later writes its whole list back (`store.js:154`). Reproduced with the worker app and `/admin` open and no signal: a saved batch disappeared from the phone when the other copy saved a stock change, and never reached the sheet.
- Fix: before every save, merge with what is in storage (newest version of each entry wins), and reload the list when the browser reports that storage changed.

**2. On a weak signal the app takes about 20 seconds to open. (S)**
- Evidence: measured 20.4 s for both apps with every file already saved, when the network accepts requests but does not answer. Normal network and airplane mode: 0.1 s. Cause: `app/sw.js:39,66-88` waits 4 s for the internet at each of five loading steps before using the saved copy.
- Fix: open from the saved copy straight away and fetch updates in the background. Keep "internet first" only for `config.json`.

**3. Changing Batches or Qty by hand in the Entries tab does not change raw material totals or stock. (S now, M properly)**
- Evidence: totals and stock are read from the hidden "Raw material (data)" column (`google-sheet/server.js:351-356`). Test: Batches changed from 3 to 1; the report showed 1 batch but still 2.4 kg of Y1 used (should be 0.8) and 97.6 kg left (should be 99.2). The app tells workers to ask for this fix (`app/js/i18n.js:83`).
- Fix now: change the app message and guide to "mark it DELETED and enter it again", and protect those columns. Properly: an "edit an older entry" screen in Prism Admin.

### Medium

**4. The big button in Waste / Spill shows the word "null". (S)**
- Evidence: seen in both languages: "Enter how muchnull", "nullTap a reason", "nullकारण चुनें" (`app/js/screens/waste.js:199,325`).
- Fix: leave the icon out instead of passing an empty value, as line 230 of the same file already does.

**5. Stock and alert levels can be changed from a worker's phone without the PIN. (S)**
- Evidence: only Settings asks for the PIN (`app/js/screens/settings.js:22-26`). On a phone that never entered the PIN, opening `/admin` let me remove 9 kg of Y1 and set its alert to 500. Long-pressing the worker app icon offers a "Report" shortcut straight to `/admin` (`app/manifest.webmanifest:18`).
- Also: the PIN is sent to every phone and checked there (`server.js:277`, `settings.js:29`), with unlimited tries, so it is a light lock only.
- Fix: ask for the PIN before stock and alert changes, and remove that shortcut. Later: a separate admin key that the Sheet itself checks.

**6. A broken sheet link looks like "no internet", forever. (S)**
- Evidence: only three errors count as a sheet problem (`app/js/sync.js:116`). With a link that no longer exists and the internet on, the phone showed "1 waiting · will send when internet is back". A wrong key shows the raw code "(bad-key)", also in Hindi (`app/js/main.js:118`).
- Fix: if sending keeps failing while the phone is online (say for an hour), show the red "Sheet problem" line with the time of the last successful send, in plain words.

**7. Entries only go to the sheet while the app is open on the screen. (M)**
- Evidence: sending runs on timers inside the page (`app/js/sync.js:121-131`); `app/sw.js` has no background sending. An entry saved without signal waits until someone opens the app again.
- Fix: add background sync (Android Chrome supports it), or change the wording to "open the app when you have signal".

**8. The daily email is a one-time 8 pm snapshot. (S)**
- Evidence: `server.js:650-664` sends once per day and marks the day done. Test: an entry sent after the email produced no second email. Entries made or sent later never appear under "Today" in any email, and a day the timer misses is never sent.
- Fix: send yesterday's final report each morning (or add a "since the last email" section), and catch up on missed days.

**9. Nothing tells you when the Sheet script is older than the app. (S)**
- Evidence: forgetting "New version" when deploying keeps the old script running. The sync reply carries no version (`server.js:644`), the app ignores the one in the connection test (`settings.js:114`), and both numbers are typed by hand (`sync.js:5`, `server.js:7`).
- Fix: stamp a build number into both at build time, send it with every sync, and warn in Prism Admin when the Sheet's is older.

**10. Inserting a column in the Materials tab scrambles the materials on every phone. (S)**
- Evidence: Materials is read by column position with no heading check (`server.js:190-206`). Test: one added column made R1's unit read "R1" and its bag size disappear; sync carried on, with misleading warnings about colors.
- Fix: find the columns by their headings, as the Recipes tab already does.

**11. The app has no automated tests. (M)**
- Evidence: `tools/sheet-tests/` covers only the Sheet script. Findings 1, 4 and 12 are all in untested app code.
- Fix: a small browser test set run on the Mac before each push (so it uses no build minutes): save a batch, the waste flow in both languages, offline then online, two copies open, stock numbers.

**12. Stock rules are written three times and have already drifted; offline stock can be wrong. (M)**
- Evidence: `app/js/report.js:207-248`, `app/js/screens/stock.js:35-85`, `dev_server.py:74-119`. Without signal, a spoiled batch marked "already recorded" was taken off stock again (92 kg shown as 90.4, `stock.js:35-40`), and a deleted 50 kg stock entry still counted (`stock.js:66`). Both corrected themselves once online.
- Fix: one shared stock function used by the app, the sheet and the test server.

**13. The Sheet is the only long-term copy, with no backup. (S)**
- Evidence: phones keep sent entries for 62 days (`store.js:12,237-242`) and have no way to send them again.
- Fix: a weekly automatic copy of the spreadsheet (keep the last 8), plus a "send everything on this phone again" button in Settings.

### Low

**14. Text starting with "=" can become a live formula in the Sheet. (S)**
- Evidence: these columns are not stored as plain text: Material, Unit and "Raw material used" in Entries (`server.js:44`); Material, Product, Worker and Phone in Material Use (`server.js:445`); Worker in Phones (`server.js:557`). The worker name is typed freely on the phone (`app/js/screens/who.js:31`). Needs a phone that has the key.
- Fix: store every text column as plain text.

**15. The Sheet accepts impossible entries. (S)**
- Evidence: `server.js:287-293`. Test: a waste entry of −500 kg added 500 kg to stock; an entry dated 2031 was accepted and then appeared in no report. Dates and times come from each phone's own clock and are never compared with the Sheet's.
- Fix: reject negative amounts and dates more than a few days off, and list rejected entries in the daily email.

**16. Old or test phones stay in the email as "NOT sent today" forever. (S)**
- Evidence: every row of the Phones tab is checked (`app/js/report.js:518-523`). Test: three warnings still present 30 days later.
- Fix: warn only about phones seen in the last 7 days.

**17. The guides contradict the code. (S)**
- Evidence: `google-sheet/SETUP.md:59` recommends putting the link and key in `config.json` "before building the Android app"; the website build removes them (`tools/make_website.py:62,89`) and the key would end up in GitHub. `README.md:119` says stock is not in this version; `README.md:93` mentions an Android app.
- Fix: update the three guides.

**18. Every sync re-reads the whole Entries tab. (M, not urgent)**
- Evidence: `server.js:449-454,495-498,633-635`, and again every hour (`server.js:657`). From the code, not timed on Google: it will slow down over the years.
- Fix: move finished years to an archive tab, or keep running stock totals.

**19. Amounts are rounded to 3 decimals for every entry. (S)**
- Evidence: `app/js/recipes.js:26-28,65`. A recipe amount of 0.0025 kg is saved as 0.003 for one batch; 0.0004 kg is saved as 0.
- Fix: only matters if a recipe has amounts under about 5 g per batch. If so, keep more decimals or use grams.

**20. Hindi wording and first start. (S)**
- Evidence: the home button says "बैच बनाए" but the spoiled-batch question and the report say "बैच बने" (`app/js/i18n.js:198,241`, `app/js/report.js:99`). A phone set to Hindi still starts in English (`app/js/main.js:151`). Back is "वापस" and Undo is "वापस लें".
- Fix: one name for "Batches made" everywhere, start in Hindi on Hindi phones, and have a native speaker read every line once.

**21. Small touch targets and pop-ups. (S)**
- Evidence at 360×640: Back, light/dark and language buttons are 40 px high and "Change" is 36 px (`app/css/app.css:118,201`); the usual minimum is 48. With the "Delete this entry?" box open, the phone's Back button leaves the page (it went to Home) instead of only closing the box (`app/js/ui.js:47-72`). Some report text is under 13 px. Screen-reader labels are in English only.
- Fix: raise those buttons to 48 px, make Back only close the pop-up, translate the labels.

**22. The public website shows more than it needs to. (S)**
- Evidence: `site/config.json` holds the default PIN, the workers' first names, the material codes and (demo build) the sample recipes. Nothing asks search engines to stay away (`site/_headers`).
- Fix: add a "noindex" header, leave worker names out of the website copy, and build without `--demo` once real recipes exist.

## Checked, no problem found

- Sending the same entry twice, editing during a send, delete and undo: no duplicate rows, newest version wins.
- The secret key and real recipes are not in the website copy; the build refuses to include the key.
- `Code.gs` and `site/` match their sources today.
- Text in the email and on screen is escaped, so entered text cannot run as code there.
- Full phone storage gives a clear "not saved" message. The app opens in airplane mode. Email use is far below Google's 100 a day.
