// Tests for google-sheet/Code.gs against the fake spreadsheet in fakes.js.
// Run with:  bash tools/sheet-tests/run.sh
var __fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('PASS ' + name);
  else { __fails++; console.log('FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); }
}
function post(obj) {
  return JSON.parse(doPost({ postData: { contents: JSON.stringify(obj) } }).getContent());
}
function sheet(n) { return __ss.getSheetByName(n); }
function rows(n) { var s = sheet(n); return s.getLastRow() < 2 ? [] : s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).getValues(); }

var today = Utilities.formatDate(new Date(), 'x', 'yyyy-MM-dd');
var yesterday = addDays(today, -1);

// 1. setup
setup();
check('tabs created', ['Materials', 'Recipes', 'Workers', 'Settings', 'Entries', 'Material Use', 'Phones', 'Categories'].every(function (n) { return !!sheet(n); }));
check('blank Sheet1 removed', !sheet('Sheet1'));
check('9 materials seeded', rows('Materials').length === 9, rows('Materials').length);
check('recipes header has codes', sheet('Recipes').getRange(1, 1, 1, 15).getValues()[0].slice(6).join(',') === 'R1,R5,Y1,Y5,Y8,S1,S2,S3,P2');
check('3 sample products', rows('Recipes').length === 3);
var s = readSettings_();
check('secret key generated', s.key.length >= 16, s.key);
check('PIN kept as text', s.pin === '1234', s.pin);
check('one hourly trigger', __triggers.length === 1 && __triggers[0].fn === 'hourlyCheck');
setup(); // running again must not duplicate anything
check('setup is safe to re-run', rows('Materials').length === 9 && rows('Recipes').length === 3 && __triggers.length === 1 && rows('Settings').length === 6);

var seeded = readConfig_().products;
check('sample products seeded with recipes',
  seeded.map(function (p) { return p.name; }).join(',') === 'Y111,Y48,Pink7' && seeded[0].recipe.Y1 === 0.8 && seeded[0].recipe.Y5 === 0.3 && seeded[0].recipe.P2 === 0.1 &&
  seeded[1].recipe.Y1 === 0.5 && seeded[1].recipe.P2 === 0.2 && seeded[2].recipe.R1 === 0.6 && seeded[2].recipe.S2 === 0.4,
  seeded.map(function (p) { return p.name + JSON.stringify(p.recipe); }));
check('sample product colors seeded', seeded[0].color === '#FFD23F' && seeded[2].color === '#FF4D8D', seeded.map(function (p) { return p.color; }));
check('Hindi batch note seeded', seeded[0].batchNote_hi === 'नमूना · 1 बैच = 1 kg', seeded[0].batchNote_hi);
check('2 workers seeded', rows('Workers').length === 2 && rows('Workers')[0][0] === 'Salimbhai', rows('Workers'));

// 2. auth
check('wrong key rejected', post({ key: 'nope', action: 'ping' }).error === 'bad-key');
var ping = post({ key: s.key, action: 'ping' });
check('ping ok', ping.ok && ping.products === 3, ping);

// 3. sync
function mk(id, fields) {
  return Object.assign({ id: id, date: today, time: '09:00', worker: 'Salimbhai', phone: 'Phone A', status: 'ok', createdAt: '2026-11-03T03:00:00.000Z', updatedAt: '2026-11-03T03:00:00.000Z' }, fields);
}
var e1 = mk('e1', { type: 'production', product: 'Y111', batches: 3, lines: [{ material: 'Y1', qty: 2.4, unit: 'kg' }, { material: 'Y5', qty: 0.9, unit: 'kg' }, { material: 'P2', qty: 0.3, unit: 'kg' }] });
var e2 = mk('e2', { type: 'waste', material: 'R1', qty: 50, unit: 'kg', entered: '2 × Bag (25 kg)', reason: 'spill', note: 'drum tipped', lines: [{ material: 'R1', qty: 50, unit: 'kg' }] });
var e3 = mk('e3', { type: 'waste', date: yesterday, product: 'Y48', batches: 0.5, reason: 'failed', lines: [{ material: 'Y1', qty: 0.25, unit: 'kg' }, { material: 'P2', qty: 0.1, unit: 'kg' }] });
var e4 = mk('e4', { type: 'production', product: 'Pink7', batches: 1, status: 'deleted', lines: [{ material: 'R1', qty: 0.6, unit: 'kg' }] });
var res = post({ key: s.key, action: 'sync', phone: 'Phone A', worker: 'Salimbhai', appVersion: '0.1.0', entries: [e1, e2, e3, e4] });
check('sync ok', res.ok, res);
check('all ids acknowledged', res.saved.sort().join() === 'e1,e2,e3,e4', res.saved);
check('config returned', res.config && res.config.products.length === 3 && res.config.materials.length === 9);
check('4 entry rows', rows('Entries').length === 4, rows('Entries').length);
check('material use rows only for live entries (3+1+2)', rows('Material Use').length === 6, rows('Material Use').length);
var r0 = rows('Entries')[0];
check('date stays text, not a Date', typeof r0[0] === 'string' && r0[0] === today, String(r0[0]));
check('updated stays text', typeof r0[colOf_('updatedAt') - 1] === 'string');
check('reason label written', rows('Entries')[1][colOf_('reason') - 1] === 'Spill');
check('deleted shown as DELETED', rows('Entries')[3][colOf_('status') - 1] === 'DELETED');
check('readable raw text', r0[colOf_('rawText') - 1] === 'Y1 2.4 kg, Y5 0.9 kg, P2 0.3 kg', r0[colOf_('rawText') - 1]);
check('phone recorded', rows('Phones').length === 1 && rows('Phones')[0][0] === 'Phone A');

// 4. resend -> no duplicates
post({ key: s.key, action: 'sync', phone: 'Phone A', entries: [e1, e2, e3, e4] });
check('resend makes no duplicates', rows('Entries').length === 4 && rows('Material Use').length === 6);

// 5. newer edit replaces row + material use
var e1b = Object.assign({}, e1, { batches: 5, updatedAt: '2026-11-03T03:10:00.000Z', lines: [{ material: 'Y1', qty: 4, unit: 'kg' }, { material: 'Y5', qty: 1.5, unit: 'kg' }, { material: 'P2', qty: 0.5, unit: 'kg' }] });
post({ key: s.key, action: 'sync', phone: 'Phone A', entries: [e1b] });
var batchesNow = rows('Entries').filter(function (r) { return r[colOf_('id') - 1] === 'e1'; })[0][colOf_('batches') - 1];
check('edit updated batches', batchesNow === 5, batchesNow);
var y1Use = rows('Material Use').filter(function (r) { return r[9] === 'e1' && r[2] === 'Y1'; });
check('material use replaced, not doubled', y1Use.length === 1 && y1Use[0][3] === 4, y1Use);

// 6. older version ignored
post({ key: s.key, action: 'sync', phone: 'Phone A', entries: [e1] });
batchesNow = rows('Entries').filter(function (r) { return r[colOf_('id') - 1] === 'e1'; })[0][colOf_('batches') - 1];
check('older version ignored', batchesNow === 5, batchesNow);

// 7. delete later
var e2del = Object.assign({}, e2, { status: 'deleted', updatedAt: '2026-11-03T03:20:00.000Z' });
post({ key: s.key, action: 'sync', phone: 'Phone A', entries: [e2del] });
check('deleting removes its material use rows', rows('Material Use').filter(function (r) { return r[9] === 'e2'; }).length === 0);

// 8. second phone
var b1 = mk('b1', { phone: 'Phone B', worker: 'Son', type: 'production', product: 'Y48', batches: 2, time: '11:30', lines: [{ material: 'Y1', qty: 1, unit: 'kg' }, { material: 'Y5', qty: 1, unit: 'kg' }, { material: 'P2', qty: 0.4, unit: 'kg' }] });
post({ key: s.key, action: 'sync', phone: 'Phone B', worker: 'Son', entries: [b1] });
check('two phones listed', rows('Phones').length === 2);

// 9. owner edits recipes badly -> warnings (Recipes columns: 1-6 fixed, R1 = column 7)
var rec = sheet('Recipes');
rec.getRange(2, 7).setValue('12 kg');
rec.getRange(1, 16).setValue('Z9');
var cfg = readConfig_();
check('bad recipe value warned', cfg.warnings.some(function (w) { return w.indexOf('"12 kg" is not a number') >= 0; }), cfg.warnings);
check('unknown column warned', cfg.warnings.some(function (w) { return w.indexOf('"Z9"') >= 0; }), cfg.warnings);
rec.getRange(2, 7).setValue('');
rec.getRange(1, 16).setValue('');

// 9b. colors + categories
check('4 categories seeded', rows('Categories').length === 4, rows('Categories').length);
sheet('Materials').getRange(2, 8).setValue('#123abc');      // R1 color
sheet('Materials').getRange(3, 8).setValue('blue');         // R5 bad color
rec.getRange(2, 6).setValue(''); rec.getRange(3, 6).setValue(''); // clear own colors of products 1 and 2
rec.getRange(3, 5).setValue('Industrial Solvents');         // product 2 category
rec.getRange(4, 6).setValue('#ff00aa');                     // product 3 own color
cfg = readConfig_();
check('material color read', cfg.materials[0].color === '#123ABC', cfg.materials[0].color);
check('bad color warned', cfg.warnings.some(function (w) { return w.indexOf('"blue"') >= 0; }), cfg.warnings);
check('category read', cfg.products[1].category === 'Industrial Solvents' && cfg.categoryColors['Industrial Solvents'] === '#FF9F00');
var norm = normalizeConfig(cfg);
check('category color applied', norm.products[1].color === '#FF9F00', norm.products[1].color);
check('own color wins', norm.products[2].color === '#FF00AA', norm.products[2].color);
check('blank color gets palette', norm.products[0].color === PRODUCT_COLORS[0], norm.products[0].color);
check('material shades from config (S1 white, P2 purple)', norm.materials[5].color === '#FFFFFF' && norm.materials[8].color === '#A855F7', norm.materials.map(function (m) { return m.code + ' ' + m.color; }));
var fam = normalizeConfig({ materials: [{ code: 'R1' }, { code: 'R7' }, { code: 'Y2' }, { code: 'S9' }, { code: 'P4' }, { code: 'Z1' }] });
check('blank material colors follow R/Y/S/P families',
  fam.materials[0].color === MATERIAL_FAMILIES.R[0] && fam.materials[1].color === MATERIAL_FAMILIES.R[1] && fam.materials[2].color === MATERIAL_FAMILIES.Y[0] &&
  fam.materials[3].color === MATERIAL_FAMILIES.S[0] && fam.materials[4].color === MATERIAL_FAMILIES.P[0],
  fam.materials.map(function (m) { return m.code + ' ' + m.color; }));
sheet('Materials').getRange(3, 8).setValue('');
// owner moves the Color column to the end: still read by name
var data = rec.getDataRange().getValues();
var reordered = data.map(function (r) { var c = r.slice(); var color = c.splice(5, 1)[0]; c.push(color); return c; });
rec.getRange(1, 1, reordered.length, reordered[0].length).setValues(reordered);
cfg = readConfig_();
check('recipe columns found by name after moving', cfg.products[2].color === '#FF00AA' && cfg.products[0].recipe.Y1 === 0.8, [cfg.products[2].color, cfg.products[0].recipe]);

// 10. report action
var rep = post({ key: s.key, action: 'report', day: today });
check('report returns month entries', rep.ok && rep.entries.length === 5, rep.entries && rep.entries.length);
var model = buildReportModel({ entries: rep.entries, config: rep.config, date: today, phones: rep.phones, source: 'sheet' });
check('today batches = 5 + 2', model.today.batches === 7, model.today.batches);
var y1 = model.today.materials.filter(function (m) { return m.code === 'Y1'; })[0];
check('Y1 today: 4 + 1 used', y1.used === 5 && y1.wasted === 0, y1);
var r1 = model.today.materials.filter(function (m) { return m.code === 'R1'; })[0];
check('R1 spill was deleted, so nothing wasted', r1.wasted === 0, r1);
var p2m = model.month.materials.filter(function (m) { return m.code === 'P2'; })[0];
check('P2 month: 0.5 + 0.4 used, 0.1 wasted', p2m.used === 0.9 && p2m.wasted === 0.1 && p2m.total === 1, p2m);
check('reason read back as key', model.month.reasons.length === 1 && model.month.reasons[0].reason === 'failed', model.month.reasons);

// 11. sheet-column guard
var en = sheet('Entries');
en.getRange(1, 1).setValue('Day');
var bad = post({ key: s.key, action: 'sync', phone: 'Phone A', entries: [mk('zz', { type: 'production', product: 'x', batches: 1, lines: [] })] });
check('renamed column is caught, not written', !bad.ok && bad.error.indexOf('sheet-columns-changed') === 0 && rows('Entries').length === 5, bad);
en.getRange(1, 1).setValue('Date');

// 12. daily email
setSetting_('Report hour', 0);
hourlyCheck();
check('email sent once', __mail.length === 1, __mail.length);
check('email to owner by default', __mail[0] && __mail[0].to === 'owner@example.com');
check('email subject', __mail[0] && __mail[0].subject.indexOf('Prism daily report') === 0, __mail[0] && __mail[0].subject);
check('email has html + text', __mail[0] && __mail[0].htmlBody.indexOf('<table') >= 0 && __mail[0].body.indexOf('== Today ==') >= 0);
check('last sent recorded as text', readSettings_().lastSent === today, readSettings_().lastSent);
hourlyCheck();
check('not sent twice in a day', __mail.length === 1, __mail.length);
setSetting_('Report email', 'boss@example.com, plant@example.com');
sendReportNow();
check('send-now uses Report email', __mail.length === 2 && __mail[1].to === 'boss@example.com, plant@example.com', __mail[1] && __mail[1].to);

// 13. doGet
check('doGet works', JSON.parse(doGet().getContent()).ok === true);

// 14. garbled text (Mac Roman copy) is repaired; good text is left alone
var garbled = [
  ['Sample \u00b7 1 batch = 1 kg', 'Sample \u00ac\u2211 1 batch = 1 kg'],
  ['\u0928\u092e\u0942\u0928\u093e \u00b7 1 \u092c\u0948\u091a = 1 kg', '\u2021\u00a7\u00ae\u2021\u00a7\u00c6\u2021\u2022\u00c7\u2021\u00a7\u00ae\u2021\u00a7\u00e6 \u00ac\u2211 1 \u2021\u00a7\u00a8\u2021\u2022\u00e0\u2021\u00a7\u00f6 = 1 kg'],
  ['\u092c\u094b\u0930\u0940', '\u2021\u00a7\u00a8\u2021\u2022\u00e3\u2021\u00a7\u221e\u2021\u2022\u00c4'],
  ['Prism \u2014 Daily report', 'Prism \u201a\u00c4\u00ee Daily report'],
  ['1\u201312 Nov', '1\u201a\u00c4\u00ec12 Nov'],
  ['caf\u00e9 \u270f\ufe0f \ud83d\udca7', 'caf\u221a\u00a9 \u201a\u00fa\u00e8\u00d4\u220f\u00e8 \uf8ff\u00fc\u00ed\u00df']
];
garbled.forEach(function (p) { check('fixes garbled ' + p[0], fixGarbled_(p[1]) === p[0], fixGarbled_(p[1])); });
check('fixes text garbled twice', fixGarbled_(garbled[1][1].split('').map(function (ch) {
  var b = []; unescape(encodeURIComponent(ch)).split('').forEach(function (c) { b.push(c.charCodeAt(0)); });
  return b.map(function (x) { return x < 128 ? String.fromCharCode(x) : MAC_ROMAN_.charAt(x - 128); }).join('');
}).join('')) === garbled[1][0]);
garbled.forEach(function (p) { check('leaves good text alone: ' + p[0], fixGarbled_(p[0]) === p[0]); });
check('leaves numbers and dates alone', fixGarbled_(25) === 25 && fixGarbled_('') === '');
check('leaves odd but real text alone', fixGarbled_('¬ 5 ∑') === '¬ 5 ∑' && fixGarbled_('Ä') === 'Ä');
sheet('Recipes').getRange(2, 3).setValue(garbled[0][1]);
sheet('Materials').getRange(2, 6).setValue(garbled[2][1]);
setup();
check('setup repairs garbled cells', sheet('Recipes').getRange(2, 3).getValue() === garbled[0][0] && sheet('Materials').getRange(2, 6).getValue() === garbled[2][0],
  [sheet('Recipes').getRange(2, 3).getValue(), sheet('Materials').getRange(2, 6).getValue()]);
check('repair leaves the rest of the sheet alone', rows('Recipes').length === 3 && rows('Materials').length === 9 && repairText_(__ss) === 0);

// 15. raw material stock
function sRow(code) { return rows('Stock').filter(function (r) { return r[0] === code; })[0]; }
function stockOf(list, code) { return list.filter(function (r) { return r.code === code; })[0]; }
var mailBefore = __mail.length;
var st = [
  mk('p0', { type: 'production', product: 'Y111', batches: 1, date: yesterday, time: '08:00', lines: [{ material: 'S2', qty: 5, unit: 'kg' }] }),
  mk('st1', { type: 'stock', move: 'in', material: 'S2', qty: 100, unit: 'kg', date: yesterday, time: '10:00', worker: 'Owner', phone: 'Admin', note: 'delivery', lines: [{ material: 'S2', qty: 100, unit: 'kg' }] }),
  mk('p1', { type: 'production', product: 'Y111', batches: 1, time: '09:00', lines: [{ material: 'S2', qty: 30, unit: 'kg' }] }),
  mk('w1', { type: 'waste', material: 'S2', qty: 10, unit: 'kg', reason: 'spill', lines: [{ material: 'S2', qty: 10, unit: 'kg' }] }),
  mk('st2', { type: 'stock', move: 'out', material: 'S2', qty: 5, unit: 'kg', time: '12:00', worker: 'Owner', phone: 'Admin', lines: [{ material: 'S2', qty: 5, unit: 'kg' }] }),
];
res = post({ key: s.key, action: 'sync', phone: 'Admin', worker: 'Owner', entries: st });
check('stock entries sync', res.ok && res.saved.length === 5, res);
var stRows = rows('Entries').filter(function (r) { return r[colOf_('id') - 1] === 'st1' || r[colOf_('id') - 1] === 'st2'; });
check('stock rows labelled Stock in / Stock out', stRows.length === 2 && stRows[0][colOf_('type') - 1] === 'Stock in' && stRows[1][colOf_('type') - 1] === 'Stock out', stRows.map(function (r) { return r[colOf_('type') - 1]; }));
check('stock in Material Use', rows('Material Use').filter(function (r) { return r[9] === 'st1' && r[1] === 'Stock in' && r[3] === 100; }).length === 1);
var back = readAllEntries_().filter(function (e) { return e.id === 'st2'; })[0];
check('stock entry read back with direction', back.type === 'stock' && back.move === 'out' && back.qty === 5, back);
var stockNow = stockNow_();
var s2 = stockOf(stockNow, 'S2');
check('S2 left = 100 - 5 removed - 30 used - 10 wasted (batch before first stock ignored)', s2.tracked && s2.left === 55 && s2.used === 30 && s2.wasted === 10 && s2.removed === 5, s2);
check('S2 today: 5 removed, 30 used, 10 wasted', s2.day.removed === 5 && s2.day.used === 30 && s2.day.wasted === 10 && s2.day.added === 0, s2.day);
check('S2 counted since yesterday', s2.since === yesterday, s2.since);
check('materials without stock are not tracked', !stockOf(stockNow, 'Y1').tracked && stockOf(stockNow, 'Y1').left === 0);
check('stock yesterday = 100', stockOf(computeStock(readAllEntries_(), readConfig_(), yesterday), 'S2').left === 100);
check('Stock tab written', sRow('S2') && sRow('S2')[7] === 55 && sRow('S2')[9] === 'OK' && sRow('S2')[2] === yesterday, sRow('S2'));
check('Stock tab: untracked shown as not counted', sRow('Y1')[2] === 'not counted yet' && sRow('Y1')[7] === '', sRow('Y1'));
check('no alert email without an alert level', __mail.length === mailBefore, __mail.length - mailBefore);
var model2 = buildReportModel({ entries: readAllEntries_(), config: readConfig_(), date: today, source: 'sheet' });
check('stock entries are not counted as production or a worker', model2.today.workers.every(function (w) { return w.worker !== 'Owner'; }) && model2.today.entryCount === model.today.entryCount + 2, model2.today.workers);

// alert level from the admin app
var bad1 = post({ key: s.key, action: 'setLowStock', material: 'S2', value: 'lots' });
check('bad alert level rejected', !bad1.ok && bad1.error === 'bad-number', bad1);
var bad2 = post({ key: s.key, action: 'setLowStock', material: 'Q9', value: 5 });
check('unknown material rejected', !bad2.ok && bad2.error === 'unknown-material', bad2);
var setRes = post({ key: s.key, action: 'setLowStock', material: 'S2', value: 60 });
check('alert level saved', setRes.ok && stockOf(setRes.config.materials, 'S2').lowStock === 60 && sheet('Materials').getRange(8, 9).getValue() === 60, setRes);
check('Materials has the alert column', sheet('Materials').getRange(1, 9).getValue() === 'Low stock alert');
check('S2 now low (55 < 60)', stockOf(setRes.stock, 'S2').low && sRow('S2')[9] === 'LOW');
check('low stock email sent at once', __mail.length === mailBefore + 1 && __mail[__mail.length - 1].subject.indexOf('low stock') >= 0 && __mail[__mail.length - 1].subject.indexOf('S2') >= 0, __mail[__mail.length - 1] && __mail[__mail.length - 1].subject);
check('low stock email lists left + alert level', __mail[__mail.length - 1].htmlBody.indexOf('55 kg') >= 0 && __mail[__mail.length - 1].htmlBody.indexOf('60 kg') >= 0);
post({ key: s.key, action: 'sync', phone: 'Admin', entries: [mk('p2', { type: 'production', product: 'Y111', batches: 1, time: '13:00', lines: [{ material: 'S2', qty: 1, unit: 'kg' }] })] });
hourlyCheck();
check('no repeat email while still low', __mail.length === mailBefore + 1, __mail.length - mailBefore);
post({ key: s.key, action: 'sync', phone: 'Admin', entries: [mk('st3', { type: 'stock', move: 'in', material: 'S2', qty: 50, unit: 'kg', time: '14:00', lines: [{ material: 'S2', qty: 50, unit: 'kg' }] })] });
check('back above the alert level after a delivery', stockOf(stockNow_(), 'S2').left === 104 && !stockOf(stockNow_(), 'S2').low && sRow('S2')[9] === 'OK');
post({ key: s.key, action: 'sync', phone: 'Admin', entries: [mk('p3', { type: 'production', product: 'Y111', batches: 1, time: '15:00', lines: [{ material: 'S2', qty: 50, unit: 'kg' }] })] });
check('falling low again emails again', __mail.length === mailBefore + 2, __mail.length - mailBefore);
var del3 = Object.assign({}, st[4], { status: 'deleted', updatedAt: '2026-11-03T04:00:00.000Z' });
post({ key: s.key, action: 'sync', phone: 'Admin', entries: [del3] });
check('deleting a stock entry undoes it', stockOf(stockNow_(), 'S2').left === 59, stockOf(stockNow_(), 'S2').left);

// stock + report actions, daily email
var stockRes = post({ key: s.key, action: 'stock' });
check('stock action', stockRes.ok && stockOf(stockRes.stock, 'S2').left === 59 && stockRes.today === today, stockRes);
var repRes = post({ key: s.key, action: 'report', day: today });
check('report action includes stock', repRes.ok && stockOf(repRes.stock, 'S2').left === 59);
sendReportNow();
var daily = __mail[__mail.length - 1];
check('daily email has the stock section', daily.htmlBody.indexOf('Raw material stock') >= 0 && daily.htmlBody.indexOf('59 kg') >= 0 && daily.body.indexOf('== Raw material stock') >= 0, daily.body);
check('daily email warns about low stock at the top', daily.htmlBody.indexOf('Low stock: S2') >= 0 && daily.htmlBody.indexOf('Low stock: S2') < daily.htmlBody.indexOf('Raw material stock'));
var clr = post({ key: s.key, action: 'setLowStock', material: 'S2', value: '' });
check('alert level cleared', clr.ok && stockOf(clr.config.materials, 'S2').lowStock === 0 && !stockOf(clr.stock, 'S2').low && sheet('Materials').getRange(8, 9).getValue() === '');
setup();
check('setup keeps stock tab + alert column', sheet('Stock') && sRow('S2')[7] === 59 && sheet('Materials').getRange(1, 9).getValue() === 'Low stock alert');

// 16. spoiled batch that was already recorded as made
var oldSheetHead = sheet('Entries').getRange(1, ENTRY_COLS.length).getValue();
check('Entries has the Already made column', oldSheetHead === 'Already made', oldSheetHead);
sheet('Entries').getRange(1, ENTRY_COLS.length).setValue('');
var spoilA = mk('sp1', { type: 'waste', product: 'Y111', batches: 1, reason: 'failed', madeBefore: true, time: '16:00', lines: [{ material: 'S2', qty: 7, unit: 'kg' }] });
var spoilB = mk('sp2', { type: 'waste', product: 'Y111', batches: 1, reason: 'failed', madeBefore: false, time: '16:05', lines: [{ material: 'S2', qty: 3, unit: 'kg' }] });
var before16 = stockOf(stockNow_(), 'S2').left;
res = post({ key: s.key, action: 'sync', phone: 'Phone A', entries: [spoilA, spoilB] });
check('older sheet gets the new column header by itself', res.ok && sheet('Entries').getRange(1, ENTRY_COLS.length).getValue() === 'Already made', res);
var spRow = rows('Entries').filter(function (r) { return r[colOf_('id') - 1] === 'sp1'; })[0];
check('Already made written as Yes', spRow[colOf_('madeBefore') - 1] === 'Yes', spRow[colOf_('madeBefore') - 1]);
var spBack = readAllEntries_().filter(function (e) { return e.id === 'sp1' || e.id === 'sp2'; });
check('Already made read back', spBack[0].madeBefore === true && spBack[1].madeBefore === false, spBack);
check('only the not-recorded spoiled batch is taken off stock (3 kg, not 7)', stockOf(stockNow_(), 'S2').left === before16 - 3, [before16, stockOf(stockNow_(), 'S2').left]);
check('no Material Use rows for the already-made batch', rows('Material Use').filter(function (r) { return r[9] === 'sp1'; }).length === 0 && rows('Material Use').filter(function (r) { return r[9] === 'sp2'; }).length === 1);
var m16 = buildReportModel({ entries: readAllEntries_(), config: readConfig_(), date: today, source: 'sheet' });
var s2w = m16.today.materials.filter(function (m) { return m.code === 'S2'; })[0];
check('report: already-made batch is listed as waste but its raw material is not counted again', s2w.wasted === 13 && m16.today.waste.some(function (w) { return w.madeBefore; }), s2w);
check('email text marks it', renderReportText(m16, 'en').indexOf('already counted in Batches made') >= 0);
var matWaste = cleanEntry_({ id: 'x', type: 'waste', material: 'S2', qty: 1, madeBefore: true, lines: [] });
check('raw material waste can never be marked already made', matWaste.madeBefore === false);

// 17. the owner corrects a number by hand in the Entries tab
function rowNum(id) { return rows('Entries').findIndex(function (r) { return r[colOf_('id') - 1] === id; }) + 2; }
function entryBack(id) { return readAllEntries_().filter(function (e) { return e.id === id; })[0]; }
post({ key: s.key, action: 'sync', phone: 'Phone A', entries: [
  mk('h0', { type: 'stock', move: 'in', material: 'S3', qty: 100, unit: 'kg', time: '16:00', lines: [{ material: 'S3', qty: 100, unit: 'kg' }] }),
  mk('h1', { type: 'production', product: 'Y111', batches: 4, time: '17:00', lines: [{ material: 'S3', qty: 8, unit: 'kg' }] }),
] });
check('S3 before any hand edit: 100 in, 8 used', stockOf(stockNow_(), 'S3').left === 92, stockOf(stockNow_(), 'S3').left);
sheet('Entries').getRange(rowNum('h1'), colOf_('batches')).setValue(1); // 4 batches -> 1
check('hand-edited Batches scales the raw material (8 -> 2)', entryBack('h1').lines[0].qty === 2, entryBack('h1').lines);
check('hand-edited Batches moves the stock with it (92 -> 98)', stockOf(stockNow_(), 'S3').left === 98, stockOf(stockNow_(), 'S3').left);
var handModel = buildReportModel({ entries: readAllEntries_(), config: readConfig_(), date: today, source: 'sheet' });
check('the report follows the hand edit', handModel.today.materials.filter(function (m) { return m.code === 'S3'; })[0].used === 2);

post({ key: s.key, action: 'sync', phone: 'Phone A', entries: [
  mk('h2', { type: 'waste', material: 'S3', qty: 10, unit: 'kg', reason: 'spill', time: '18:00', lines: [{ material: 'S3', qty: 10, unit: 'kg' }] }) ] });
check('waste of 10 kg takes S3 to 88', stockOf(stockNow_(), 'S3').left === 88, stockOf(stockNow_(), 'S3').left);
sheet('Entries').getRange(rowNum('h2'), colOf_('qty')).setValue(4); // 10 kg -> 4
check('hand-edited Qty scales the waste too (88 -> 94)', stockOf(stockNow_(), 'S3').left === 94, stockOf(stockNow_(), 'S3').left);
sheet('Entries').getRange(rowNum('h2'), colOf_('linesJson')).setValue('[{"material":"S3","qty":4,"unit":"kg"}]');
sheet('Entries').getRange(rowNum('h2'), colOf_('qty')).setValue(2);
check('a row written by an older version is read, but cannot follow the edit', entryBack('h2').lines[0].qty === 4, entryBack('h2').lines);

// 18. the owner inserts a column in the Materials tab
var mSheet = sheet('Materials');
mSheet.data = mSheet.data.map(function (r, i) { var c = r.slice(); c.splice(2, 0, i === 0 ? 'Supplier' : 'ACME'); return c; });
var cfgIns = readConfig_();
check('an inserted Materials column does not scramble the materials',
  cfgIns.materials[0].code === 'R1' && cfgIns.materials[0].unit === 'kg' && cfgIns.materials[0].containers.length === 1 && cfgIns.materials[0].containers[0].size === 25,
  cfgIns.materials[0]);
check('and raises no false warnings', !cfgIns.warnings.some(function (w) { return w.indexOf('Materials') === 0; }), cfgIns.warnings);
var lowIns = post({ key: s.key, action: 'setLowStock', material: 'S3', value: 7 });
check('the alert level still goes into the right column', lowIns.ok && stockOf(lowIns.config.materials, 'S3').lowStock === 7, lowIns.error || lowIns.config);
mSheet.data = mSheet.data.map(function (r) { var c = r.slice(); c.splice(2, 1); return c; });
check('and is still there once the extra column goes', stockOf(readConfig_().materials, 'S3').lowStock === 7);
mSheet.getRange(1, 2).setValue('Naam');
check('a renamed heading is reported', readConfig_().warnings.some(function (w) { return w.indexOf('"Name" column heading') >= 0; }), readConfig_().warnings);
mSheet.getRange(1, 2).setValue('Name');

// 19. text that starts with "=" must never become a live formula
function fmtOf(tab, dataRow, col0) { return (sheet(tab).formats[dataRow] || {})[col0] || ''; }
post({ key: s.key, action: 'sync', phone: '=2+2', worker: '=1+1', entries: [
  mk('fz', { type: 'waste', material: '=A1', qty: 1, unit: '=B2', reason: 'spill', worker: '=IMPORTDATA("http://x.co")', phone: '=2+2', lines: [{ material: '=A1', qty: 1, unit: 'kg' }] }) ] });
var fzRow = rowNum('fz') - 1; // 0-based into the fake sheet's data
check('every text column of Entries is stored as plain text',
  ['material', 'unit', 'rawText', 'worker', 'phone', 'reason', 'type', 'status'].every(function (f) { return fmtOf('Entries', fzRow, colOf_(f) - 1) === '@'; }));
check('the two number columns of Entries are left as numbers',
  ['batches', 'qty'].every(function (f) { return fmtOf('Entries', fzRow, colOf_(f) - 1) !== '@'; }));
var useRow = sheet('Material Use').data.findIndex(function (r) { return r[9] === 'fz'; });
check('Material Use: every column but Qty is plain text',
  USE_TEXT_COLS.every(function (c) { return fmtOf('Material Use', useRow, c - 1) === '@'; }) && fmtOf('Material Use', useRow, 3) !== '@');
var phoneRow = sheet('Phones').data.findIndex(function (r) { return r[0] === '=2+2'; });
check('Phones: every column is plain text', [0, 1, 2, 3].every(function (c) { return fmtOf('Phones', phoneRow, c) === '@'; }));
check('Stock: the name and date columns are plain text', fmtOf('Stock', 1, 0) === '@' && fmtOf('Stock', 1, 1) === '@' && fmtOf('Stock', 1, 2) === '@');

// 20. impossible amounts and dates
var s3Before = stockOf(stockNow_(), 'S3').left;
post({ key: s.key, action: 'sync', phone: 'Phone A', entries: [
  mk('neg', { type: 'waste', material: 'S3', qty: -500, unit: 'kg', reason: 'spill', time: '19:00', lines: [{ material: 'S3', qty: -500, unit: 'kg' }] }) ] });
check('a negative waste can never ADD to stock', stockOf(stockNow_(), 'S3').left === s3Before, [s3Before, stockOf(stockNow_(), 'S3').left]);
check('a phone clock years out lands on the sheet\'s today', cleanEntry_({ id: 'd1', type: 'production', date: '2031-01-01' }).date === today);
check('a date years in the past lands on today too', cleanEntry_({ id: 'd2', type: 'production', date: '2019-05-05' }).date === today);
check('yesterday is still kept', cleanEntry_({ id: 'd3', type: 'production', date: yesterday }).date === yesterday);

// 21. phones that stopped being used
var phoneModel = buildReportModel({ entries: [], config: readConfig_(), date: today, source: 'sheet', phones: [
  { phone: 'Old phone', lastSync: addDays(today, -40) + ' 10:00', worker: 'X' },
  { phone: 'Today phone', lastSync: today + ' 08:00', worker: 'Y' },
  { phone: 'Quiet phone', lastSync: addDays(today, -2) + ' 08:00', worker: 'Z' },
] });
var phoneHtml = renderReportHtml(phoneModel, 'en');
check('only a phone seen in the last week is warned about', (phoneHtml.match(/NOT sent today/g) || []).length === 1, (phoneHtml.match(/NOT sent today/g) || []).length);
check('the long-gone phone is still listed, just not warned about', phoneHtml.indexOf('Old phone') >= 0);
check('the plain-text report warns about the same one only', (renderReportText(phoneModel, 'en').match(/NOT sent today/g) || []).length === 1);

console.log(__fails ? ('\n' + __fails + ' FAILED') : '\nALL PASSED');
