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

console.log(__fails ? ('\n' + __fails + ' FAILED') : '\nALL PASSED');
