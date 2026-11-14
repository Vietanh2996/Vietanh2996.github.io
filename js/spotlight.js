(function () {
  'use strict';
  // spring config (live-editable with ?tune)
  var SPRING = { openK: 650, openC: 32, closeK: 550, closeC: 34, ringWidth: 6, parK: 120, parAmt: 2.2, parTilt: 7 };
  var stage = document.getElementById('stage');
  var fit = document.getElementById('stage-fit');
  var btn = document.getElementById('avatar-btn');
  var layers = stage.querySelectorAll('.layer, .person');
  var lastTouch = false;
  var isOpen = false;
  var skipFocus = false;
  var hoverTouch = window.matchMedia('(hover: none)');


  // ---------- spring engine: scalar progress p per unit, velocity kept across target changes ----------
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var photo = document.getElementById('avatar-photo');
  var personEl = document.getElementById('person');
  var groupEl = document.getElementById('avatar-group');
  var ringEl = document.getElementById('avatar-ring');
  ringEl.style.boxShadow = '0 0 0 ' + SPRING.ringWidth + 'px #fff, 0 1px 3px ' + SPRING.ringWidth + 'px rgba(0,0,0,.15), 0 0 .5px ' + SPRING.ringWidth + 'px rgba(0,0,0,.3)';
  function unit(el, o) { return { el: el, p: 0, v: 0, target: 0, pend: null, dIn: o.dIn, dOut: o.dOut, dx: o.dx, dy: o.dy, s0: o.s0, r0: o.r0, vis: null, sat: !!o.sat }; }
  var uPerson = unit(personEl, { dIn: 0, dOut: 30 });
  var units = [
    uPerson,
    unit(stage.querySelector('.layer--badge'),   { dIn: 20, dOut: 30, dx: 213.14,  dy: 184.93, s0: .4, r0: -25, sat: true }),
    unit(stage.querySelector('.layer--tagline'), { dIn: 40, dOut: 15, dx: -97.16,  dy: 352.65, s0: .4, r0: 20,  sat: true }),
    unit(stage.querySelector('.layer--card'),    { dIn: 60, dOut: 0,  dx: -345.25, dy: 167.04, s0: .4, r0: -30, sat: true })
  ];
  // pointer parallax: amp = px (stage px) at full deflection, tilt = gets rotateX/Y, kf = per-layer spring stiffness factor (lag differences)
  var parCfg = [[6, 0, .8], [22, 0, 1.1], [16, 1, 1], [14, 1, .9]];
  units.forEach(function (u, i) { u.amp = parCfg[i][0]; u.tilt = parCfg[i][1]; u.kf = parCfg[i][2]; u.ax = u.ay = u.avx = u.avy = 0; });
  var PT = { x: 0, y: 0 };
  function parEnabled() { return !reduced.matches && !hoverTouch.matches; }
  var raf = 0, lastT = 0;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  function render() {
    var i, u, p, s, w, par = parEnabled();
    for (i = 0; i < units.length; i++) {
      u = units[i]; p = u.p;
      u.px = u.py = u.rx = u.ry = u.rz = 0;
      if (par) {
        w = clamp(p, 0, 1) * SPRING.parAmt;
        u.px = u.ax * u.amp * w; u.py = u.ay * u.amp * w;
        if (u.tilt) { w = clamp(p, 0, 1) * SPRING.parTilt; u.ry = u.ax * w; u.rx = -u.ay * w; }
        else if (u.sat) u.rz = u.ax * clamp(p, 0, 1) * SPRING.parTilt * 1.5;
      }
      if (u.sat) {
        if (reduced.matches) continue; // CSS cross-fade
        u.el.style.transform = 'translate3d(' + (u.dx * (1 - p) + u.px).toFixed(2) + 'px,' + (u.dy * (1 - p) + u.py).toFixed(2) + 'px,0)' +
          (u.tilt ? ' rotateX(' + u.rx.toFixed(3) + 'deg) rotateY(' + u.ry.toFixed(3) + 'deg)' : '') + ' scale(' +
          (u.s0 + (1 - u.s0) * p).toFixed(4) + ') rotate(' + (u.r0 * (1 - p) + u.rz).toFixed(3) + 'deg)';
        u.el.style.opacity = clamp(p / 0.35, 0, 1).toFixed(3);
        var hide = p <= 0.001 && u.target === 0 && !u.pend;
        if (hide !== u.vis) { u.vis = hide; u.el.style.visibility = hide ? 'hidden' : 'visible'; }
      }
    }
    p = uPerson.p;
    groupEl.style.transform = 'translate3d(' + uPerson.px.toFixed(2) + 'px,' + uPerson.py.toFixed(2) + 'px,0) scale(' + (1 + 1.2032 * p).toFixed(4) + ')';
    personEl.style.clipPath = 'circle(' + (82.5 + 92.5 * clamp(p, 0, 1.15)).toFixed(2) + 'px at 81.208px 66.412px)';
    var po = (1 - clamp(p / 0.25, 0, 1)).toFixed(3);
    photo.style.opacity = po;
    ringEl.style.opacity = po;
  }

  function tick(now) {
    var dt = Math.min((now - lastT) / 1000, 1 / 30);
    lastT = now;
    var i, u, n, h, k, c, s, busy = false;
    for (i = 0; i < units.length; i++) {
      u = units[i];
      if (u.pend && now >= u.pend.at) { u.target = u.pend.target; u.pend = null; }
      n = Math.max(1, Math.round(dt * 240)); h = dt / n;
      k = u.target ? SPRING.openK : SPRING.closeK; c = u.target ? SPRING.openC : SPRING.closeC;
      for (s = 0; s < n; s++) {
        u.v += (-k * (u.p - u.target) - c * u.v) * h;
        u.p += u.v * h;
      }
      if (u.pend || Math.abs(u.p - u.target) >= 0.0005 || Math.abs(u.v) >= 0.005) busy = true;
      else { u.p = u.target; u.v = 0; }
      // parallax spring (separate from open/close), always integrated; weighting by u.p happens in render
      k = SPRING.parK * u.kf; c = 1.642 * Math.sqrt(k);
      var tx = parEnabled() ? PT.x : 0, ty = parEnabled() ? PT.y : 0;
      for (s = 0; s < n; s++) {
        u.avx += (-k * (u.ax - tx) - c * u.avx) * h; u.ax += u.avx * h;
        u.avy += (-k * (u.ay - ty) - c * u.avy) * h; u.ay += u.avy * h;
      }
      if (Math.abs(u.ax - tx) >= 0.0005 || Math.abs(u.ay - ty) >= 0.0005 || Math.abs(u.avx) >= 0.005 || Math.abs(u.avy) >= 0.005) busy = true;
      else { u.ax = tx; u.ay = ty; u.avx = u.avy = 0; }
    }
    render();
    raf = busy ? requestAnimationFrame(tick) : 0;
  }
  function setTargets(open) {
    var now = performance.now(), i, u, t = open ? 1 : 0;
    for (i = 0; i < units.length; i++) {
      u = units[i];
      if (reduced.matches) { u.pend = null; u.target = t; u.p = t; u.v = 0; continue; }
      var d = open ? u.dIn : u.dOut;
      if (d === 0) { u.pend = null; u.target = t; } // v is never reset
      else u.pend = { target: t, at: now + d };      // newer change replaces older pending switch
    }
    if (reduced.matches) { render(); return; }
    if (!raf) { lastT = now; raf = requestAnimationFrame(tick); }
  }
  render();

  function open() {
    if (isOpen) return;
    isOpen = true;
    setTargets(true);
    stage.classList.add('is-open');
    document.body.classList.add('is-spotlight');
    btn.setAttribute('aria-expanded', 'true');
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    PT.x = PT.y = 0;
    setTargets(false);
    stage.classList.remove('is-open');
    document.body.classList.remove('is-spotlight');
    btn.setAttribute('aria-expanded', 'false');
  }
  function isTouchEvent(e) { return e.pointerType === 'touch'; }

  // hover (mouse / pen): fixed zones in stage coords, with hysteresis.
  // Not tied to the animating elements, so a shrinking/growing layer passing
  // under a still pointer can never fire enter/leave and cause flicker.
  //  - OPEN zone: circle + padding (small) -> opens.
  //  - KEEP zone: whole open composition + generous padding, extra at the
  //    bottom where the person fades out (large) -> stays open while inside.
  // KEEP contains OPEN, so close can never immediately retrigger open.
  var CIRCLE = { x: 274.457, y: 407.028, r: 82.5 + 20 };
  var KEEP = { x1: -40, y1: -24, x2: 860, y2: 610 };
  var lastX = null, lastY = null, pointerInside = false;

  function toStage(cx, cy) {
    var r = stage.getBoundingClientRect();
    var s = r.width / 820;
    return { x: (cx - r.left) / s, y: (cy - r.top) / s };
  }
  function inOpenZone(p) {
    var dx = p.x - CIRCLE.x, dy = p.y - CIRCLE.y;
    return dx * dx + dy * dy <= CIRCLE.r * CIRCLE.r;
  }
  function inKeepZone(p) {
    return p.x >= KEEP.x1 && p.x <= KEEP.x2 && p.y >= KEEP.y1 && p.y <= KEEP.y2;
  }
  function wake() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }
  // pointer offset from the KEEP centre, -1..1; only a target for the parallax springs, never read by the zone tests
  function updatePar() {
    var nx = 0, ny = 0;
    if (isOpen && lastX !== null && parEnabled()) {
      var q = toStage(lastX, lastY);
      nx = clamp((q.x - (KEEP.x1 + KEEP.x2) / 2) / ((KEEP.x2 - KEEP.x1) / 2), -1, 1);
      ny = clamp((q.y - (KEEP.y1 + KEEP.y2) / 2) / ((KEEP.y2 - KEEP.y1) / 2), -1, 1);
    }
    if (nx !== PT.x || ny !== PT.y) { PT.x = nx; PT.y = ny; wake(); }
  }
  function evaluate() { evaluateZones(); updatePar(); }
  function evaluateZones() {
    if (lastX === null) return;
    var p = toStage(lastX, lastY);
    if (inOpenZone(p)) { pointerInside = true; open(); return; }
    if (inKeepZone(p)) {
      pointerInside = true;
      // out -> in -> out at the edge: follow live while the person is still visibly out
      if (!isOpen && uPerson.p > 0.25) open();
      return;
    }
    pointerInside = false;
    if (isOpen) close();
  }
  document.addEventListener('pointermove', function (e) {
    if (isTouchEvent(e)) return;
    lastX = e.clientX; lastY = e.clientY;
    evaluate();
  }, { passive: true });
  window.addEventListener('scroll', evaluate, { passive: true });
  document.documentElement.addEventListener('pointerleave', function (e) {
    if (isTouchEvent(e)) return;
    lastX = lastY = null; pointerInside = false;
    if (isOpen) close();
  });

  // ?zones in the URL draws the two hover zones for tuning
  if (/[?&]zones\b/.test(location.search)) {
    var z = document.createElement('div');
    z.style.cssText = 'position:absolute;pointer-events:none;z-index:99;outline:1px dashed #0D5EFF;' +
      'left:' + KEEP.x1 + 'px;top:' + KEEP.y1 + 'px;width:' + (KEEP.x2 - KEEP.x1) + 'px;height:' + (KEEP.y2 - KEEP.y1) + 'px';
    var c = document.createElement('div');
    c.style.cssText = 'position:absolute;pointer-events:none;z-index:99;border:1px dashed #e5484d;border-radius:50%;' +
      'left:' + (CIRCLE.x - CIRCLE.r) + 'px;top:' + (CIRCLE.y - CIRCLE.r) + 'px;width:' + (2 * CIRCLE.r) + 'px;height:' + (2 * CIRCLE.r) + 'px';
    stage.appendChild(z); stage.appendChild(c);
  }


  // ?tune: live spring tuning panel
  if (/[?&]tune\b/.test(location.search)) {
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:100;width:230px;padding:10px 12px;background:#fff;' +
      'border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.2);font:12px/1.4 system-ui,sans-serif;color:#111';
    var hint = document.createElement('div'); hint.textContent = 'Bật cao = nhanh, gắt hơn. Hãm thấp = nảy nhiều hơn'; hint.style.cssText = 'color:#666;font-size:11px;margin-bottom:6px';
    panel.appendChild(hint);
    var defs = [['openK', 'Mở: độ bật'], ['openC', 'Mở: độ hãm'], ['closeK', 'Đóng: độ bật'], ['closeC', 'Đóng: độ hãm'],
      ['parAmt', 'Lắc theo chuột: độ lệch (×)', 0, 4, .05], ['parTilt', 'Lắc theo chuột: độ nghiêng (°)', 0, 15, .5], ['parK', 'Lắc theo chuột: độ mềm', 40, 400, 5]];
    var outs = {};
    function over(k, c) { var z = c / (2 * Math.sqrt(k)); return z >= 1 ? 0 : Math.exp(-Math.PI * z / Math.sqrt(1 - z * z)) * 100; }
    function refresh() {
      outs.openK.textContent = SPRING.openK + ' / ' + SPRING.openC + '  (lố ' + over(SPRING.openK, SPRING.openC).toFixed(1) + '%)';
      outs.closeK.textContent = SPRING.closeK + ' / ' + SPRING.closeC + '  (nhún ' + over(SPRING.closeK, SPRING.closeC).toFixed(1) + '%)';
    }
    defs.forEach(function (d) {
      var row = document.createElement('label');
      row.style.cssText = 'display:block;margin:4px 0';
      var name = document.createElement('div');
      name.textContent = d[1];
      var inp = document.createElement('input');
      inp.type = 'range'; inp.style.width = '100%';
      var isK = d[0].slice(-1) === 'K' && d[0] !== 'parK';
      inp.min = d[2] !== undefined ? d[2] : isK ? 200 : 10; inp.max = d[3] !== undefined ? d[3] : isK ? 1200 : 60; inp.step = d[4] || (isK ? 10 : 1);
      inp.value = SPRING[d[0]];
      inp.addEventListener('input', function () { SPRING[d[0]] = +inp.value; refresh(); });
      row.appendChild(name); row.appendChild(inp); panel.appendChild(row);
    });
    outs.openK = document.createElement('div'); outs.closeK = document.createElement('div');
    outs.openK.style.fontWeight = outs.closeK.style.fontWeight = '600';
    panel.insertBefore(outs.openK, panel.children[2]);
    panel.appendChild(outs.closeK);
    var cp = document.createElement('button');
    cp.type = 'button'; cp.textContent = 'Copy số'; cp.style.cssText = 'margin-top:6px;font:inherit;padding:3px 10px';
    cp.addEventListener('click', function () {
      var t = 'open k/c: ' + SPRING.openK + '/' + SPRING.openC + ', close k/c: ' + SPRING.closeK + '/' + SPRING.closeC +
        ', lắc chuột lệch/nghiêng/mềm: ' + SPRING.parAmt + '/' + SPRING.parTilt + '/' + SPRING.parK;
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      cp.textContent = 'Đã copy'; setTimeout(function () { cp.textContent = 'Copy số'; }, 1000);
    });
    panel.appendChild(cp);
    refresh();
    document.body.appendChild(panel);
  }

  // touch: tap toggles
  btn.addEventListener('pointerdown', function (e) { lastTouch = isTouchEvent(e); });
  btn.addEventListener('click', function () {
    if (lastTouch || hoverTouch.matches) {
      isOpen ? close() : open();
    } else {
      open(); // keyboard / mouse click
    }
    lastTouch = false;
  });
  document.addEventListener('pointerdown', function (e) {
    if (isOpen && isTouchEvent(e) && !stage.contains(e.target)) close();
    else if (isOpen && isTouchEvent(e) && stage.contains(e.target) &&
             !e.target.closest('.layer, .person') && !e.target.closest('.avatar-btn')) close();
  });

  // keyboard
  btn.addEventListener('focus', function () {
    if (skipFocus || lastTouch || hoverTouch.matches) return;
    open();
  });
  stage.addEventListener('focusout', function (e) {
    var next = e.relatedTarget;
    if (next && stage.contains(next)) return;
    if (pointerInside) return;
    close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      close();
      skipFocus = true;
      btn.focus({ preventScroll: true });
      skipFocus = false;
    }
  });
})();
