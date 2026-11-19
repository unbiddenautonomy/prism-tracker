// The small pile of entries still waiting to reach the sheet, kept where the service
// worker can read it. The app's own store is localStorage, which a service worker
// cannot open, so what is still waiting is mirrored here in IndexedDB instead.
// Plain script on purpose: the app loads it with a <script> tag and the service
// worker with importScripts, so there is only one copy of this code.
(function () {
  var DB_NAME = 'prism';
  var STORE = 'outbox';
  var WAITING = 'waiting'; // { url, key, phone, worker, appVersion, entries: [...] }
  var SENT = 'sent'; // [{ id, updatedAt }] the worker got through while the app was shut

  function open() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function work(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var answer;
        fn(tx.objectStore(STORE), function (v) {
          answer = v;
        });
        tx.oncomplete = function () {
          db.close();
          resolve(answer);
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error);
        };
        tx.onabort = function () {
          db.close();
          reject(tx.error);
        };
      });
    });
  }

  self.PrismOutbox = {
    // What is waiting, or null.
    read: function () {
      return work('readonly', function (store, set) {
        var r = store.get(WAITING);
        r.onsuccess = function () {
          set(r.result || null);
        };
      });
    },
    save: function (record) {
      return work('readwrite', function (store) {
        store.put(record, WAITING);
      });
    },
    clear: function () {
      return work('readwrite', function (store) {
        store.delete(WAITING);
      });
    },
    // The worker notes what the sheet accepted; the app picks it up when it next opens.
    addSent: function (pairs) {
      if (!pairs || !pairs.length) return Promise.resolve();
      return work('readwrite', function (store) {
        var r = store.get(SENT);
        r.onsuccess = function () {
          store.put((r.result || []).concat(pairs), SENT);
        };
      });
    },
    takeSent: function () {
      return work('readwrite', function (store, set) {
        var r = store.get(SENT);
        r.onsuccess = function () {
          set(r.result || []);
          store.delete(SENT);
        };
      });
    },
  };
})();
