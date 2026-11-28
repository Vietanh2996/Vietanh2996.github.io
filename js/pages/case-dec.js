/* case-dec.js: DEC page "breakdown of UI layout" demo. Tabs (Dynamic Adaptive / Product list) and the radio list
   that swaps the widget image (images carry data-opt = radio value). Without JS the first option shows. */
(function () {
  var root = document.querySelector('[data-dec-demo]');
  if (!root) return;
  var tabs = root.querySelectorAll('[role=tab]');
  var panes = root.querySelectorAll('[role=tabpanel]');
  function select(i) {
    tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; });
    panes.forEach(function (p, k) { p.hidden = k !== i; });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i); });
    t.addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
      if (n === null) return;
      n = (n + tabs.length) % tabs.length; select(n); tabs[n].focus(); e.preventDefault();
    });
  });
  var imgs = root.querySelectorAll('.dec-stage [data-opt]');
  root.querySelectorAll('input[name=dec-opt]').forEach(function (r) {
    r.addEventListener('change', function () {
      imgs.forEach(function (im) { im.hidden = im.getAttribute('data-opt') !== r.value; });
    });
  });
})();

/* DEC s04: phones spread from the centre one every time the group scrolls into view (desktop only);
   once it is fully off screen it resets so the next visit replays it.
   Hand-written open spring copied from spotlight.js: k=650, c=32, m=1, semi-implicit Euler, 1/240 s substeps, dt cap 1/30 s. */
(function () {
  var wrap = document.querySelector('.dec-phones');
  if (!wrap || !('IntersectionObserver' in window) || !window.matchMedia) return;
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var els = wrap.querySelectorAll('.dec-phone');
  if (els.length !== 3) return;
  var K = 650, C = 32, DELAY = [20, 0, 40]; /* left, middle, right */
  var mid = els[1].offsetLeft + els[1].offsetWidth / 2;
  var u = [];
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  for (var i = 0; i < 3; i++) {
    u.push({ el: els[i], side: i !== 1, dx: mid - (els[i].offsetLeft + els[i].offsetWidth / 2), p: 0, v: 0, at: 0, done: false });
  }
  function draw(o) {
    var p = o.p;
    if (o.side) {
      o.el.style.transform = 'translateX(' + (o.dx * (1 - p)).toFixed(2) + 'px) scale(' + (0.88 + 0.12 * p).toFixed(4) + ')';
      o.el.style.opacity = clamp(p / 0.35, 0, 1).toFixed(3);
    } else {
      o.el.style.transform = 'scale(' + (0.94 + 0.06 * p).toFixed(4) + ')';
    }
  }
  var lastT = 0, raf = 0, state = 'reset'; /* reset | run | done */
  function reset() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    wrap.classList.add('is-primed');
    for (var j = 0; j < 3; j++) { u[j].p = 0; u[j].v = 0; u[j].done = false; draw(u[j]); }
    state = 'reset';
  }
  reset();
  function tick(now) {
    var dt = Math.min((now - lastT) / 1000, 1 / 30), busy = false, n, h, s, j, o;
    lastT = now;
    n = Math.max(1, Math.round(dt * 240)); h = dt / n;
    for (j = 0; j < 3; j++) {
      o = u[j];
      if (o.done) continue;
      if (now >= o.at) {
        for (s = 0; s < n; s++) {
          o.v += (-K * (o.p - 1) - C * o.v) * h;
          o.p += o.v * h;
        }
      }
      if (now < o.at || Math.abs(o.p - 1) >= 0.001 || Math.abs(o.v) >= 0.01) busy = true;
      draw(o);
    }
    if (busy) { raf = requestAnimationFrame(tick); return; }
    raf = 0; state = 'done';
    for (j = 0; j < 3; j++) {
      u[j].el.style.transform = ''; u[j].el.style.opacity = ''; u[j].el.style.willChange = '';
    }
    wrap.classList.remove('is-primed');
  }
  var io = new IntersectionObserver(function (ents) {
    var e = ents[ents.length - 1];
    if (!e.isIntersecting) { if (state !== 'reset') reset(); return; }
    if (state !== 'reset' || e.intersectionRatio < 0.35) return;
    state = 'run';
    var t0 = performance.now();
    for (var j = 0; j < 3; j++) u[j].at = t0 + DELAY[j];
    lastT = t0;
    raf = requestAnimationFrame(tick);
  }, { threshold: [0, 0.35] });
  io.observe(wrap);
})();
