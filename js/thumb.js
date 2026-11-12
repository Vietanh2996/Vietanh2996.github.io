/* Cursor layer: viewport-size vars for the wander keyframes + the visitor's own "You" cursor (whole page). */
(function () {
  'use strict';
  var layer = document.getElementById('cursor-layer');
  var you = document.getElementById('you-cursor');
  if (!layer) return;
  var root = document.documentElement;

  function sizeVars() {
    layer.style.setProperty('--vw', layer.clientWidth + 'px');
    layer.style.setProperty('--vh', layer.clientHeight + 'px');
  }
  sizeVars();
  window.addEventListener('resize', sizeVars);
  if (window.ResizeObserver) new ResizeObserver(sizeVars).observe(layer);

  // "You": transform-only, one write per frame, replaces the native cursor on the whole page
  if (!you || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var HX = 5.7, HY = 5.8;                 // arrow tip inside the 56px cursor box
  var cx = 0, cy = 0, raf = 0, k = 1;
  function readScale() {
    var cs = getComputedStyle(root);
    k = (parseFloat(cs.getPropertyValue('--stage-scale')) || 1) * (parseFloat(cs.getPropertyValue('--cursor-scale')) || 1);
  }
  readScale();
  window.addEventListener('resize', readScale);
  function frame() {
    raf = 0;
    you.style.transform = 'translate3d(' + (cx - HX * k).toFixed(2) + 'px,' + (cy - HY * k).toFixed(2) + 'px,0) scale(' + k + ')';
  }
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    cx = e.clientX; cy = e.clientY;
    if (!you.classList.contains('is-on')) { readScale(); you.classList.add('is-on'); root.classList.add('has-you'); }
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });
  root.addEventListener('pointerleave', function () { you.classList.remove('is-on'); root.classList.remove('has-you'); });
})();
