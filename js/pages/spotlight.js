/* Spotlight engine: one trigger element ("source") + N layers that spring out of it, with the page blurred behind.
   Reusable: js/pages/about.js creates one instance for the Việt Anh avatar and one per skill chip slot.

   Behaviour that is user-approved and shared by every instance (do not change without asking):
     - spring open k650 / c32, close k550 / c34, semi-implicit Euler with 1/240s substeps, velocity kept across target changes
     - per-unit stagger: open 0 / 20 / 40 / 60 ms, close 30 / 30 / 15 / 0 ms (given by each unit's dIn / dOut)
     - hover zones with hysteresis: a small OPEN zone on the source, a bigger KEEP zone around the whole composition;
       both are fixed in stage px (never read from animating elements); KEEP contains OPEN
     - pointer parallax: parAmt / parTilt / parK + per-unit amp / tilt / kf
   Only one instance is open at a time (opening one closes the other: hand-off). body.is-spotlight shows the dim overlay.

   Coordinates: everything the engine tests (zones) is in "stage px": the px of cfg.space, whose design width is cfg.spaceW.
   Layers are authored in design px inside cfg.comp; cfg.layout(inst) positions the comp and returns the zones.

   Unit config (cfg.units[i]):
     el, dIn, dOut        element + stagger delays (ms)
     amp, tilt, kf        parallax: px at full deflection, 1 = rotateX/Y tilt, spring stiffness factor
     sat: {dx, dy, s0, r0} satellite: flies from (dx,dy) away, scale s0, rotate r0 -> rest; opacity p/.35; hidden at rest
     draw(u)              custom drawing for non-satellite units (reads u.p, u.px, u.py)
   cfg hooks: layout(inst) -> {open, keep} (open: {circle:{x,y,r}} or {rect:{x1,y1,x2,y2}} or live fn; keep: {x1,y1,x2,y2}),
              onShown(on), dimWhenOther.
   ?zones draws the zones, ?tune shows the spring panel (bottom-right). */
(function () {
  'use strict';
  // spring config (live-editable with ?tune)
  var SPRING = { openK: 650, openC: 32, closeK: 550, closeC: 34, ringWidth: 5, parK: 120, parAmt: 2.2, parTilt: 7 };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var hoverTouch = window.matchMedia('(hover: none)');
  var instances = [];
  var active = null;
  var lastX = null, lastY = null;
  var showZones = /[?&]zones\b/.test(location.search);

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function parEnabled() { return !reduced.matches && !hoverTouch.matches; }
  function isTouchEvent(e) { return e.pointerType === 'touch'; }

  function create(cfg) {
    var self = { cfg: cfg, comp: cfg.comp, source: cfg.source, isOpen: false, pointerInside: false, zones: null };
    var comp = cfg.comp, source = cfg.source;
    var PT = { x: 0, y: 0 };
    var raf = 0, lastT = 0, lastTouch = false, skipFocus = false, shown = null;

    // ---------- units: scalar progress p per unit, velocity kept across target changes ----------
    var units = self.units = cfg.units.map(function (o) {
      var u = { el: o.el, p: 0, v: 0, target: 0, pend: null, dIn: o.dIn, dOut: o.dOut, vis: null,
                sat: !!o.sat, draw: o.draw || null,
                amp: o.amp, tilt: o.tilt, kf: o.kf, ax: 0, ay: 0, avx: 0, avy: 0, px: 0, py: 0, rx: 0, ry: 0, rz: 0 };
      if (o.sat) { u.dx = o.sat.dx; u.dy = o.sat.dy; u.s0 = o.sat.s0; u.r0 = o.sat.r0; }
      return u;
    });
    var lead = units[0];   // the unit that tells "still visibly out" (the person / the zoomed chip)

    function render() {
      var i, u, p, w, par = parEnabled(), any = false;
      for (i = 0; i < units.length; i++) {
        u = units[i]; p = u.p;
        u.px = u.py = u.rx = u.ry = u.rz = 0;
        if (par) {
          w = clamp(p, 0, 1) * SPRING.parAmt;
          u.px = u.ax * u.amp * w; u.py = u.ay * u.amp * w;
          if (u.tilt) { w = clamp(p, 0, 1) * SPRING.parTilt; u.ry = u.ax * w; u.rx = -u.ay * w; }
          else if (u.sat) u.rz = u.ax * clamp(p, 0, 1) * SPRING.parTilt * 1.5;
        }
        if (p > 0.001 || u.target || u.pend) any = true;
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
      for (i = 0; i < units.length; i++) if (units[i].draw) units[i].draw(units[i]);
      if (cfg.onShown && any !== shown) { shown = any; cfg.onShown(any); }
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
    function wake() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }
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
      wake();
    }

    // ---------- zones (stage px) ----------
    self.relayout = function () {
      if (!cfg.layout) return;
      var z = cfg.layout(self);
      if (z) self.zones = z;
      render();
      if (showZones) drawZones(self);
    };
    self.toStage = function (cx, cy) {
      var r = cfg.space.getBoundingClientRect();
      var s = r.width / cfg.spaceW;
      return { x: (cx - r.left) / s, y: (cy - r.top) / s };
    };
    self.inOpen = function (p) {
      var z = self.zones && self.zones.open;
      if (typeof z === 'function') z = z();
      if (!z) return false;
      if (z.circle) { var dx = p.x - z.circle.x, dy = p.y - z.circle.y; return dx * dx + dy * dy <= z.circle.r * z.circle.r; }
      return p.x >= z.rect.x1 && p.x <= z.rect.x2 && p.y >= z.rect.y1 && p.y <= z.rect.y2;
    };
    self.inKeep = function (p) {
      var k = self.zones && self.zones.keep;
      return !!k && p.x >= k.x1 && p.x <= k.x2 && p.y >= k.y1 && p.y <= k.y2;
    };
    // pointer offset from the KEEP centre, -1..1; only a target for the parallax springs, never read by the zone tests
    self.updatePar = function () {
      var nx = 0, ny = 0, k = self.zones && self.zones.keep;
      if (self.isOpen && k && lastX !== null && parEnabled()) {
        var q = self.toStage(lastX, lastY);
        nx = clamp((q.x - (k.x1 + k.x2) / 2) / ((k.x2 - k.x1) / 2), -1, 1);
        ny = clamp((q.y - (k.y1 + k.y2) / 2) / ((k.y2 - k.y1) / 2), -1, 1);
      }
      if (nx !== PT.x || ny !== PT.y) { PT.x = nx; PT.y = ny; wake(); }
    };
    self.stillOut = function () { return lead.p > 0.25; };

    // ---------- open / close ----------
    self.open = function () {
      if (self.isOpen) return;
      if (active && active !== self) active.close();
      self.relayout();                      // fresh measure of the source right before it opens
      self.isOpen = true;
      active = self;
      setTargets(true);
      comp.classList.add('is-open');
      source.setAttribute('aria-expanded', 'true');
      syncBody();
    };
    self.close = function () {
      if (!self.isOpen) return;
      self.isOpen = false;
      PT.x = PT.y = 0;
      if (active === self) active = null;
      setTargets(false);
      comp.classList.remove('is-open');
      source.setAttribute('aria-expanded', 'false');
      syncBody();
    };
    self.render = render;

    // ---------- touch: tap toggles ----------
    source.addEventListener('pointerdown', function (e) { lastTouch = isTouchEvent(e); });
    source.addEventListener('click', function () {
      if (lastTouch || hoverTouch.matches) {
        self.isOpen ? self.close() : self.open();
      } else {
        self.open(); // keyboard / mouse click
      }
      lastTouch = false;
    });
    self.touchOutside = function (e) {
      if (!self.isOpen || !isTouchEvent(e)) return;
      var t = e.target;
      if (!(t.closest && t.closest('.sp-layer, .person, .sp-clone') && comp.contains(t)) && !source.contains(t)) self.close();
    };

    // ---------- keyboard ----------
    source.addEventListener('focus', function () {
      if (skipFocus || lastTouch || hoverTouch.matches) return;
      self.open();
    });
    function onFocusOut(e) {
      var next = e.relatedTarget;
      if (next && (comp.contains(next) || next === source)) return;
      if (self.pointerInside) return;
      self.close();
    }
    comp.addEventListener('focusout', onFocusOut);
    source.addEventListener('blur', onFocusOut);
    self.escape = function () {
      if (!self.isOpen) return;
      self.close();
      skipFocus = true;
      source.focus({ preventScroll: true });
      skipFocus = false;
    };

    // initial state (hidden satellites, rest pose)
    render();
    instances.push(self);
    return self;
  }

  // ---------- manager: one set of global listeners for every instance ----------
  function syncBody() {
    document.body.classList.toggle('is-spotlight', !!active);
    instances.forEach(function (inst) {
      inst.comp.classList.toggle('is-dim', !!active && active !== inst && !!inst.cfg.dimWhenOther);
    });
  }

  // Hover (mouse / pen): fixed zones in stage coords, with hysteresis.
  // Not tied to the animating elements, so a shrinking/growing layer passing
  // under a still pointer can never fire enter/leave and cause flicker.
  //  - OPEN zone: source + padding (small) -> opens (and takes over from another open instance).
  //  - KEEP zone: whole open composition + generous padding (large) -> stays open while inside.
  // KEEP contains OPEN, so close can never immediately retrigger open.
  function evaluateAll() {
    if (lastX === null) return;
    var i, inst, hit = null;
    for (i = 0; i < instances.length; i++) {
      inst = instances[i];
      inst._p = inst.toStage(lastX, lastY);
      if (!hit && inst.inOpen(inst._p)) hit = inst;
    }
    if (hit) { hit.pointerInside = true; hit.open(); }
    for (i = 0; i < instances.length; i++) {
      inst = instances[i];
      if (inst === hit) continue;
      if (inst.inKeep(inst._p)) {
        inst.pointerInside = true;
        // out -> in -> out at the edge: follow live while the person is still visibly out
        if (!inst.isOpen && !active && !hit && inst.stillOut()) inst.open();
      } else {
        inst.pointerInside = false;
        if (inst.isOpen) inst.close();
      }
    }
    for (i = 0; i < instances.length; i++) instances[i].updatePar();
  }
  document.addEventListener('pointermove', function (e) {
    if (isTouchEvent(e)) return;
    lastX = e.clientX; lastY = e.clientY;
    evaluateAll();
  }, { passive: true });
  window.addEventListener('scroll', evaluateAll, { passive: true });
  document.documentElement.addEventListener('pointerleave', function (e) {
    if (isTouchEvent(e)) return;
    lastX = lastY = null;
    instances.forEach(function (inst) { inst.pointerInside = false; if (inst.isOpen) inst.close(); });
  });
  document.addEventListener('pointerdown', function (e) {
    for (var i = 0; i < instances.length; i++) instances[i].touchOutside(e);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && active) active.escape();
  });

  // ?zones in the URL draws the two hover zones of every instance (stage px, inside cfg.space)
  function drawZones(inst) {
    var z = inst.zones; if (!z) return;
    if (!inst._zEls) {
      var k = document.createElement('div'), o = document.createElement('div');
      k.style.cssText = 'position:absolute;pointer-events:none;z-index:99;outline:1px dashed #0D5EFF';
      o.style.cssText = 'position:absolute;pointer-events:none;z-index:99;border:1px dashed #e5484d';
      inst.cfg.space.appendChild(k); inst.cfg.space.appendChild(o);
      inst._zEls = [k, o];
    }
    var kk = z.keep, oo = typeof z.open === 'function' ? z.open() : z.open;
    inst._zEls[0].style.cssText += ';left:' + kk.x1 + 'px;top:' + kk.y1 + 'px;width:' + (kk.x2 - kk.x1) + 'px;height:' + (kk.y2 - kk.y1) + 'px';
    var oe = inst._zEls[1];
    if (oo.circle) oe.style.cssText += ';border-radius:50%;left:' + (oo.circle.x - oo.circle.r) + 'px;top:' + (oo.circle.y - oo.circle.r) + 'px;width:' + (2 * oo.circle.r) + 'px;height:' + (2 * oo.circle.r) + 'px';
    else oe.style.cssText += ';border-radius:0;left:' + oo.rect.x1 + 'px;top:' + oo.rect.y1 + 'px;width:' + (oo.rect.x2 - oo.rect.x1) + 'px;height:' + (oo.rect.y2 - oo.rect.y1) + 'px';
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

  window.Spotlight = {
    SPRING: SPRING, create: create, clamp: clamp, parEnabled: parEnabled, reduced: reduced,
    isAnyOpen: function () { return !!active; }, instances: instances
  };
})();
