/* Shared stage scaler. A fixed-size design stage lives inside an element with
   data-stage-w / data-stage-h; this sets --stage-scale on that element.
   data-fit="contain": whole stage fits inside the element (the element fills the viewport).
   default: scale to the parent's width, never above 1. */
(function () {
  'use strict';
  var fits = document.querySelectorAll('[data-stage-w]');
  var FIT = window.__fit = { ui: 1.2, max: 1.1 };   // hero stage content: ui = size multiplier; max = cap on the fit before ui (1 = never bigger than the 1920 design × ui)
  var CHROME = window.__chromeFit = { ui: 1, max: .9 };   // fixed chrome + cursors (and the non-hero stages): keep the old on-screen size, independent of FIT
  /* phones (<= 767px, see css/base/tokens.css; tablet keeps the desktop stage): a stage with data-mobile-w scales so that many stage px fill the width minus a 16px gutter each side (the rest of the
     1920 stage is cropped), instead of shrinking the whole stage. Chrome gets a fixed readable size. */
  var MOBILE = window.__mobileFit = { mq: window.matchMedia('(max-width: 767px)'), gutter: 16, chrome: .668, heroW: 390 - 32, heroH: 844 };
  function fitAll() {
    for (var i = 0; i < fits.length; i++) {
      var el = fits[i], w = +el.dataset.stageW, h = +el.dataset.stageH, s;
      var contain = el.dataset.fit === 'contain', raw, c;
      if (contain) raw = Math.min(el.clientWidth / w, el.clientHeight / h);
      else raw = Math.min(1, el.parentElement.clientWidth / w);
      c = Math.min(raw, CHROME.max) * CHROME.ui;                     // chrome / cursor scale (old numbers)
      s = contain ? Math.min(raw, FIT.max) * FIT.ui : c;             // cap first, then multiply: big screens end up exactly like the capped 1920 view
      if (MOBILE.mq.matches && el.dataset.mobileW) {
        s = (document.documentElement.clientWidth - 2 * MOBILE.gutter) / +el.dataset.mobileW;
        // full-screen hero: also fit the height, as if the screen were the 390x844 Figma frame (tablets / short screens would crop the photos)
        if (contain) s = Math.min(s, el.clientHeight * MOBILE.heroW / MOBILE.heroH / +el.dataset.mobileW);
        c = MOBILE.chrome;
      }
      el.style.setProperty('--stage-scale', s);
      el.style.setProperty('--chrome-scale', c);
      if (contain) { document.documentElement.style.setProperty('--stage-scale', s); /* for the fixed page canvas */ document.documentElement.style.setProperty('--chrome-scale', c); }
    }
  }
  FIT.refit = fitAll;
  fitAll();
  window.addEventListener('resize', fitAll);
  if (MOBILE.mq.addEventListener) MOBILE.mq.addEventListener('change', fitAll);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(fitAll);
    for (var i = 0; i < fits.length; i++) ro.observe(fits[i].dataset.fit === 'contain' ? fits[i] : fits[i].parentElement);
  }
})();
