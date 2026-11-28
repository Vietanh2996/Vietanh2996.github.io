/* Case top bar: hover / keyboard focus on "Work" slides the label to "Back to home" (js/base/pill-swap.js). */
(function () {
  'use strict';
  var back = document.getElementById('pl-back'), track = document.getElementById('pl-track');
  if (!back || !track || !window.PillSwap) return;
  /* labels follow the language (js/pages/lang.js, keys case.work / case.back) */
  var EN = ['Work', 'Back to home'], labels = EN.slice();
  function read() { if (window.I18N) { labels[0] = I18N.t('case.work', EN[0]); labels[1] = I18N.t('case.back', EN[1]); } }
  read();
  var sw = PillSwap.attach({ track: track, trigger: back, labels: labels });
  back.setAttribute('aria-label', labels[1]);
  document.addEventListener('langchange', function () {
    read(); back.setAttribute('aria-label', labels[1]);
    sw.show(back.matches(':hover, :focus-visible') ? labels[1] : labels[0]);
  });
})();
