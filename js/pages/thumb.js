/* Cursor layer: viewport-size vars for the wander keyframes. (The visitor's own cursor is the OS cursor with the green arrow, css only.) */
(function () {
  'use strict';
  var layer = document.getElementById('cursor-layer');
  if (!layer) return;

  function sizeVars() {
    layer.style.setProperty('--vw', layer.clientWidth + 'px');
    layer.style.setProperty('--vh', layer.clientHeight + 'px');
  }
  sizeVars();
  window.addEventListener('resize', sizeVars);
  if (window.ResizeObserver) new ResizeObserver(sizeVars).observe(layer);

})();
