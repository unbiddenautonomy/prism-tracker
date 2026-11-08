// The admin app (admin.html) always opens on the Reports dashboard.
window.PRISM_ADMIN = true;
history.replaceState(null, '', location.pathname + location.search + '#/report');
