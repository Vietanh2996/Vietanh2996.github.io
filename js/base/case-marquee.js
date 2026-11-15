/* Case-page marquee: same behaviour as js/pages/marquee.js (home "Work" title), for .case-marquee on detail pages.
   rAF translateX loop, wraps at one copy width (seamless). Speed = base + BOOST * signed scroll velocity
   (down = faster left, up = reverses to the right), smoothed, capped; eases back to base when scrolling stops.
   Stops its rAF while offscreen. Reduced motion: static (CSS). Px are real CSS px scaled by banner height. */
(function () {
  'use strict';
  var BASE = 90;        // px/s at rest, for a 214px-tall strip (scaled with actual height)
  var BOOST = 0.2;      // extra px/s per px/s of scroll velocity
  var MAX_MULT = 6;
  var TAU_UP = 0.12, TAU_DOWN = 0.45;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var secs = document.querySelectorAll('.case-marquee');
  Array.prototype.forEach.call(secs, function (sec) {
    var track = sec.querySelector('.case-marquee__track');
    var img = track && track.querySelector('img');
    if (!img) return;
    track.style.animation = 'none';
    var x = 0, gw = 0, vel = 0, lastY = window.scrollY, lastT = 0, raf = 0, visible = false;
    function measure() { gw = img.getBoundingClientRect().width || gw; }
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    if (!img.complete) img.addEventListener('load', measure);
    measure();

    function frame(ts) {
      raf = 0;
      if (!visible) return;
      if (!gw) { measure(); if (!gw) { raf = requestAnimationFrame(frame); return; } }
      var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 1 / 60;
      lastT = ts;
      var y = window.scrollY;
      var inst = (y - lastY) / dt;
      lastY = y;
      var tau = Math.abs(inst) > Math.abs(vel) ? TAU_UP : TAU_DOWN;
      vel += (inst - vel) * (1 - Math.exp(-dt / tau));
      var k = (img.getBoundingClientRect().height || 214) / 214;
      var base = BASE * k, cap = base * MAX_MULT;
      var speed = Math.max(-cap, Math.min(cap, base + BOOST * vel));
      x = (((x + speed * dt) % gw) + gw) % gw;
      track.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)';
      window.__caseMarqueeSpeed = speed;
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) { lastT = 0; lastY = window.scrollY; raf = requestAnimationFrame(frame); } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[es.length - 1].isIntersecting;
        if (visible) start();
      }).observe(sec);
    } else { visible = true; start(); }
  });
})();
