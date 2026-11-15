/* Shared stage scaler. A fixed-size design stage lives inside an element with
   data-stage-w / data-stage-h; this sets --stage-scale on that element.
   data-fit="contain": whole stage fits inside the element (the element fills the viewport).
   default: scale to the parent's width, never above 1. */
(function () {
  'use strict';
  var fits = document.querySelectorAll('[data-stage-w]');
  var FIT = window.__fit = { ui: 1.2, max: 1.1 };   // hero stage content: ui = size multiplier; max = cap on the fit before ui (1 = never bigger than the 1920 design × ui)
  var CHROME = window.__chromeFit = { ui: 1, max: .9 };   // fixed chrome + cursors (and the non-hero stages): keep the old on-screen size, independent of FIT
  function fitAll() {
    for (var i = 0; i < fits.length; i++) {
      var el = fits[i], w = +el.dataset.stageW, h = +el.dataset.stageH, s;
      var contain = el.dataset.fit === 'contain', raw, c;
      if (contain) raw = Math.min(el.clientWidth / w, el.clientHeight / h);
      else raw = Math.min(1, el.parentElement.clientWidth / w);
      c = Math.min(raw, CHROME.max) * CHROME.ui;                     // chrome / cursor scale (old numbers)
      s = contain ? Math.min(raw, FIT.max) * FIT.ui : c;             // cap first, then multiply: big screens end up exactly like the capped 1920 view
      el.style.setProperty('--stage-scale', s);
      el.style.setProperty('--chrome-scale', c);
      if (contain) { document.documentElement.style.setProperty('--stage-scale', s); /* for the fixed page canvas */ document.documentElement.style.setProperty('--chrome-scale', c); }
    }
  }
  FIT.refit = fitAll;
  fitAll();
  window.addEventListener('resize', fitAll);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(fitAll);
    for (var i = 0; i < fits.length; i++) ro.observe(fits[i].dataset.fit === 'contain' ? fits[i] : fits[i].parentElement);
  }
})();
