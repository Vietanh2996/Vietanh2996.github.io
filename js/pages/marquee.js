/* Marquee: rAF-driven translateX loop (stage px), wraps at one group width so it is seamless.
   Speed = base + BOOST * signed scroll velocity (down = faster left, up = reverses to the right), smoothed, capped; eases back to base (leftward) when scrolling stops.
   Stops its rAF while offscreen. Reduced motion: static. */
(function () {
  'use strict';
  var BASE = 90;        // stage px/s at rest
  var BOOST = 0.2;      // extra stage px/s per stage px/s of scroll velocity
  var MAX_MULT = 6;     // cap: speed never exceeds BASE * MAX_MULT
  var TAU_UP = 0.12;    // s, smoothing while scroll velocity rises
  var TAU_DOWN = 0.45;  // s, smoothing while it decays back to base

  var sec = document.querySelector('.marquee');
  if (!sec) return;
  var track = sec.querySelector('.m-track');
  var group = sec.querySelector('.m-group');
  if (!track || !group) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return; // CSS keeps it static

  // The CSS keyframe loop is replaced by this JS loop (marquee.css is owned elsewhere, so disable it here).
  track.style.animation = 'none';

  var x = 0, gw = group.offsetWidth, vel = 0, lastY = window.scrollY, lastT = 0, raf = 0, visible = false;

  function scale() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-scale')) || 1; }
  function measure() { gw = group.offsetWidth || gw; }
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  function frame(ts) {
    raf = 0;
    if (!visible) return;
    var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 1 / 60;
    lastT = ts;
    var y = window.scrollY;
    var inst = (y - lastY) / dt / scale(); // signed stage px/s: down +, up -
    lastY = y;
    var tau = Math.abs(inst) > Math.abs(vel) ? TAU_UP : TAU_DOWN;
    vel += (inst - vel) * (1 - Math.exp(-dt / tau));
    var cap = BASE * MAX_MULT;
    var speed = Math.max(-cap, Math.min(cap, BASE + BOOST * vel)); // negative = runs right (scrolling up)
    x = (((x + speed * dt) % gw) + gw) % gw;
    track.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)';
    window.__marqueeSpeed = speed;
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) { lastT = 0; lastY = window.scrollY; raf = requestAnimationFrame(frame); } }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      visible = es[es.length - 1].isIntersecting;
      if (visible) start();
    }).observe(sec);
  } else { visible = true; start(); }
})();
