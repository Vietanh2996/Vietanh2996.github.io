/* Hero image entrance: the pink and yellow cursors fly in from off-screen, each dragging two of the 4 hero images to their layout spot,
   with a Figma selection (border, handles, layer name, size pill) while dragging. Started by intro.js (run()), in parallel with the typing.
   One rAF loop, transform / opacity only. Each image is dragged by a spring (spotlight.js: k650 / c32, semi-implicit Euler, 1/240s substeps)
   that chases a scripted hand path, so it lags, overshoots a little and settles on drop. The cursor tip is glued to a grab point on the image.
   Writes only .he-drag (inner wrapper this file creates inside .hero-img: scroll-fx.js owns the .hero-img transform) and the two wandering cursors,
   and clears every inline style at the end. ?tune adds an "Ảnh vào" panel. Debug: __imgEnter.hold = ms freezes the timeline (for screenshots). */
(function () {
  'use strict';

  /* ================= CONFIG (ms / px / deg), one place ================= */
  var CFG = {
    wait: 200,        // wait before the first drag (pink); yellow follows `gap` later
    gap: 380,         // stagger between the two cursors, and extra pause before a cursor's second image
    drag: 1000,       // one drag, from off-screen to the layout spot
    tilt: 3.5,        // max tilt while dragging (deg)
    hold: 300,        // selection stays this long after the drop, then fades
    fade: 160,        // selection fade-out
    transit: 380,     // cursor flies from the dropped image to the next image's start
    home: 700,        // last drop -> back to the cursor's rest spot (then the CSS wander loop takes over)
    bow: 70,          // sideways bow of the hand path (screen px)
    wobble: 3.5,      // hand wobble (screen px)
    shrink: .8,       // street only: size while it is dragged in (x final size), anchored at its top-left
    corner: 600,      // street only: bottom-right handle dragged back out to full size (ms)
    lift: 80,         // street only: final rest = wrapper (css top = Figma 617 - lift); the drop lands at +lift (Figma spot), then it is dragged up (px, stage px)
    k: 650, c: 32     // spring, same as spotlight.js open
  };
  var CORNER_PAUSE = 200;   // street only: cursor rests on the corner handle before it starts pulling, and the spring settles (ms, not in ?tune)
  var LIFT_MS = 500;        // street only: the drag up from the lifted spot to the layout rect (ms, not in ?tune)
  /* order matters per cursor: pink drags apps then street, yellow drags dark then moto. grab = point on the image under the cursor tip (0..1);
     from = which edge it flies in from (-1 left, +1 right) and a vertical offset (screen px) so the four paths differ */
  var IMGS = [
    { sel: '.hero-img--apps',   cur: '.cursor--pink',   name: 'OneU - Redesign',       size: '323 × 323', gx: .66, gy: .30, from: -1, dy: -70 },
    { sel: '.hero-img--street', cur: '.cursor--pink',   name: 'OneU - Lifestyle App',  size: '507 × 338', gx: .58, gy: .36, from: -1, dy: 110, resize: true },
    { sel: '.hero-img--dark',   cur: '.cursor--yellow', name: 'Alchemist',             size: '368 × 368', gx: .34, gy: .32, from: 1,  dy: -110 },
    { sel: '.hero-img--moto',   cur: '.cursor--yellow', name: 'BlackSheep',            size: '365 × 365', gx: .40, gy: .38, from: 1,  dy: 90 }
  ];
  var HX = 5.7, HY = 5.8;                 // arrow tip inside the 56px cursor box (same as thumb.js / css)
  var PAD = 140;                          // how far past the viewport edge an image starts (screen px)

  var scene = document.querySelector('section.thumb');
  var layer = document.getElementById('cursor-layer');
  if (!scene || !layer) return;
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var api = window.__imgEnter = { cfg: CFG, hold: Infinity, start: start, stop: stop };
  /* the street wrapper's resting top = Figma top - lift (css reads --street-lift); keep the var in sync with the config */
  function setLiftVar() { root.style.setProperty('--street-lift', CFG.lift + 'px'); }
  setLiftVar();

  /* ---------- DOM: wrap each img + selection in .he-drag (once) ---------- */
  var items = IMGS.map(function (d) {
    var wrap = scene.querySelector(d.sel), img = wrap && wrap.querySelector('img');
    if (!wrap || !img) return null;
    var drag = document.createElement('div'); drag.className = 'he-drag';
    var selEl = document.createElement('div'); selEl.className = 'he-sel'; selEl.setAttribute('aria-hidden', 'true');
    selEl.innerHTML = '<i class="he-h"></i><i class="he-h"></i><i class="he-h"></i><i class="he-h"></i><span class="he-name"></span><span class="he-size"></span>';
    selEl.querySelector('.he-name').textContent = d.name; selEl.querySelector('.he-size').textContent = d.size;
    wrap.insertBefore(drag, img); drag.appendChild(img); drag.appendChild(selEl);
    return { d: d, wrap: wrap, drag: drag, sel: selEl, cur: layer.querySelector(d.cur) };
  }).filter(Boolean);
  if (!items.length) return;

  /* ---------- helpers ---------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function easeIO(p) { return .5 - .5 * Math.cos(Math.PI * p); }
  function easeDrag(p) { return .35 * easeIO(p) + .65 * (1 - Math.pow(1 - p, 3)); }   // quick pickup, long gentle landing
  function easeHome(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  var raf = 0, t0 = 0, lastT = 0, jobs = [], running = false;

  /* geometry of an image wrapper in screen px: centre + total scale (stage scale x scroll-fx scale) */
  function geo(it) {
    var r = it.wrap.getBoundingClientRect(), w = it.wrap.offsetWidth || 1;
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, k: r.width / w || 1, w: w, h: it.wrap.offsetHeight || 1, l: r.left, t: r.top, r: r.right };
  }
  /* screen position of a point (gx,gy = fraction of the drag box) for a local offset (x,y px, rot deg). The drag box is w*sc x h*sc;
     a resize item (street) pivots at its top-left, the others at their centre (as before) */
  function tipAt(it, g, x, y, rot, gx, gy) {
    var sw = g.w * it.sc, sh = g.h * it.sc, pvx = it.d.resize ? 0 : g.w / 2, pvy = it.d.resize ? 0 : g.h / 2;
    var rx = gx * sw - pvx, ry = gy * sh - pvy, a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    return { x: g.l + g.k * (pvx + x + rx * ca - ry * sa), y: g.t + g.k * (pvy + y + rx * sa + ry * ca) };
  }
  function grabTip(it, g, x, y, rot) { return tipAt(it, g, x, y, rot, it.d.gx, it.d.gy); }
  function restTip(cursor) {     // where the CSS wander loop rests (mirrors .cursor--pink/yellow --rx/--ry, scroll top)
    var cs = getComputedStyle(cursor), S = parseFloat(getComputedStyle(root).getPropertyValue('--stage-scale')) || 1;
    var pad = parseFloat(cs.getPropertyValue('--cur-pad')) || 0, vw = layer.clientWidth - pad;   // phones: mobile.css shrinks --vw by the chip and clamps --rx
    return { x: Math.min(vw / 2 + (parseFloat(cs.getPropertyValue('--tx')) - 960) * S, pad ? vw - 6.3 : Infinity), y: layer.clientHeight / 2 + (parseFloat(cs.getPropertyValue('--ty')) - 540) * S };
  }
  function putCursor(c, x, y, rot) {
    c.style.translate = (x - HX).toFixed(2) + 'px ' + (y - HY).toFixed(2) + 'px';
    c.style.rotate = rot ? rot.toFixed(2) + 'deg' : '';
  }

  /* ---------- per-image drag state ---------- */
  function prep(it) {            // start offset (local px): just past the viewport edge, with a vertical offset, so the image enters from off-screen
    var g = geo(it), vw = layer.clientWidth;
    it.s0 = it.d.resize ? CFG.shrink : 1;                 // drag-in scale (street: smaller); sc = spring state, ts = its target
    it.sc = it.ts = it.s0; it.vs = 0; it.lbl = '';
    it.ly = it.d.resize ? CFG.lift : 0; it.lifted = false;   // ly = rest y the spring holds (street: lifted 40px after the first drop, 0 after the lift)
    var sw = g.w * it.s0;                                  // box width while dragged in (top-left anchored for resize items)
    it.sx = it.d.from < 0 ? (-PAD - g.l) / g.k - sw : (vw + PAD - g.l) / g.k;
    it.sy = it.d.dy / g.k;
    it.x = it.sx; it.y = it.sy; it.vx = it.vy = 0; it.rot = 0; it.vr = 0;
    it.p = 0; it.dropT = -1; it.done = false; it.fading = false;
    it.drag.style.transformOrigin = it.d.resize ? '0 0' : '';
    paintImg(it);
  }
  function pathAt(it, p, g) {     // hand target (local px) + target tilt
    var e = easeDrag(p), bow = CFG.bow / g.k * Math.sin(Math.PI * p) * (it.d.dy < 0 ? 1 : -1), wob = CFG.wobble / g.k * Math.sin(p * Math.PI * 5) * Math.sin(Math.PI * p);
    return { x: it.sx * (1 - e) + wob * .6, y: it.sy * (1 - e) + it.ly * e + bow + wob, r: CFG.tilt * (it.d.from < 0 ? 1 : -1) * Math.sin(Math.PI * p) * (1 + .25 * Math.sin(p * Math.PI * 3)) };
  }
  var curTm = -1;
  function stepSpring(it, tx, ty, tr, dt) {
    if (it.stepT === curTm) return; it.stepT = curTm;     // at most one step per image per frame
    var n = Math.max(1, Math.round(dt * 240)), h = dt / n, i;
    for (i = 0; i < n; i++) {
      it.vx += (-CFG.k * (it.x - tx) - CFG.c * it.vx) * h; it.x += it.vx * h;
      it.vy += (-CFG.k * (it.y - ty) - CFG.c * it.vy) * h; it.y += it.vy * h;
      it.vr += (-CFG.k * (it.rot - tr) - CFG.c * it.vr) * h; it.rot += it.vr * h;
      it.vs += (-CFG.k * (it.sc - it.ts) - CFG.c * it.vs) * h; it.sc += it.vs * h;   // same spring for the box scale (1 for every image but the street)
    }
  }
  function sizeLabel(it) {     // size pill: the final Figma numbers scaled by the box scale (406 × 270 at .8)
    var v = it.d.size.split('×');
    return Math.round(parseFloat(v[0]) * it.sc) + ' × ' + Math.round(parseFloat(v[1]) * it.sc);
  }
  function paintImg(it) {
    it.drag.style.transform = 'translate(' + it.x.toFixed(2) + 'px,' + it.y.toFixed(2) + 'px)' + (Math.abs(it.rot) > .001 ? ' rotate(' + it.rot.toFixed(3) + 'deg)' : '');
    if (it.d.resize) {         // scale the box, not the selection: the border, handles and labels keep their on-screen size
      var pct = (it.sc * 100).toFixed(3) + '%', lbl = sizeLabel(it);
      it.drag.style.width = pct; it.drag.style.height = pct;
      if (lbl !== it.lbl) { it.lbl = lbl; it.sel.querySelector('.he-size').textContent = lbl; }
    }
  }
  function release(it) {          // clear this image's inline styles; layout spot is final
    it.drag.style.cssText = ''; it.sel.style.cssText = ''; it.done = true;
  }

  /* ---------- cursor jobs: wait -> (drag -> hold -> move)* -> home -> free ---------- */
  function mkJob(cursor, list, delay) { return { cur: cursor, list: list, i: 0, stage: 'wait', t: delay, tS: 0, from: null, to: null, free: false, rot: 0 }; }
  function bowPath(a, b, p, bow) {  // eased point between a and b with a sideways bow
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, s = Math.sin(Math.PI * p) * bow;
    return { x: a.x + dx * p - dy / len * s, y: a.y + dy * p + dx / len * s };
  }
  function tickJob(j, tm, dt) {
    var it = j.list[j.i], g, tip, p, tgt, s;
    if (j.free) return;
    if (j.stage === 'wait') {
      if (tm < j.t) return;
      j.cur.classList.add('he-fly'); it.wrap.classList.add('he-in');
      it.drag.style.willChange = 'transform'; it.sel.style.opacity = '1';
      j.stage = 'drag'; j.tS = tm;
    }
    if (j.stage === 'drag') {
      g = geo(it); p = clamp((tm - j.tS) / CFG.drag, 0, 1); it.p = p;
      tgt = pathAt(it, p, g); stepSpring(it, tgt.x, tgt.y, tgt.r, dt); paintImg(it);
      tip = grabTip(it, g, it.x, it.y, it.rot); putCursor(j.cur, tip.x, tip.y, it.rot * .6);
      if (p >= 1) { it.dropT = tm; j.stage = 'hold'; }
    } else if (j.stage === 'hold') {
      g = geo(it); stepSpring(it, 0, it.ly, 0, dt); paintImg(it);
      tip = grabTip(it, g, it.x, it.y, it.rot); putCursor(j.cur, tip.x, tip.y, it.rot * .6);
      s = tm - (it.dropT + CFG.hold);
      if (s >= 0 && it.d.resize && !it.lifted) {      // street: selection stays, cursor goes to the bottom-right handle
        j.from = { x: tip.x, y: tip.y }; j.fromRot = it.rot * .6; j.tS = tm; j.stage = 'corner';
      } else if (s >= 0) {                            // selection fades, cursor leaves
        it.sel.style.opacity = clamp(1 - s / CFG.fade, 0, 1).toFixed(3);
        j.from = { x: tip.x, y: tip.y }; j.fromRot = it.rot * .6;
        j.nextIt = j.list[j.i + 1]; j.tS = tm;
        if (j.nextIt) j.stage = 'move'; else { j.to = restTip(j.cur); j.stage = 'home'; }   // the next image already waits at its off-screen start
      }
    } else if (j.stage === 'corner') {                // (resize) cursor to the bottom-right handle of the small box
      g = geo(it); stepSpring(it, 0, it.ly, 0, dt); paintImg(it);
      p = clamp((tm - j.tS) / CFG.transit, 0, 1);
      tgt = bowPath(j.from, tipAt(it, g, it.x, it.y, it.rot, 1, 1), easeHome(p), CFG.bow * .6); putCursor(j.cur, tgt.x, tgt.y, j.fromRot * (1 - p));
      if (p >= 1) { j.stage = 'pause'; j.tS = tm; }
    } else if (j.stage === 'pause') {                 // (resize) cursor rests on the handle
      g = geo(it); stepSpring(it, 0, it.ly, 0, dt); paintImg(it);
      tip = tipAt(it, g, it.x, it.y, it.rot, 1, 1); putCursor(j.cur, tip.x, tip.y, 0);
      if (tm - j.tS >= CORNER_PAUSE) { j.stage = 'resize'; j.tS = tm; }
    } else if (j.stage === 'resize') {                // (resize) corner dragged out to full size; the spring chases the path, so it settles with a small overshoot
      g = geo(it); p = clamp((tm - j.tS) / CFG.corner, 0, 1);
      it.ts = it.s0 + (1 - it.s0) * easeDrag(p);
      stepSpring(it, 0, it.ly, 0, dt); paintImg(it);
      tip = tipAt(it, g, it.x, it.y, it.rot, 1, 1); putCursor(j.cur, tip.x, tip.y, 0);
      if (p >= 1) { it.ts = 1; j.stage = 'settle'; j.tS = tm; }
    } else if (j.stage === 'settle') {                // (resize) spring finishes at the lifted spot, then the cursor goes to the image centre
      g = geo(it); stepSpring(it, 0, it.ly, 0, dt); paintImg(it);
      tip = tipAt(it, g, it.x, it.y, it.rot, 1, 1); putCursor(j.cur, tip.x, tip.y, 0);
      if (tm - j.tS >= CORNER_PAUSE) { j.from = { x: tip.x, y: tip.y }; j.fromRot = 0; j.tS = tm; j.stage = 'toCentre'; }
    } else if (j.stage === 'toCentre') {              // (resize) cursor flies to the centre of the image
      g = geo(it); stepSpring(it, 0, it.ly, 0, dt); paintImg(it);
      p = clamp((tm - j.tS) / CFG.transit, 0, 1);
      tgt = bowPath(j.from, tipAt(it, g, it.x, it.y, it.rot, .5, .5), easeHome(p), CFG.bow * .6); putCursor(j.cur, tgt.x, tgt.y, 0);
      if (p >= 1) { j.stage = 'lift'; j.tS = tm; }
    } else if (j.stage === 'lift') {                  // (resize) grabbed at the centre, dragged up by `lift` to the layout rect (same spring feel)
      g = geo(it); p = clamp((tm - j.tS) / LIFT_MS, 0, 1);
      it.ly = CFG.lift * (1 - easeDrag(p));
      stepSpring(it, 0, it.ly, 0, dt); paintImg(it);
      tip = tipAt(it, g, it.x, it.y, it.rot, .5, .5); putCursor(j.cur, tip.x, tip.y, 0);
      if (p >= 1) { it.ly = 0; it.lifted = true; it.dropT = tm; j.stage = 'hold'; }   // hold + fade + home run through the normal hold branch
    } else if (j.stage === 'move') {
      p = clamp((tm - j.tS) / (CFG.transit + CFG.gap * .5), 0, 1);
      g = geo(j.nextIt); tip = grabTip(j.nextIt, g, j.nextIt.sx, j.nextIt.sy, 0);
      tgt = bowPath(j.from, tip, easeHome(p), CFG.bow * .6); putCursor(j.cur, tgt.x, tgt.y, j.fromRot * (1 - p));
      if (p >= 1) { j.i++; j.stage = 'wait2'; }
    } else if (j.stage === 'home') {
      p = clamp((tm - j.tS) / CFG.home, 0, 1); j.to = restTip(j.cur);
      tgt = bowPath(j.from, j.to, easeHome(p), CFG.bow * .5); putCursor(j.cur, tgt.x, tgt.y, j.fromRot * (1 - p));
      if (p >= 1) {                                    // hand over: the wander keyframes start at exactly this spot, so no jump
        j.cur.style.translate = ''; j.cur.style.rotate = '';
        j.cur.classList.remove('he-fly'); j.cur.classList.add('he-free'); j.free = true;
      }
    }
    if (j.stage === 'wait2') { j.stage = 'drag'; j.tS = tm; j.cur.classList.add('he-fly'); j.list[j.i].wrap.classList.add('he-in'); j.list[j.i].drag.style.willChange = 'transform'; j.list[j.i].sel.style.opacity = '1'; j.from = null; }
  }

  /* ---------- the loop ---------- */
  function tick(now) {
    if (!t0) t0 = now;
    var tm = Math.min(now - t0, api.hold), dt = clamp((tm - lastT) / 1000, 0, 1 / 30), alive = false, n = 0;
    lastT = tm; curTm = tm;
    jobs.forEach(function (j) { tickJob(j, tm, dt); });
    // settle / release images: a dropped image keeps its spring until still, its selection fades after the hold
    items.forEach(function (it) {
      if (it.done || it.dropT < 0) return;
      var j = jobs.filter(function (q) { return q.list.indexOf(it) >= 0; })[0], active = j && j.list[j.i] === it && /^(drag|hold|corner|pause|resize|settle|toCentre|lift)$/.test(j.stage);
      if (!active) {                                     // cursor has left: spring on its own
        stepSpring(it, 0, it.ly, 0, dt); paintImg(it);
        it.sel.style.opacity = clamp(1 - (tm - (it.dropT + CFG.hold)) / CFG.fade, 0, 1).toFixed(3);
      }
      if (tm >= it.dropT + CFG.hold + CFG.fade && Math.abs(it.x) < .05 && Math.abs(it.y) < .05 && Math.abs(it.rot) < .01 && Math.abs(it.vx) + Math.abs(it.vy) < .5
          && Math.abs(it.sc - 1) < .002 && Math.abs(it.vs) < .02 && !active) release(it);   // never clear styles while the job still paints this image
    });
    jobs.forEach(function (j) { if (!j.free) alive = true; });
    items.forEach(function (it) { if (!it.done) n++; });
    if (alive || n) raf = requestAnimationFrame(tick); else { raf = 0; running = false; }
  }

  function clearAll() {
    cancelAnimationFrame(raf); raf = 0; running = false; jobs = [];
    items.forEach(function (it) { it.drag.style.cssText = ''; it.sel.style.cssText = ''; it.wrap.classList.remove('he-in'); it.cur.style.translate = ''; it.cur.style.rotate = ''; it.cur.classList.remove('he-fly', 'he-free'); it.dropT = -1; it.done = true; });
  }
  function stop() { clearAll(); items.forEach(function (it) { it.wrap.classList.add('he-in'); it.cur.classList.add('he-free'); }); }
  function start() {
    clearAll();
    if (reduced) { items.forEach(function (it) { it.wrap.classList.add('he-in'); it.cur.classList.add('he-free'); }); return; }
    items.forEach(function (it) { it.done = false; prep(it); });
    var pink = items.filter(function (it) { return it.d.cur === '.cursor--pink'; }), yel = items.filter(function (it) { return it.d.cur === '.cursor--yellow'; });
    jobs = [];
    if (pink.length) jobs.push(mkJob(pink[0].cur, pink, CFG.wait));
    if (yel.length) jobs.push(mkJob(yel[0].cur, yel, CFG.wait + CFG.gap));
    t0 = 0; lastT = 0; running = true; raf = requestAnimationFrame(tick);
  }

  /* ---------- ?tune: "Ảnh vào" panel (left, under the top-left pill; the other tune panels are bottom-left / top-right / bottom-right) ---------- */
  if (/[?&]tune\b/.test(location.search)) {
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:12px;top:84px;z-index:100;width:230px;padding:10px 12px;background:#fff;' +
      'border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.2);font:12px/1.4 system-ui,sans-serif;color:#111';
    var title = document.createElement('div'); title.textContent = 'Ảnh vào'; title.style.cssText = 'font-weight:600;margin-bottom:4px';
    panel.appendChild(title);
    [['wait', 'Chờ trước khi kéo (ms)', 0, 2000, 10], ['gap', 'Lệch nhịp giữa ảnh (ms)', 0, 1500, 10], ['drag', 'Thời gian kéo (ms)', 300, 2500, 10],
     ['tilt', 'Độ nghiêng (độ)', 0, 12, .5], ['hold', 'Giữ khung chọn sau khi thả (ms)', 0, 1500, 10],
     ['shrink', 'Cỡ lúc kéo vào (×)', .5, 1, .01], ['corner', 'Thời gian kéo góc (ms)', 200, 1500, 10],
     ['lift', 'Dịch lên sau khi scale (px)', 0, 200, 1]].forEach(function (d) {
      var row = document.createElement('label'), name = document.createElement('div'), out = document.createElement('b'), inp = document.createElement('input');
      row.style.cssText = 'display:block;margin:4px 0';
      out.style.cssText = 'float:right;font-weight:600'; out.textContent = CFG[d[0]];
      name.textContent = d[1]; name.appendChild(out);
      inp.type = 'range'; inp.min = d[2]; inp.max = d[3]; inp.step = d[4]; inp.value = CFG[d[0]]; inp.style.width = '100%';
      inp.addEventListener('input', function () { CFG[d[0]] = +inp.value; out.textContent = inp.value; if (d[0] === 'lift') setLiftVar(); });
      row.appendChild(name); row.appendChild(inp); panel.appendChild(row);
    });
    function btn(label, fn) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'margin:6px 6px 0 0;font:inherit;padding:3px 10px';
      b.addEventListener('click', fn); panel.appendChild(b); return b;
    }
    btn('Chạy lại', function () { if (window.__intro && window.__intro.restart) window.__intro.restart(); else start(); });
    var cp = btn('Copy số', function () {
      var t = 'var CFG = ' + JSON.stringify(CFG) + ';';
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      cp.textContent = 'Đã copy'; setTimeout(function () { cp.textContent = 'Copy số'; }, 1000);
    });
    document.body.appendChild(panel);
  }
})();
