/* Work section (demo): two folder cards (A OneU, B Dynamic Engagement Content) on the shared spotlight engine (js/pages/spotlight.js).
     A: the folder fades away, phones + stickers spread out, title centred below, handwritten note   (Figma 3794:45368)
   Each card is a composition in "resting card design px" (360x353, origin = card top-left). Every part is a draw() unit: its pose is
   lerped from the resting pose to the spotlight pose by the unit's spring progress p (the engine's sat units fade from invisible,
   but here the parts are always visible). Spotlight poses below are the Figma coordinates, converted into that card space. */
(function () {
  'use strict';
  var SP = window.Spotlight;
  var space = document.getElementById('work-stage');
  var root = document.getElementById('work-sp');
  if (!SP || !space || !root) return;

  var SW = 1920;
  var clamp = SP.clamp;
  function lerp(a, b, p) { return a + (b - a) * p; }
  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function img(dir, src, cls, w, h, parent) { var i = el('img', 'w-part ' + cls, parent); i.src = 'assets/home/work/' + dir + src; i.alt = ''; i.width = w; i.height = h; i.draggable = false; i.decoding = 'async'; i.style.width = w + 'px'; i.style.height = h + 'px'; return i; }
  function measure(node) {
    var r = node.getBoundingClientRect(), sr = space.getBoundingClientRect(), s = sr.width / SW || 1;
    return { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s };
  }
  function f(n) { return n.toFixed(2); }

  // Per-card data. rest = pose inside the resting card (card top-left origin, 360x353); spot = pose in the spotlight, converted into card space
  // (spotlight frame centred on the card). rot = Figma degrees (CSS = -rot). Parts are listed bottom -> top (Figma z-order), key = stagger slot.
  var CARDS = {
    // A: OneU (Figma _Folder 3794:45309; Papers frame at x -21, y -6 => phones / stickers are offset by that). Frame origin (-63.7,-126.5).
    a: {
      dir: 'oneu/', cls: 'a',
      back: { src: 'folder-back.svg', w: 360, h: 309, top: 44 },
      clip: [-600, -600, 126, -600],                    // Papers clip at rest: inset top/right/bottom/left (px, card space)
      parts: [
        { key: 'p1',  src: 'phone-1.png',    w: 146,   h: 316,   cls: 'w-p1', rest: { x: 18.4,  y: 86.2,  r: 8 },     spot: { x: 24.3,  y: -72.2, r: 8 } },
        { key: 'p2',  src: 'phone-2.png',    w: 164.5, h: 356.1, cls: 'w-p2', rest: { x: 217,   y: 48,    r: -18.7 }, spot: { x: 232.3, y: -126.5, r: -18.7 } },
        { key: 'vin', src: 'logo-vinid.png', w: 94.1,  h: 59.8,  cls: 'w-vin', rest: { x: 73,   y: 225.6, r: 20.3 },  spot: { x: -63.7, y: 114.1, r: 20.3 } },
        { key: 'one', src: 'logo-oneu.png',  w: 73,    h: 72.6,  cls: 'w-one', rest: { x: 181.7, y: 186,  r: -19.9 }, spot: { x: 355,   y: 135.5, r: -19.9 } }
      ],
      front: { flap: null, title: 'The New Journey: From VinID → OneU', desc: 'Revamp App', tx: 16, ty: 16, dx: 16, dy: 82 },
      title: { l1: 'The New Journey: From VinID → OneU', l2: 'From a points app to a lifestyle platform', x: -34.5, y: 283 },
      note: { text: "VinID was a points super app. Once it was repositioned as an extension of the Techcombank ecosystem, OneU had to look like a trendy lifestyle app", x: -82.7, y: 354.5, w: 526 },
      bounds: { x1: -83, y1: -127, x2: 444, y2: 490 }
    },
    // B: Dynamic Engagement Content (Figma _Folder 2 3819:28424 + Spotlight 2 3823:28424). Papers frame (-21,-48) 400x302 clips at rest. Frame origin (-80,-143.5).
    // The Points banner sits behind the phone at rest (hidden by it + the clip) and is above it in the spotlight (z flips once it has started to move).
    b: {
      dir: 'dynamic/', cls: 'b',
      back: { src: 'folder-back.svg', w: 360, h: 297, top: 33.5 },
      clip: [-48, -70, 99, -21],   // right widened (-19 -> -70) so the Link-now widget isn't cut
      parts: [
        // Points banner -> "Card Share knowledge" (Figma 3837:29156 / 3837:28395, 193 x 92.07 visible). Hidden behind the phone at rest, flies out on open.
        { key: 'bn',  src: 'card-share.webp', w: 193, h: 110.14, cls: 'w-bn', rest: { x: 99,     y: 161.93, r: 0 },      spot: { x: 230.27, y: 170.4,  r: 8 },   lift: true, fade: true },
        // "Card Link now" (Figma 3837:29136 / 3837:28375): static body PNG (GIF layer hidden) + a frame sprite of the oneU club box GIF at its Figma box
        { key: 'p2',  gif: { body: 'card-link.png', sprite: 'card-link-sprite.webp', n: 10, box: { x: 117.7, y: 0.51, w: 75.14, h: 110.65 } }, w: 193, h: 110.14, cls: 'w-sh w-gifpart', rest: { x: 210, y: 114.39, r: -9.75 }, spot: { x: 276.03, y: -49.49, r: -10 } },
        { key: 'p1',  src: 'phone.webp',     w: 264, h: 423, cls: 'w-ph',  rest: { x: 51,     y: 17,     r: 0 },      spot: { x: 48,   y: -143.5, r: 0 } },
        { key: 'vin', src: 'card-left.webp', w: 193, h: 110, cls: 'w-sh',  rest: { x: -16,    y: 183.35, r: 9.95 },   spot: { x: -100, y: 26.5,   r: 10 } },
        { key: 'stk', src: 'sticker.png',    w: 73,  h: 72.6, cls: 'w-stk', rest: { x: 66.73,  y: 56,     r: -19.92 }, spot: { x: -20,  y: -103.5, r: -20 } }
      ],
      front: { flap: { src: 'folder-front.svg', x: -10, y: -12, w: 380, h: 146 }, title: 'Dynamic Engagement Content', desc: 'Concept & UI design', tx: 28, ty: 27, dx: 28, dy: 93 },
      title: { l1: 'Dynamic Engagement Content:', l2: 'Personalized content, powered by AI', x: -31, y: 306.5 },
      note: { text: 'A smarter, automated solution, more adaptive way to connect with users in real time', x: -83, y: 376.5, w: 526 },
      bounds: { x1: -100, y1: -144, x2: 486, y2: 451 }   // spotlight extents (Figma Spotlight 2, card space)
    }
  };

  // stagger like the avatar: open 0/20/40/60/80 ms, close 30/30/15/15/0 ms
  var D = { p1: [0, 30], p2: [20, 30], vin: [40, 15], one: [60, 15], bn: [50, 15], stk: [70, 15], mid: [0, 30], note: [80, 0] };
  var AMP = { p1: 8, p2: 12, vin: 14, one: 16, bn: 14, stk: 16, mid: 4, note: 12 };
  var KF = { p1: .9, p2: 1, vin: 1.1, one: 1.15, bn: 1.05, stk: 1.15, mid: .8, note: .85 };

  function poseUnit(node, key, rest, spot, variant, extra) {
    var s1 = spot.w ? spot.w / rest.w : 1;
    return {
      el: node, dIn: D[key][0], dOut: D[key][1], amp: AMP[key], tilt: 0, kf: KF[key],
      draw: function (u) {
        var p = u.p;
        if (extra) extra(p);
        node.style.transform = 'translate3d(' + f(lerp(rest.x, spot.x, p) + u.px) + 'px,' + f(lerp(rest.y, spot.y, p) + u.py) + 'px,0) rotate(' +
          f(-lerp(rest.r, spot.r, p)) + 'deg) scale(' + lerp(1, s1, p).toFixed(4) + ')';
      }
    };
  }
  // handwritten note: last in, slides up and fades
  function noteUnit(node, spot) {
    return {
      el: node, dIn: D.note[0], dOut: D.note[1], amp: AMP.note, tilt: 0, kf: KF.note,
      draw: function (u) {
        var q = clamp((u.p - .45) / .55, 0, 1);
        node.style.opacity = q.toFixed(3);
        node.style.visibility = q <= 0.001 && u.p <= 0.001 ? 'hidden' : 'visible';
        node.style.transform = 'translate3d(' + f(spot.x + u.px) + 'px,' + f(spot.y + (1 - clamp(u.p, 0, 1)) * 18 + u.py) + 'px,0)';
      }
    };
  }

  function build(variant, a) {
    var v = variant, sp = CARDS[v], dir = sp.dir;
    var comp = el('div', 'sp-comp work-comp work-comp--' + v, root);
    var back = img(dir, sp.back.src, 'w-back', sp.back.w, sp.back.h, comp);
    back.style.top = sp.back.top + 'px';
    // Figma "Papers" frame clips (just above the flap): the wrapper clips there at rest and releases while the spotlight opens
    var papers = el('div', 'w-papers', comp);
    function clipCss(t) { return 'inset(' + f(t[0]) + 'px ' + f(t[1]) + 'px ' + f(t[2]) + 'px ' + f(t[3]) + 'px)'; }
    papers.style.clipPath = clipCss(sp.clip);
    var nodes = sp.parts.map(function (pt) {
      if (!pt.gif) return img(dir, pt.src, pt.cls, pt.w, pt.h, papers);
      var wd = pt.gif, box = wd.box, W0 = pt.w, H0 = pt.h;
      var wrap = el('div', 'w-part ' + pt.cls, papers); wrap.style.width = pt.w + 'px'; wrap.style.height = pt.h + 'px';
      var body = el('img', 'w-wbody', wrap); body.src = 'assets/home/work/' + dir + wd.body; body.alt = ''; body.draggable = false; body.decoding = 'async';
      var gb = el('div', 'w-gif', wrap);
      gb.style.left = (box.x / W0 * 100).toFixed(3) + '%'; gb.style.top = (box.y / H0 * 100).toFixed(3) + '%';
      gb.style.width = (box.w / W0 * 100).toFixed(3) + '%'; gb.style.height = (box.h / H0 * 100).toFixed(3) + '%';
      // the original GIF (3.4 MB) is replaced by a frame sprite (n frames side by side), stepped in CSS (css/pages/work.css .w-strip)
      var st = el('div', 'w-strip', gb); st.style.width = (wd.n * 100) + '%'; st.style.setProperty('--n', wd.n);
      st.style.backgroundImage = 'url(assets/home/work/' + dir + wd.sprite + ')';
      return wrap;
    });
    // front flap group (flap + title + description), placed at (0,227)
    var front = el('div', 'w-part w-front', comp);
    front.style.top = '227px'; front.style.width = '360px'; front.style.height = '126px';
    var fr = sp.front;
    if (fr.flap) { var fi = img(dir, fr.flap.src, 'w-flap-img', fr.flap.w, fr.flap.h, front); fi.style.position = 'absolute'; fi.style.left = fr.flap.x + 'px'; fi.style.top = fr.flap.y + 'px'; fi.style.transform = 'none'; fi.style.willChange = 'auto'; }
    else el('div', 'w-flap', front);
    var title = el('p', 'w-title', front); title.style.left = fr.tx + 'px'; title.style.top = fr.ty + 'px';
    title.textContent = fr.title;
    var desc = el('p', 'w-desc', front); desc.style.left = fr.dx + 'px'; desc.style.top = fr.dy + 'px'; desc.textContent = fr.desc;
    var note = el('p', 'w-part w-note w-note--' + v, comp);
    note.style.width = sp.note.w + 'px';
    var setNote = function () { note.textContent = window.I18N ? I18N.t('work.' + v + '.note', sp.note.text) : sp.note.text; };
    setNote(); document.addEventListener('langchange', setNote);

    var units = sp.parts.map(function (pt, k) {
      var node = nodes[k];
      var rest = { x: pt.rest.x, y: pt.rest.y, r: pt.rest.r, w: pt.w };
      return poseUnit(node, pt.key, rest, pt.spot, v, function (p) {
        if (pt.lift) node.style.zIndex = p > .12 ? 5 : '';
        if (pt.fade) node.style.opacity = clamp(p / .15, 0, 1).toFixed(3);
      });
    });
    // clip release (driven by the first unit's progress via its own extra: wrap)
    (function () {
      var u0 = units[0], d0 = u0.draw;
      u0.draw = function (u) {
        var q = clamp(u.p / .3, 0, 1);
        papers.style.clipPath = clipCss(sp.clip.map(function (c) { return lerp(c, -600, q); }));
        d0(u);
      };
    })();
    {
      // folder fades + shrinks away, the centred black title takes over
      var title2 = el('p', 'w-part w-title2', comp);
      title2.innerHTML = '<span class="w-t1"></span><span class="w-t2"></span>';
      title2.firstChild.textContent = sp.title.l1;
      var setT2 = function () { title2.lastChild.textContent = window.I18N ? I18N.t('work.' + v + '.l2', sp.title.l2) : sp.title.l2; };
      setT2(); document.addEventListener('langchange', setT2);
      var away = function (node, y0) {
        return { el: node, dIn: D.mid[0], dOut: D.mid[1], amp: AMP.mid, tilt: 0, kf: KF.mid, draw: function (u) {
          var q = clamp(u.p / .55, 0, 1);
          node.style.opacity = (1 - q).toFixed(3);
          node.style.visibility = q >= 1 ? 'hidden' : 'visible';
          node.style.transform = 'translate3d(' + f(u.px) + 'px,' + f(u.py + y0 * clamp(u.p, 0, 1)) + 'px,0) scale(' + (1 - .12 * clamp(u.p, 0, 1)).toFixed(4) + ')';
        } };
      };
      // front keeps its own top (227) via layout, so its transform only carries the offset: set top in px, transform extra
      units.push(away(back, 14), away(front, 14));
      units.push({ el: title2, dIn: 40, dOut: 15, amp: 6, tilt: 0, kf: 1, draw: function (u) {
        var q = clamp((u.p - .4) / .5, 0, 1);
        title2.style.opacity = q.toFixed(3);
        title2.style.transform = 'translate3d(' + f(sp.title.x + u.px) + 'px,' + f(sp.title.y + (1 - clamp(u.p, 0, 1)) * 14 + u.py) + 'px,0)';
      } });
      units.push(noteUnit(note, sp.note));
    }

    var b = sp.bounds, K = 1.25, inst;
    /* phones: the open spotlight is wider than the screen (the note alone is 526 card px), so while it opens the whole composition shrinks
       to fit (Q) around the middle of its open bounds, and that middle slides to the screen centre. Q = 1 elsewhere. */
    var M = null, Q = 1, PV = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 }, mq = window.__mobileFit && window.__mobileFit.mq;
    function place(p) {
      if (!M) return;
      var t = clamp(p, 0, 1), z = 1 + (Q - 1) * t, k = K * z;
      var px = M.x + PV.x * K, py = M.y + PV.y * K;                       // pivot at rest, stage px
      var cx = px + (SW / 2 - px) * (Q < 1 ? t : 0);                       // slides to the screen centre (stage is centred on screen)
      comp.style.transform = 'translate(' + f(cx - PV.x * k) + 'px,' + f(py - PV.y * k) + 'px) scale(' + k.toFixed(4) + ')';
    }
    (function () { var u0 = units[0], d0 = u0.draw; u0.draw = function (u) { place(u.p); d0(u); }; })();
    inst = SP.create({
      comp: comp, source: a, space: space, spaceW: SW, dimWhenOther: true,
      units: units,
      layout: function () {
        var m = measure(a);
        if (!m.w) return null;
        K = m.w / 360; M = m;
        var sc = space.getBoundingClientRect().width / SW || 1;
        Q = mq && mq.matches ? Math.min(1, (window.innerWidth - 24) / sc / ((b.x2 - b.x1) * K)) : 1;
        place(inst && inst.isOpen ? 1 : 0);
        var P = 10, KP = 40, k = K * Q, ox = (Q < 1 ? SW / 2 : m.x + PV.x * K) - PV.x * k, oy = m.y + PV.y * K - PV.y * k;   // open pose origin
        return {
          open: { rect: { x1: m.x - P, y1: m.y - P, x2: m.x + m.w + P, y2: m.y + m.h + P } },
          keep: { x1: Math.min(m.x, ox + b.x1 * k) - KP, y1: Math.min(m.y, oy + b.y1 * k) - KP, x2: Math.max(m.x + m.w, ox + b.x2 * k) + KP, y2: Math.max(m.y + m.h, oy + b.y2 * k) + KP }
        };
      },
      onShown: function (on) {   // reduced motion: poses snap, so cross-fade the whole composition instead
        if (SP.reduced.matches && comp.animate) comp.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 220, easing: 'linear' });
      }
    });
    // Navigation only on a genuine activation: trusted mouse click (with its own pointerdown), Enter/Space on the focused link (detail 0),
    // or the second tap on touch. Programmatic .click() / dispatched events never navigate; a press that moved or came with page scroll doesn't count.
    // The parts' pointer-events flip with the open state, so pointerdown and pointerup can land on different elements and the click then targets
    // their common ancestor: so one document-level handler decides by position (open zone, or the whole open spotlight) instead of by target.
    var wasOpen = false, down = null;
    var url = new URL(a.getAttribute('data-href'), location.href).href;
    function go() { window.location.href = url; }
    function genuine(e) {
      if (!e.isTrusted || !down || performance.now() - down.t > 1500) return false;   // synthetic, or a click with no matching press
      return Math.abs(e.clientX - down.x) < 12 && Math.abs(e.clientY - down.y) < 12 && Math.abs(window.scrollY - down.sy) < 4;
    }
    document.addEventListener('pointerdown', function (e) { wasOpen = inst.isOpen; down = { x: e.clientX, y: e.clientY, sy: window.scrollY, t: performance.now() }; }, true);
    document.addEventListener('click', function (e) {
      if (!genuine(e)) return;
      var p = inst.toStage(e.clientX, e.clientY);
      if (!(inst.inOpen(p) || (inst.isOpen && inst.inKeep(p)))) return;
      if (window.matchMedia('(hover: none)').matches && !wasOpen) return;   // touch: the first tap only opens
      go();
    }, true);
    a.addEventListener('keydown', function (e) { if (e.isTrusted && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(); } });
    return inst;
  }

  var instA = build('a', document.getElementById('work-card'));
  var instB = build('b', document.getElementById('work-card-b'));
  function relayout() { if (!instA.isOpen) instA.relayout(); if (!instB.isOpen) instB.relayout(); }
  instA.relayout(); instB.relayout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  window.addEventListener('load', relayout);
  window.addEventListener('resize', relayout);
  window.__work = { a: instA, b: instB };
})();
