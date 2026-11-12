/* Shared stage scaler. A fixed-size design stage lives inside an element with
   data-stage-w / data-stage-h; this sets --stage-scale on that element.
   data-fit="contain": whole stage fits inside the element (the element fills the viewport).
   default: scale to the parent's width, never above 1. */
(function () {
  'use strict';
  var fits = document.querySelectorAll('[data-stage-w]');
  var FIT = window.__fit = { ui: 1, max: .9 };   // ui: global size multiplier; max: cap on the fit before ui (1 = never bigger than the 1920 design × ui)
  function fitAll() {
    for (var i = 0; i < fits.length; i++) {
      var el = fits[i], w = +el.dataset.stageW, h = +el.dataset.stageH, s;
      if (el.dataset.fit === 'contain') s = Math.min(el.clientWidth / w, el.clientHeight / h);
      else s = Math.min(1, el.parentElement.clientWidth / w);
      s = Math.min(s, FIT.max) * FIT.ui;   // cap first, then shrink: big screens end up exactly like the capped 1920 view
      el.style.setProperty('--stage-scale', s);
      if (el.dataset.fit === 'contain') document.documentElement.style.setProperty('--stage-scale', s); /* for the fixed page canvas */
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
