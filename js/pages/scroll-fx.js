/* Hero scroll effect: the text cluster only shrinks (around its own centre), the 4 images parallax at different depths.
   Transform-only, rAF lerp toward the scroll target, passive listener, will-change only while moving.
   Writes only .hero-fx (cluster wrapper) and .hero-img (image wrappers), never the elements intro.js / spotlight.js transform.
   ?tune adds a "Cuộn" panel. */
(function () {
  'use strict';
  var CFG = {
    endScale: .6,      // cluster scale at the end of the range
    range: 1000,       // scroll distance (px) over which the cluster shrinks
    parallax: 1,       // global multiplier on every image factor
    smooth: .88        // 0..1, higher = smoother / lazier (lerp step = 1 - smooth per 1/60s)
  };
  var IMGS = [          // factor: extra upward px per scroll px (x parallax); scale: scale change at the end of the range
    { sel: '.hero-img--apps', factor: .25, scale: -.04 },   // far, slow
    { sel: '.hero-img--street', factor: 1.05, scale: .08 }, // near, fastest: slides over apps
    { sel: '.hero-img--dark', factor: .35, scale: -.02 },   // far, slow
    { sel: '.hero-img--moto', factor: .85, scale: .06 }     // near, fast: slides over dark
  ];

  var fx = document.querySelector('.hero-fx');
  if (!fx) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  IMGS.forEach(function (o) { o.el = document.querySelector(o.sel); });
  IMGS = IMGS.filter(function (o) { return o.el; });

  var cur = 0, target = window.scrollY || 0, raf = 0, last = 0, moving = false, k = 1;
  function readK() { k = parseFloat(getComputedStyle(root).getPropertyValue('--stage-scale')) || 1; }
  function ease(p) { return 1 - Math.pow(1 - p, 3); }   // out-cubic: shrinks fast first, so it reads early

  function setWill(on) {
    if (on === moving) return; moving = on;
    var v = on ? 'transform' : '';
    fx.style.willChange = v; IMGS.forEach(function (o) { o.el.style.willChange = v; });
  }
  function apply(y) {
    var p = Math.min(Math.max(y / Math.max(CFG.range, 1), 0), 1), e = ease(p);
    // cluster: scale only, origin = centre of the cluster box (css), so it moves only with the page
    fx.style.transform = 'scale(' + (1 + (CFG.endScale - 1) * e).toFixed(4) + ')';
    IMGS.forEach(function (o) {
      o.el.style.transform = 'translate3d(0,' + (-o.factor * CFG.parallax * y / k).toFixed(2) + 'px,0) scale(' + (1 + o.scale * e).toFixed(4) + ')';
    });
  }
  function frame(t) {
    raf = 0;
    var dt = Math.min((t - last) / 16.667, 4) || 1; last = t;
    var step = 1 - Math.pow(Math.min(Math.max(CFG.smooth, 0), .995), dt);   // frame-rate independent lerp
    cur += (target - cur) * step;
    if (Math.abs(target - cur) < .05) { cur = target; apply(cur); setWill(false); return; }
    apply(cur); raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) { setWill(true); last = performance.now(); raf = requestAnimationFrame(frame); } }
  function onScroll() { target = window.scrollY || 0; kick(); }

  if (!reduced) {
    readK(); cur = target; apply(cur);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { readK(); apply(cur); });
  }

  /* ---------- ?tune: "Cuộn" panel (top-right; intro panel is bottom-left, spotlight bottom-right) ---------- */
  if (/[?&]tune\b/.test(location.search)) {
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;right:12px;top:72px;z-index:100;width:230px;padding:10px 12px;background:#fff;' +
      'border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.2);font:12px/1.4 system-ui,sans-serif;color:#111';
    var title = document.createElement('div'); title.textContent = 'Cuộn'; title.style.cssText = 'font-weight:600;margin-bottom:4px';
    panel.appendChild(title);
    [['endScale', 'Scale cuối (×)', .2, 1, .01], ['range', 'Quãng cuộn (px)', 300, 2000, 10],
     ['parallax', 'Độ parallax chung (×)', 0, 2.5, .05], ['smooth', 'Độ mượt (cao = mượt)', .5, .98, .01]].forEach(function (d) {
      var row = document.createElement('label'), name = document.createElement('div'), out = document.createElement('b'), inp = document.createElement('input');
      row.style.cssText = 'display:block;margin:4px 0';
      out.style.cssText = 'float:right;font-weight:600'; out.textContent = CFG[d[0]];
      name.textContent = d[1]; name.appendChild(out);
      inp.type = 'range'; inp.min = d[2]; inp.max = d[3]; inp.step = d[4]; inp.value = CFG[d[0]]; inp.style.width = '100%';
      inp.addEventListener('input', function () { CFG[d[0]] = +inp.value; out.textContent = inp.value; apply(cur); });
      row.appendChild(name); row.appendChild(inp); panel.appendChild(row);
    });
    var cp = document.createElement('button');
    cp.type = 'button'; cp.textContent = 'Copy số'; cp.style.cssText = 'margin-top:6px;font:inherit;padding:3px 10px';
    cp.addEventListener('click', function () {
      var t = 'var CFG = ' + JSON.stringify(CFG) + ';';
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      cp.textContent = 'Đã copy'; setTimeout(function () { cp.textContent = 'Copy số'; }, 1000);
    });
    panel.appendChild(cp);
    document.body.appendChild(panel);
  }
})();
