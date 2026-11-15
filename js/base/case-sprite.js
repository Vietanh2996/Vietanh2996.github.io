/* case-sprite.js: pauses/plays every .case-sprite (see css/base/case.css) depending on whether it is on screen.
   Usage: <script src="js/base/case-sprite.js" defer></script> on case pages; markup example is at the top of the .case-sprite block in css/base/case.css.
   Starts paused (.is-paused) and removes it while the sprite intersects the viewport. */
(function () {
  var els = document.querySelectorAll('.case-sprite, .oneu-s12__stage');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) return; // no observer: just keep playing
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.classList.toggle('is-paused', !e.isIntersecting); });
  }, { rootMargin: '50px 0px' });
  els.forEach(function (el) { el.classList.add('is-paused'); io.observe(el); });
})();
