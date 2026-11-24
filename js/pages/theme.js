/* Light / dark toggle (css/base/theme.css). The <head> script already set data-theme before first paint
   (saved choice, else the OS setting); this only handles the button and follows OS changes until the visitor picks one. */
(function () {
  'use strict';
  var root = document.documentElement, KEY = 'theme';
  var btn = document.querySelector('.theme-toggle');
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
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
  var follow = function (e) { if (!saved()) apply(e.matches ? 'dark' : 'light'); };
  if (mq.addEventListener) mq.addEventListener('change', follow); else if (mq.addListener) mq.addListener(follow);
})();
