/* Case top bar: hover / keyboard focus on "Work" slides the label to "Back to home" (js/base/pill-swap.js). */
(function () {
  'use strict';
  var back = document.getElementById('pl-back'), track = document.getElementById('pl-track');
  if (back && track && window.PillSwap) PillSwap.attach({ track: track, trigger: back, labels: ['Work', 'Back to home'] });
})();
