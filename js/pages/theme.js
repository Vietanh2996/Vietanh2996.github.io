/* Light / dark toggle (css/base/theme.css). The <head> script already set data-theme before first paint
   (saved choice, else light); this only handles the button. */
(function () {
  'use strict';
  var root = document.documentElement, KEY = 'theme';
  var btn = document.querySelector('.theme-toggle');
  function apply(t) {
    root.setAttribute('data-theme', t);
    if (btn) { btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false'); btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); }
  }
  apply(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  if (btn) btn.addEventListener('click', function () {
    var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
  });
})();
