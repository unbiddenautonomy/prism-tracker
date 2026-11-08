// Runs before the page draws: picks light/dark so there is no flash.
(function () {
  var t = null;
  try {
    t = (JSON.parse(localStorage.getItem('prism.settings.v1') || '{}') || {}).theme;
  } catch (e) {
    t = null;
  }
  if (t !== 'light' && t !== 'dark') t = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#F3F5F9' : '#0A0F18');
})();
