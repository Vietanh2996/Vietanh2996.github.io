/* Top-left pill, right label: name of the section under the viewport's vertical middle.
   Names come from data-section-name on each section. Text swaps slide+fade (WAAPI),
   the label width springs to the new text (rAF). Reduced motion swaps instantly. */
(function () {
  'use strict';
  var track = document.getElementById('pl-track');
  if (!track) return;

  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-section-name]'));
  if (!sections.length) return;

  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var TEXT_MS = 250;
  var SPRING_K = 260;   // stiffness
  var SPRING_C = 26;    // damping (slightly under-damped: a small settle, no wobble)

  var current = null;   // name currently shown
  var width = 0;        // animated width, CSS px (layout px, not scaled)
  var widthTarget = 0;
  var velocity = 0;
  var springRaf = 0;
  var lastTs = 0;
  var scrollRaf = 0;

  function liveItem() {
    return track.querySelector('.pl-item:not(.is-out)');
  }

  function setWidth(px) {
    width = px;
    track.style.width = px.toFixed(2) + 'px';
  }

  function spring(ts) {
    springRaf = 0;
    var dt = lastTs ? Math.min(1 / 30, (ts - lastTs) / 1000) : 1 / 60;
    lastTs = ts;
    var a = -SPRING_K * (width - widthTarget) - SPRING_C * velocity;
    velocity += a * dt;
    width += velocity * dt;
    if (Math.abs(width - widthTarget) < 0.2 && Math.abs(velocity) < 0.2) {
      setWidth(widthTarget);
      velocity = 0;
      lastTs = 0;
      return;
    }
    setWidth(width);
    springRaf = requestAnimationFrame(spring);
  }

  function animateWidth(to) {
    widthTarget = to;
    if (!springRaf) {
      lastTs = 0;
      springRaf = requestAnimationFrame(spring);
    }
  }

  function swap(name) {
    var prev = liveItem();
    var next = document.createElement('span');
    next.className = 'pl-item';
    next.textContent = name;
    track.appendChild(next);
    var newWidth = next.offsetWidth;   // layout width, unaffected by the pill's scale

    if (reduce.matches || !prev) {
      if (prev) track.removeChild(prev);
      if (springRaf) { cancelAnimationFrame(springRaf); springRaf = 0; }
      velocity = 0;
      setWidth(newWidth);
      return;
    }

    prev.classList.add('is-out');
    var outAnim = prev.animate(
      [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-6px)', opacity: 0 }],
      { duration: TEXT_MS, easing: 'cubic-bezier(0, 0, .2, 1)', fill: 'forwards' }
    );
    outAnim.onfinish = function () { if (prev.parentNode) prev.parentNode.removeChild(prev); };

    next.animate(
      [{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: TEXT_MS, easing: 'cubic-bezier(0, 0, .2, 1)' }
    );

    animateWidth(newWidth);
  }

  function show(name) {
    if (!name || name === current) return;
    current = name;
    swap(name);
  }

  function activeSection() {
    var y = window.innerHeight / 2;
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) return sections[i];
    }
    return null;   // in a gap between sections: keep the current label
  }

  function update() {
    scrollRaf = 0;
    var s = activeSection();
    if (s) show(s.getAttribute('data-section-name'));
  }

  function request() {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(update);
  }

  // Initial state: the markup's first item is the starting label.
  var first = liveItem();
  if (first) {
    current = first.textContent;
    setWidth(first.offsetWidth);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      var item = liveItem();
      if (item && !springRaf) setWidth(item.offsetWidth);
    });
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
})();
