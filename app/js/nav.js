// Screen switching. Each screen is a "#/name/arg" address in the browser history,
// so the Android back button steps back one screen at a time.
let renderFn = () => {};

export function setRenderer(fn) {
  renderFn = fn;
}

export function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'home', args: parts.slice(1) };
}

function depth() {
  return (history.state && history.state.depth) || 0;
}

export function go(path) {
  history.pushState({ depth: depth() + 1 }, '', '#/' + path);
  renderFn();
}

export function replace(path) {
  history.replaceState({ depth: depth() }, '', '#/' + path);
  renderFn();
}

export function back() {
  if (depth() > 0) history.back();
  else replace('home');
}

// Jump back to a screen N steps from home (0 = home itself).
export function backToDepth(target) {
  const d = depth();
  if (d > target) history.go(target - d);
  else if (target === 0) replace('home');
}

export function goHome() {
  backToDepth(0);
}

export function initNav(start) {
  // Open on home (or reports for the admin link). Half-filled forms are not kept after a restart.
  history.replaceState({ depth: 0 }, '', '#/' + (start || 'home'));
  window.addEventListener('popstate', () => renderFn());
}
