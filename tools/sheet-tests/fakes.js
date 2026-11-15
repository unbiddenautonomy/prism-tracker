// Minimal fake of the Google Apps Script services used by Code.gs, so the Sheet
// script can be tested on this Mac (run.sh). Like real Sheets, it turns
// date-looking text into Date objects unless the cell is formatted as text ('@').
var __mail = [];
var __props = {};
var __triggers = [];

function FakeRange(sheet, row, col, nr, nc) {
  this.sheet = sheet; this.row = row; this.col = col; this.nr = nr; this.nc = nc;
}
FakeRange.prototype.getValue = function () { return this.getValues()[0][0]; };
FakeRange.prototype.getFormulas = function () {
  return this.getValues().map(function (line) { return line.map(function () { return ''; }); });
};
FakeRange.prototype.getValues = function () {
  var out = [];
  for (var r = 0; r < this.nr; r++) {
    var line = [];
    for (var c = 0; c < this.nc; c++) {
      var rowArr = this.sheet.data[this.row - 1 + r] || [];
      var v = rowArr[this.col - 1 + c];
      line.push(v === undefined || v === null ? '' : v);
    }
    out.push(line);
  }
  return out;
};
FakeRange.prototype.setValues = function (vals) {
  if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error('setValues size mismatch ' + vals.length + 'x' + vals[0].length + ' vs ' + this.nr + 'x' + this.nc);
  for (var r = 0; r < this.nr; r++) {
    var ri = this.row - 1 + r;
    while (this.sheet.data.length <= ri) this.sheet.data.push([]);
    for (var c = 0; c < this.nc; c++) {
      var ci = this.col - 1 + c;
      var v = vals[r][c];
      var fmt = (this.sheet.formats[ri] || {})[ci];
      if (fmt !== '@' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        v = new Date(v.length === 10 ? v + 'T00:00:00' : v.replace(' ', 'T')); // what Sheets would do
      }
      if (fmt === '@' && typeof v === 'number') v = String(v);
      this.sheet.data[ri][ci] = v;
    }
  }
  return this;
};
FakeRange.prototype.setValue = function (v) { return this.setValues([[v]]); };
FakeRange.prototype.setNumberFormat = function (f) {
  for (var r = 0; r < this.nr; r++) {
    var ri = this.row - 1 + r;
    this.sheet.formats[ri] = this.sheet.formats[ri] || {};
    for (var c = 0; c < this.nc; c++) this.sheet.formats[ri][this.col - 1 + c] = f;
  }
  return this;
};
FakeRange.prototype.clearContent = function () {
  for (var r = 0; r < this.nr; r++) {
    var rowArr = this.sheet.data[this.row - 1 + r];
    if (rowArr) for (var c = 0; c < this.nc; c++) rowArr[this.col - 1 + c] = '';
  }
  return this;
};
FakeRange.prototype.setFontWeight = function () { return this; };
FakeRange.prototype.setBackground = function () { return this; };

function FakeSheet(name) { this.name = name; this.data = []; this.formats = {}; }
FakeSheet.prototype.getName = function () { return this.name; };
FakeSheet.prototype.getLastRow = function () {
  for (var i = this.data.length - 1; i >= 0; i--) {
    if ((this.data[i] || []).some(function (v) { return v !== '' && v != null; })) return i + 1;
  }
  return 0;
};
FakeSheet.prototype.getLastColumn = function () {
  var m = 0;
  this.data.forEach(function (r) { for (var i = r.length - 1; i >= 0; i--) if (r[i] !== '' && r[i] != null) { m = Math.max(m, i + 1); break; } });
  return m;
};
FakeSheet.prototype.getRange = function (row, col, nr, nc) {
  if (typeof row === 'string') throw new Error('A1 notation not supported in fake');
  if (row < 1 || col < 1) throw new Error('bad range ' + row + ',' + col);
  return new FakeRange(this, row, col, nr || 1, nc || 1);
};
FakeSheet.prototype.getDataRange = function () { return new FakeRange(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); };
FakeSheet.prototype.setFrozenRows = function () { return this; };
FakeSheet.prototype.deleteRow = function (i) {
  this.data.splice(i - 1, 1);
  var f = {};
  var self = this;
  Object.keys(this.formats).forEach(function (k) { var n = Number(k); if (n < i - 1) f[n] = self.formats[k]; else if (n > i - 1) f[n - 1] = self.formats[k]; });
  this.formats = f;
};

var __ss = {
  sheets: [new FakeSheet('Sheet1')],
  getSheetByName: function (n) { return this.sheets.find(function (s) { return s.name === n; }) || null; },
  insertSheet: function (n) { var s = new FakeSheet(n); this.sheets.push(s); return s; },
  getSheets: function () { return this.sheets.slice(); },
  deleteSheet: function (s) { this.sheets = this.sheets.filter(function (x) { return x !== s; }); },
  getId: function () { return 'fake-id'; },
  getName: function () { return 'Prism Production'; },
  getUrl: function () { return 'https://docs.google.com/spreadsheets/d/fake-id'; },
  getSpreadsheetTimeZone: function () { return 'Asia/Kolkata'; },
};

var SpreadsheetApp = {
  getActiveSpreadsheet: function () { return __ss; },
  openById: function () { return __ss; },
  getUi: function () { throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); },
};
var ContentService = {
  MimeType: { JSON: 'json' },
  createTextOutput: function (s) { return { content: s, setMimeType: function () { return this; }, getContent: function () { return this.content; } }; },
};
var LockService = { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } };
function __pad(n) { return (n < 10 ? '0' : '') + n; }
var Utilities = {
  formatDate: function (d, tz, pattern) {
    // the fake ignores tz and uses the Mac's local time
    var y = d.getFullYear(), M = __pad(d.getMonth() + 1), D = __pad(d.getDate()), H = d.getHours(), m = __pad(d.getMinutes());
    if (pattern === 'yyyy-MM-dd') return y + '-' + M + '-' + D;
    if (pattern === 'H') return String(H);
    if (pattern === 'yyyy-MM-dd HH:mm') return y + '-' + M + '-' + D + ' ' + __pad(H) + ':' + m;
    throw new Error('pattern ' + pattern);
  },
  getUuid: function () { return 'abcd1234-ef56-7890-abcd-ef1234567890'; },
};
var PropertiesService = { getScriptProperties: function () { return { setProperty: function (k, v) { __props[k] = v; }, getProperty: function (k) { return __props[k] || null; } }; } };
var ScriptApp = {
  getProjectTriggers: function () { return __triggers.slice(); },
  deleteTrigger: function (t) { __triggers = __triggers.filter(function (x) { return x !== t; }); },
  newTrigger: function (fn) {
    return { timeBased: function () { return { everyHours: function (h) { return { create: function () { var t = { fn: fn, h: h, getHandlerFunction: function () { return fn; } }; __triggers.push(t); return t; } }; } }; } };
  },
};
var MailApp = { sendEmail: function (o) { __mail.push(o); } };
var Session = { getEffectiveUser: function () { return { getEmail: function () { return 'owner@example.com'; } }; } };
var Logger = { log: function (m) { console.log('[Logger] ' + m); } };
