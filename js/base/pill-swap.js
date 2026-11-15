/* Pill label swap (FigJam top-left pill): text slides + fades (WAAPI, 250ms), the track width springs
   to the new text (rAF). Same motion as js/pages/section-indicator.js (home), packaged for pages that just need
   "swap this label for another on hover/focus".
   PillSwap.attach({ track, trigger, labels: ['Work', 'Back to home'] })
     track    .pl-track element holding one .pl-item (the first label)
     trigger  element whose hover / keyboard focus shows labels[1]; leaving / blur shows labels[0]
   Returns { show(name) }. Reduced motion swaps instantly. */
(function () {
  'use strict';
  var SPRING_K = 260, SPRING_C = 26, TEXT_MS = 250;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function create(track) {
    var current = null, width = 0, target = 0, velocity = 0, raf = 0, lastTs = 0;
    function live() { return track.querySelector('.pl-item:not(.is-out)'); }
    function setWidth(px) { width = px; track.style.width = px.toFixed(2) + 'px'; }
    function spring(ts) {
      raf = 0;
      var dt = lastTs ? Math.min(1 / 30, (ts - lastTs) / 1000) : 1 / 60;
      lastTs = ts;
      velocity += (-SPRING_K * (width - target) - SPRING_C * velocity) * dt;
      width += velocity * dt;
      if (Math.abs(width - target) < 0.2 && Math.abs(velocity) < 0.2) { setWidth(target); velocity = 0; lastTs = 0; return; }
      setWidth(width);
      raf = requestAnimationFrame(spring);
    }
    function animateWidth(to) {
      target = to;
      if (!raf) { lastTs = 0; raf = requestAnimationFrame(spring); }
    }
    function show(name) {
      if (!name || name === current) return;
      current = name;
      var prev = live();
      var next = document.createElement('span');
      next.className = 'pl-item';
      next.textContent = name;
      track.appendChild(next);
      var w = next.offsetWidth;
      if (reduce.matches || !prev) {
        if (prev) track.removeChild(prev);
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        velocity = 0; setWidth(w); return;
      }
      prev.classList.add('is-out');
      prev.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-6px)', opacity: 0 }],
        { duration: TEXT_MS, easing: 'cubic-bezier(0, 0, .2, 1)', fill: 'forwards' })
        .onfinish = function () { if (prev.parentNode) prev.parentNode.removeChild(prev); };
      next.animate([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: TEXT_MS, easing: 'cubic-bezier(0, 0, .2, 1)' });
      animateWidth(w);
    }
    var first = live();
    if (first) {
      current = first.textContent;
      setWidth(first.offsetWidth);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
        var it = live(); if (it && !raf) setWidth(it.offsetWidth);
      });
    }
    return { show: show };
  }

  function attach(opts) {
    var sw = create(opts.track), labels = opts.labels, t = opts.trigger;
    t.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') sw.show(labels[1]); });
    t.addEventListener('pointerleave', function () { sw.show(labels[0]); });
    t.addEventListener('focus', function () { sw.show(labels[1]); });
    t.addEventListener('blur', function () { sw.show(labels[0]); });
    return sw;
  }

  window.PillSwap = { create: create, attach: attach };
})();
