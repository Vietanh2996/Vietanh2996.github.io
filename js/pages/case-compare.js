/* case-compare.js: before/after slider. Markup + CSS: .case-compare in css/pages/case-oneu.css.
   Each [data-compare] has an <input type="range" class="case-compare__range"> as the source of truth (keyboard + a11y);
   pointer/touch drag on .case-compare__stage writes into it. Sets --pos (0-100%) on the root. */
(function () {
  document.querySelectorAll('[data-compare]').forEach(function (root) {
    var stage = root.querySelector('.case-compare__stage');
    var range = root.querySelector('.case-compare__range');
    if (!stage || !range) return;
    function set(v) {
      v = Math.max(0, Math.min(100, v));
      range.value = v;
      root.style.setProperty('--pos', v + '%');
      range.setAttribute('aria-valuetext', Math.round(v) + '% before');
    }
    function fromX(x) {
      var r = stage.getBoundingClientRect();
      set((x - r.left) / r.width * 100);
    }
    var dragging = false;
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      stage.setPointerCapture(e.pointerId);
      fromX(e.clientX);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', function (e) { if (dragging) fromX(e.clientX); });
    function end(e) { dragging = false; try { stage.releasePointerCapture(e.pointerId); } catch (_) {} }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    range.addEventListener('input', function () { set(parseFloat(range.value)); });
    set(parseFloat(range.value) || 50);
  });
})();
