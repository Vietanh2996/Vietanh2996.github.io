/* About section: wires js/pages/spotlight.js (engine) to
     1. the Việt Anh avatar in the pill  -> contact composition (badge, tagline, card, person)
     2. the 3 skill chips                -> each chip zooms and a cluster of ALL its chips springs out
   and rotates the words of the 3 chips ("I design [..] I build [..]" on row 1, "and ship with [..]" on row 2).
   ?tune adds a "Câu skill" panel (rotation timing). */
(function () {
  'use strict';
  var SP = window.Spotlight;
  var space = document.getElementById('about-stage');
  var layerRoot = document.getElementById('about-sp');
  if (!SP || !space || !layerRoot) return;

  var SW = 1920;                        // design width of the stage (stage px)
  var reduced = SP.reduced;

  /* ================= CONFIG (tune here) ================= */
  // Rotation (live-editable with ?tune): ms / px
  var ROT = {
    first: [2000, 3200, 2500],   // lần đổi đầu theo từng chip (I design, I build, ship with): uneven so it feels random
    period: 3000,    // nhịp đổi chữ: after the first change, each chip changes every 3s
    stagger: 0,      // unused (kept for the ?tune panel)
    slideMs: 600,    // thời gian trượt chữ
    dist: 24,        // quãng trượt
    blur: 4          // độ mờ
  };
  var WIDTH_SPRING = { k: 650, c: 32 };  // chip width follows the new text with the approved spring

  // One config array drives everything: words, tint, glyph. To use real icons later add `icon: 'assets/home/icons/x.svg'` to an item
  // (it replaces the glyph). tint = Figma accent/<tint>/subtle (tile) + accent/<tint>/text (glyph), see css/pages/about.css.
  var SKILLS = [
    { items: [   // "I design [..]"
      { label: 'End-to-end products', tint: 'blue',   glyph: 'EP', icon: 'assets/home/icons/skill/end-to-end-products.svg' },
      { label: 'AI chatbots',         tint: 'green',  glyph: 'AC', icon: 'assets/home/icons/skill/ai-chatbots.svg' },
      { label: 'Mobile apps',         tint: 'yellow', glyph: 'MA', icon: 'assets/home/icons/skill/mobile-apps.svg' }
    ] },
    { items: [   // "I build [..]"
      { label: 'Multi-brand DS', tint: 'purple', glyph: 'DS', icon: 'assets/home/icons/skill/multi-brand-ds.svg' },
      { label: 'AI workflows',               tint: 'orange', glyph: 'AW', icon: 'assets/home/icons/skill/ai-workflows.svg' },
      { label: 'AI agents',                  tint: 'pink',   glyph: 'AG', icon: 'assets/home/icons/skill/ai-agents.svg' },
      { label: 'Production-ready UI',        tint: 'blue',   glyph: 'UI', icon: 'assets/home/icons/skill/production-ui.svg' }
    ] },
    { items: [   // "and ship with [..]"
      { label: 'Claude Code',    tint: 'orange', glyph: 'CC', icon: 'assets/home/icons/skill/claude-code.svg' },
      { label: 'Figma MCP',      tint: 'purple', glyph: 'FM', icon: 'assets/home/icons/skill/figma-mcp.svg' },
      { label: 'Self-built platform', tint: 'red',   glyph: 'VA', icon: 'assets/home/icons/skill/my-own-platform.svg' }
    ] }
  ];

  // Chip spotlight geometry (stage px)
  var CHIP = {
    zoom: 1.2,        // the hovered chip zooms up to this scale
    openPad: 14,      // OPEN zone = chip rect + pad
    keepPad: { l: 48, r: 48, t: 40, b: 56 },
    below: 40,        // gap between the chip and the first row of the cluster
    gapX: 14, gapY: 14, perRow: 2,
    rot:   [-2.5, 2, 1.5, -2],      // final tilt of each option chip (deg)
    r0:    [-25, 20, -30, 24],      // start tilt (deg), flies out of the chip at scale .4
    amp:   [16, 20, 14, 18],        // parallax px at full deflection
    kf:    [1.1, 1, .9, 1.05],
    dIn:   [20, 40, 60, 60],        // open stagger (ms), same pattern as the avatar layers
    dOut:  [30, 15, 0, 0]           // close stagger (ms)
  };
  // Avatar spotlight geometry
  var AV = {
    K: .72,           // design px -> stage px for the whole composition (the card text is 18px in design). .72 keeps the tagline inside a 16:9 viewport with the block centred
    pad: 16           // OPEN zone = avatar circle + pad (stage px)
  };

  /* ================= helpers ================= */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  // rect of an element in stage px (relative to the About stage, independent of its scale)
  function measure(node) {
    var r = node.getBoundingClientRect(), sr = space.getBoundingClientRect(), s = sr.width / SW || 1;
    return { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s };
  }

  /* ================= 1. avatar spotlight ================= */
  var avComp = $('avatar-comp'), avSrc = $('who-avatar'), pillEl = document.querySelector('.who-pill');
  if (pillEl) pillEl.addEventListener('click', function (e) { if (!avSrc.contains(e.target)) avSrc.click(); });   // touch / click on the name acts like the avatar
  var groupEl = $('avatar-group'), photoEl = $('avatar-photo'), personEl = $('person'), ringEl = $('avatar-ring');
  // design constants of the composition (Figma): rest circle, the group's scale origin, circle centre relative to that origin
  var O = { x: 280.649, y: 549.086 }, C = { x: -6.192, y: -142.058 }, CIRCLE = { x: 274.457, y: 407.028 };
  var G1 = 2.2032;      // group scale when fully open
  var g0 = 1;           // group scale at rest: avatar slot width / 165 / K, set in layout
  var avBase = [null, { dx: 213.14, dy: 184.93 }, { dx: -97.16, dy: 352.65 }, { dx: -345.25, dy: 167.04 }, { dx: 11.457, dy: -211.972 }];

  /* phones: the open composition is drawn at ~9px text, so while it opens it zooms (ZQ) around the avatar circle (the face stays where it was,
     like on desktop) as far as the screen width allows. AVB = its open bounds in design px with the phone layer boxes from mobile.css
     (one-column contact card 425..715, narrower note -17..543, tagline top 19, note bottom ~739). */
  var AVB = { x1: -17, y1: 19, x2: 725, y2: 739 }, ZW = null, ZQ = 1, avMq = window.__mobileFit && window.__mobileFit.mq;   // phone layer boxes (mobile.css)
  function zoomComp(p) {
    if (!ZW) return;
    var t = SP.clamp(p, 0, 1), K = AV.K;
    if (ZQ === 1 || t === 0) { avComp.style.transform = 'translate(' + ZW.x.toFixed(2) + 'px,' + ZW.y.toFixed(2) + 'px) scale(' + K + ')'; return; }
    var bx = CIRCLE.x, by = CIRCLE.y;                                        // pivot: the avatar circle (design px)
    var cx = ZW.x + bx * K, cy = ZW.y + by * K, k = K * (1 + (ZQ - 1) * t);  // stays put (stage px)
    avComp.style.transform = 'translate(' + (cx - bx * k).toFixed(2) + 'px,' + (cy - by * k).toFixed(2) + 'px) scale(' + k.toFixed(4) + ')';
  }
  function drawPerson(u) {
    var p = u.p;
    zoomComp(p);
    groupEl.style.transform = 'translate3d(' + u.px.toFixed(2) + 'px,' + u.py.toFixed(2) + 'px,0) scale(' + (g0 + (G1 - g0) * p).toFixed(4) + ')';
    personEl.style.clipPath = 'circle(' + (82.5 + 92.5 * SP.clamp(p, 0, 1.15)).toFixed(2) + 'px at 81.208px 66.412px)';
    var po = (1 - SP.clamp(p / 0.25, 0, 1)).toFixed(3);
    photoEl.style.opacity = po;
    ringEl.style.opacity = po;
  }

  function layoutAvatar(inst) {
    var m = measure(avSrc);
    if (!m.w) return null;
    var K = AV.K, Sx = m.x + m.w / 2, Sy = m.y + m.h / 2;
    g0 = m.w / 165 / K;
    // comp placed so the circle centre at rest (O + C * g0) lands on the avatar slot centre
    var Wx = Sx - K * (O.x + C.x * g0), Wy = Sy - K * (O.y + C.y * g0);
    ZW = { x: Wx, y: Wy };
    var sc = space.getBoundingClientRect().width / SW || 1;
    if (avMq && avMq.matches) {                 // widest zoom that keeps both sides 8px inside the screen, the circle fixed
      var sl = space.getBoundingClientRect().left, pc = sl + (Wx + CIRCLE.x * K) * sc, G = 8;
      ZQ = Math.max(1, Math.min((pc - G) / ((CIRCLE.x - AVB.x1) * K * sc), (window.innerWidth - G - pc) / ((AVB.x2 - CIRCLE.x) * K * sc)));
      [[3, '.layer--card'], [4, '.layer--note']].forEach(function (a) {   // these boxes moved (mobile.css): fly out from the circle to their new centres
        var l = avComp.querySelector(a[1]);
        if (l) avBase[a[0]] = { dx: CIRCLE.x - (l.offsetLeft + l.offsetWidth / 2), dy: CIRCLE.y - (l.offsetTop + l.offsetHeight / 2) };
      });
    } else { ZQ = 1; avBase[3] = { dx: -345.25, dy: 167.04 }; avBase[4] = { dx: 11.457, dy: -211.972 }; }
    zoomComp(inst && inst.isOpen ? 1 : 0);
    // satellites fly out of the slot centre (design coords of it: (S - W) / K); with g0 = 1 this is exactly the original offsets
    var sdx = (Sx - Wx) / K - CIRCLE.x, sdy = (Sy - Wy) / K - CIRCLE.y;
    for (var i = 1; i < inst.units.length; i++) { inst.units[i].dx = avBase[i].dx + sdx; inst.units[i].dy = avBase[i].dy + sdy; }
    // white ring (Figma stroke 6 outside + soft shadows) in design px so it reads 6 stage px at rest
    var f = 1 / (g0 * K), w = SP.SPRING.ringWidth * f;
    // soft shadows removed for test (keep only the white ring). Old values to restore: ', 0 ' + f + 'px ' + 3 * f + 'px ' + w + 'px rgba(0,0,0,.15), 0 0 ' + .5 * f + 'px ' + w + 'px rgba(0,0,0,.3)'
    // white ring + the same hard shadow as the stickers (0 6px 0, black 10%, following the ring outline)
    ringEl.style.boxShadow = '0 0 0 ' + w + 'px #fff, 0 ' + 6 * f + 'px 0 ' + w + 'px rgba(0,0,0,.1)';
    return {
      // hovering anywhere on the Việt Anh pill (name text included) opens it: OPEN zone = union of the pill and the avatar circle, + pad
      open: (function () {
        var pm = pillEl ? measure(pillEl) : m, P = AV.pad, r = m.w / 2;
        return { rect: { x1: Math.min(pm.x, Sx - r) - P, y1: Math.min(pm.y, Sy - r) - P, x2: Math.max(pm.x + pm.w, Sx + r) + P, y2: Math.max(pm.y + pm.h, Sy + r) + P } };
      })(),
      // original KEEP rect (design -40,-24 .. 860,610) mapped to stage px
      // bottom extended from 610 to 760: the handwritten note hangs down to design y 699 (+ the same ~60 padding)
      keep: ZQ > 1 ? { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 }   // zoomed to fill the phone screen: stays open until a tap outside the parts (engine)
                   : { x1: Wx - 40 * K, y1: Wy - 24 * K, x2: Wx + 860 * K, y2: Wy + 760 * K }
    };
  }

  var avatar = SP.create({
    comp: avComp, source: avSrc, space: space, spaceW: SW, dimWhenOther: true,
    layout: layoutAvatar,
    units: [
      { el: personEl, dIn: 0,  dOut: 30, amp: 6,  tilt: 0, kf: .8, draw: drawPerson },
      { el: avComp.querySelector('.layer--badge'),   dIn: 20, dOut: 30, amp: 22, tilt: 0, kf: 1.1, sat: { dx: 213.14,  dy: 184.93, s0: .4, r0: -25 } },
      { el: avComp.querySelector('.layer--tagline'), dIn: 40, dOut: 15, amp: 16, tilt: 1, kf: 1,   sat: { dx: -97.16,  dy: 352.65, s0: .4, r0: 20 } },
      { el: avComp.querySelector('.layer--card'),    dIn: 60, dOut: 0,  amp: 14, tilt: 1, kf: .9,  sat: { dx: -345.25, dy: 167.04, s0: .4, r0: -30 } },
      // handwritten note (the intro), springs in right after the card; parallax like the card
      { el: avComp.querySelector('.layer--note'),    dIn: 80, dOut: 0,  amp: 14, tilt: 1, kf: .85, sat: { dx: 11.457,  dy: -211.972, s0: .4, r0: -12 } }
    ]
  });
  avatar.relayout();

  /* ================= 2. skill chips ================= */
  function makeTile(it) {
    var t = el('span', 'sc-ico');
    t.style.setProperty('--tint', 'var(--accent-' + it.tint + '-subtle)');
    t.style.setProperty('--ink', 'var(--accent-' + it.tint + '-text)');
    if (it.icon) { var img = el('img', '', t); img.src = it.icon; img.alt = ''; img.style.marginLeft = -iconEdge(it)[1] + 'px'; }
    else t.textContent = it.glyph || it.label.charAt(0).toUpperCase();
    return t;
  }
  function makeWord(it) { var w = el('span', 'sc-word'); w.textContent = it.label; return w; }
  // Per sticker: [displayed width, visible left edge, visible right edge] in px from the image's left (alpha scan incl. outline+shadow;
  // the Claude sprite uses the extremes over its frames). The sticker is left-aligned so its visible left edge sits at the slot's left
  // (= the chip's 8px padding, so a sliver of the chip shows behind it); the box's margin-right is (visible width - 48px slot), which with
  // the chip's 12px flex gap leaves a constant 12px between the visible right edge and the label.
  var ICON_EDGE = {
    'end-to-end-products': [101, 4, 96.7], 'ai-chatbots': [80, 4, 75.7], 'mobile-apps': [68, 4, 63.7], 'multi-brand-ds': [101, 6.7, 94],
    'ai-workflows': [88, 5.3, 82.3], 'ai-agents': [93, 4, 88.3], 'production-ui': [93, 4.7, 88.3], 'my-own-platform': [93, 4.7, 88.3],
    'figma-mcp': [87, 4.7, 74.3], 'claude-code': [89, 4.7, 86]
  };

  function iconEdge(it) { var m = it.icon && /([^\/]+)\.svg$/.exec(it.icon); return m && ICON_EDGE[m[1]]; }
  function iconGap(it) { var e = iconEdge(it); return e ? e[2] - e[1] - 48 : 0; }
  // fills a chip element with icon + label track for item `it`
  function fillChip(chipEl, it) {
    chipEl.textContent = '';
    var box = el('span', 'sc-icon', chipEl), track = el('span', 'sc-label', chipEl);
    box.appendChild(makeTile(it)); track.appendChild(makeWord(it));
    box.style.marginRight = iconGap(it).toFixed(2) + 'px';
    return { box: box, track: track };
  }

  var chips = SKILLS.map(function (slot, si) {
    var chipEl = document.querySelector('.skill-chip[data-slot="' + si + '"]');
    var c = { i: si, slot: slot, el: chipEl, cur: 0, width: 0, vel: 0, target: 0, mg: 0, mvel: 0, mtarget: 0, raf: 0, lastTs: 0, nextAt: 0 };
    var parts = fillChip(chipEl, slot.items[0]);
    c.box = parts.box; c.track = parts.track;
    buildSpotlight(c);
    return c;
  });

  // ---------- chip spotlight: one composition per slot, built once ----------
  function buildSpotlight(c) {
    var comp = el('div', 'sp-comp sp-comp--chip', layerRoot);
    c.comp = comp;
    var clone = el('div', 'skill-chip sp-clone', comp);
    c.clone = clone;
    // the zoomed chip is the current word, so the cluster only holds the OTHER words of the slot (filled in layoutChip)
    c.opts = c.slot.items.slice(1).map(function (it, k) {
      var layer = el('div', 'sp-layer sp-opt', comp);
      var chip = el('div', 'skill-chip skill-chip--opt', layer);
      chip.style.setProperty('--rot', CHIP.rot[k % CHIP.rot.length] + 'deg');
      return { layer: layer, chip: chip };
    });
    var n = c.opts.length;
    var units = [{ el: clone, dIn: 0, dOut: 30, amp: 6, tilt: 0, kf: .8, draw: function (u) {
      clone.style.transform = 'translate3d(' + u.px.toFixed(2) + 'px,' + u.py.toFixed(2) + 'px,0) scale(' + (1 + (CHIP.zoom - 1) * u.p).toFixed(4) + ')';
    } }];
    for (var k = 0; k < n; k++) {
      units.push({ el: c.opts[k].layer, dIn: CHIP.dIn[k % 4], dOut: CHIP.dOut[k % 4], amp: CHIP.amp[k % 4], tilt: 1, kf: CHIP.kf[k % 4],
                   sat: { dx: 0, dy: 0, s0: .4, r0: CHIP.r0[k % 4] } });
    }
    c.inst = SP.create({
      comp: comp, source: c.el, space: space, spaceW: SW,
      units: units,
      layout: function (inst) { return layoutChip(c, inst); },
      onShown: function (on) {     // the zoomed copy replaces the real chip while the spotlight is out (opacity, not visibility: keeps keyboard focus)
        clone.style.visibility = on ? 'visible' : 'hidden';
        c.el.style.opacity = on ? '0' : '';
      }
    });
  }

  function layoutChip(c, inst) {
    var m = measure(c.el);
    if (!m.w) return null;
    var it = c.slot.items[c.cur];
    // zoomed copy = the real chip as it is right now
    fillChip(c.clone, it);
    c.clone.style.left = m.x + 'px'; c.clone.style.top = m.y + 'px'; c.clone.style.width = m.w + 'px'; c.clone.style.height = m.h + 'px';
    var others = c.slot.items.filter(function (_, i) { return i !== c.cur; });
    c.opts.forEach(function (o, k) { fillChip(o.chip, others[k]); });
    // the other words in rows under the chip, each row centred on it
    var cx = m.x + m.w / 2, cy = m.y + m.h / 2;
    var rowTop = m.y + m.h + CHIP.below, rows = [], k;
    for (k = 0; k < c.opts.length; k += CHIP.perRow) rows.push(c.opts.slice(k, k + CHIP.perRow));
    var bx1 = m.x, by1 = m.y, bx2 = m.x + m.w, by2 = m.y + m.h, idx = 1;
    // the stage is cropped by the window on narrow screens: keep the cluster rows inside what is actually visible (stage px)
    var sr = space.getBoundingClientRect(), ss = sr.width / SW || 1;
    var vx1 = Math.max(0, -sr.left / ss), vx2 = Math.min(SW, (document.documentElement.clientWidth - sr.left) / ss);
    rows.forEach(function (row) {
      var widths = row.map(function (o) { return o.chip.offsetWidth; });
      var rowW = widths.reduce(function (a, b) { return a + b; }, 0) + CHIP.gapX * (row.length - 1);
      var left = SP.clamp(cx - rowW / 2, vx1 + 40, vx2 - 40 - rowW), h = row[0].chip.offsetHeight;
      row.forEach(function (o, j) {
        o.layer.style.left = left + 'px'; o.layer.style.top = rowTop + 'px';
        o.layer.style.width = widths[j] + 'px'; o.layer.style.height = h + 'px';
        var u = inst.units[idx++];
        u.dx = cx - (left + widths[j] / 2); u.dy = cy - (rowTop + h / 2);
        bx1 = Math.min(bx1, left); bx2 = Math.max(bx2, left + widths[j]); by2 = Math.max(by2, rowTop + h);
        left += widths[j] + CHIP.gapX;
      });
      rowTop += h + CHIP.gapY;
    });
    c.comp.style.perspectiveOrigin = ((bx1 + bx2) / 2) + 'px ' + ((by1 + by2) / 2) + 'px';
    var P = CHIP.openPad, KP = CHIP.keepPad;
    return {
      open: function () { var r = measure(c.el); return { rect: { x1: r.x - P, y1: r.y - P, x2: r.x + r.w + P, y2: r.y + r.h + P } }; },
      keep: { x1: bx1 - KP.l, y1: by1 - KP.t, x2: bx2 + KP.r, y2: by2 + KP.b }
    };
  }

  /* ================= 3. word rotation ================= */
  function applyWidth(c) { c.track.style.width = c.width.toFixed(2) + 'px'; c.box.style.marginRight = c.mg.toFixed(2) + 'px'; }
  function widthTick(c, now) {
    var dt = Math.min((now - c.lastTs) / 1000, 1 / 30);
    c.lastTs = now;
    var n = Math.max(1, Math.round(dt * 240)), h = dt / n, s;
    for (s = 0; s < n; s++) {
      c.vel += (-WIDTH_SPRING.k * (c.width - c.target) - WIDTH_SPRING.c * c.vel) * h;
      c.width += c.vel * h;
      c.mvel += (-WIDTH_SPRING.k * (c.mg - c.mtarget) - WIDTH_SPRING.c * c.mvel) * h;   // sticker gap follows the same spring
      c.mg += c.mvel * h;
    }
    if (Math.abs(c.width - c.target) < 0.05 && Math.abs(c.vel) < 0.5 && Math.abs(c.mg - c.mtarget) < 0.05 && Math.abs(c.mvel) < 0.5) {
      c.width = c.target; c.vel = 0; c.mg = c.mtarget; c.mvel = 0; applyWidth(c); c.raf = 0; return;
    }
    applyWidth(c);
    c.raf = requestAnimationFrame(function (t) { widthTick(c, t); });
  }
  function animateWidth(c, to, mto) {
    c.target = to; c.mtarget = mto;
    if (!c.raf) { c.lastTs = performance.now(); c.raf = requestAnimationFrame(function (t) { widthTick(c, t); }); }
  }
  function slide(node, out) {
    var d = ROT.dist, b = ROT.blur;
    var kf = out
      ? [{ transform: 'translateY(0)', opacity: 1, filter: 'blur(0px)' }, { transform: 'translateY(' + (-d) + 'px)', opacity: 0, filter: 'blur(' + b + 'px)' }]
      : [{ transform: 'translateY(' + d + 'px)', opacity: 0, filter: 'blur(' + b + 'px)' }, { transform: 'translateY(0)', opacity: 1, filter: 'blur(0px)' }];
    var a = node.animate(kf, { duration: ROT.slideMs, easing: 'cubic-bezier(.22,1,.36,1)', fill: out ? 'forwards' : 'none' });
    if (out) a.onfinish = function () { if (node.parentNode) node.parentNode.removeChild(node); };
  }
  // icon swap: new sticker pops in (scale .3 / -25deg -> 1 with overshoot), old one pops out the other way; reduced motion = plain swap
  function popIcon(node, out, it) {
    var e = iconEdge(it), kf, o;
    node.style.transformOrigin = (e ? (e[2] - e[1]) / 2 : 24) + 'px 50%';
    if (reduced.matches) { if (out && node.parentNode) node.parentNode.removeChild(node); return; }
    kf = out
      ? [{ transform: 'scale(1) rotate(0deg)', opacity: 1 }, { transform: 'scale(.3) rotate(25deg)', opacity: 0 }]
      : [{ transform: 'scale(.3) rotate(-25deg)', opacity: 0 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }];
    o = out ? { duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' } : { duration: 440, easing: 'cubic-bezier(.34,1.7,.5,1)', fill: 'backwards' };
    var a = node.animate(kf, o);
    if (out) a.onfinish = function () { if (node.parentNode) node.parentNode.removeChild(node); };
  }
  function advance(c) {
    var idx = (c.cur + 1) % c.slot.items.length, it = c.slot.items[idx];
    var oldWord = c.track.querySelector('.sc-word:not(.is-out)'), oldIco = c.box.querySelector('.sc-ico:not(.is-out)');
    if (!c.raf) { c.width = c.track.offsetWidth; c.vel = 0; c.mg = parseFloat(c.box.style.marginRight) || 0; c.mvel = 0; applyWidth(c); }
    var nw = makeWord(it), ni = makeTile(it);
    c.track.appendChild(nw); c.box.appendChild(ni);
    c.cur = idx;
    if (oldWord) { oldWord.classList.add('is-out'); slide(oldWord, true); }
    if (oldIco) { oldIco.classList.add('is-out'); popIcon(oldIco, true, c.slot.items[(idx + c.slot.items.length - 1) % c.slot.items.length]); }
    slide(nw, false); popIcon(ni, false, it);
    animateWidth(c, nw.offsetWidth, iconGap(it));   // layout width of the new text, unaffected by the stage scale
  }

  function hovered(c) { return c.inst.pointerInside || c.el.matches(':hover') || document.activeElement === c.el; }
  function resetPhases() {
    var now = performance.now();
    chips.forEach(function (c) { c.nextAt = now + ROT.first[c.i]; });
  }
  function poll() {
    var now = performance.now(), open = SP.isAnyOpen();
    chips.forEach(function (c) {
      if (open || document.hidden) { c.nextAt = now + ROT.period + ROT.first[c.i] - ROT.first[0]; return; }  // keeps the uneven offsets for when it resumes
      if (hovered(c)) { c.nextAt = now + ROT.period; return; }
      if (now >= c.nextAt) { advance(c); c.nextAt = now + ROT.period; }
    });
  }
  // reduced motion: no rotation, static first word
  var started = false;
  function start() {
    if (started || reduced.matches) return;
    started = true;
    resetPhases();
    setInterval(poll, 50);
  }

  // The sentence words sit next to chips with a 12px flex gap, but the glyphs have side bearings (+ trailing letter-spacing), so the
  // visible gap varied per word. Measure each word's ink bearings and cancel them with negative margins: ink-to-chip gap = 12px everywhere.
  document.addEventListener('langchange', function () { relayoutAll(); });   // text widths change with the language: the avatar + chips follow
  function trimInk() {
    var cx = document.createElement('canvas').getContext('2d');
    Array.prototype.forEach.call(document.querySelectorAll('.about-skill > .skill-row > .ab-t, .about-hello > .ab-t'), function (sp) {
      var cs = getComputedStyle(sp);
      cx.font = cs.font; cx.letterSpacing = cs.letterSpacing;
      var m = cx.measureText(sp.textContent), w = cx.measureText(sp.textContent).width;
      var lb = -m.actualBoundingBoxLeft, rb = w - m.actualBoundingBoxRight;   // ink inset from the box's left / right edge
      sp.style.marginLeft = (-lb).toFixed(2) + 'px'; sp.style.marginRight = (-rb).toFixed(2) + 'px';
    });
    var nm = document.querySelector('.who-pill > .ab-t');   // the name inside the pill: only the left side (against the avatar) is trimmed
    if (nm) { cx.font = getComputedStyle(nm).font; cx.letterSpacing = getComputedStyle(nm).letterSpacing; nm.style.marginLeft = cx.measureText(nm.textContent).actualBoundingBoxLeft.toFixed(2) + 'px'; }
  }
  // Sticker SVGs animate themselves (CSS inside the <img>), but an <img> that was created and loaded before it was ever painted
  // (script runs before layout, the section is below the fold at load) can sit on its first frame until the element is replaced:
  // icons created later by the word rotation always ran. So each chip's initial icon is re-created once, the first time the chip is
  // actually on screen (and again after window load), which is exactly what the rotation does.
  function freshIcon(c) {
    var im = c.box.querySelector('.sc-ico:not(.is-out) img');
    if (!im) return;
    var n = im.cloneNode(false);
    im.parentNode.replaceChild(n, im);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var c = chips.filter(function (x) { return x.el === e.target; })[0];
        if (c) { freshIcon(c); io.unobserve(e.target); }
      });
    });
    chips.forEach(function (c) { io.observe(c.el); });
  }
  window.addEventListener('load', function () { chips.forEach(function (c) { if (c.cur === 0) freshIcon(c); }); });

  // hero toast only while the hero is on screen
  (function () {
    var hero = document.querySelector('section.thumb');
    if (!hero || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (es) {
      document.documentElement.classList.toggle('hero-out', es[es.length - 1].intersectionRatio < 0.5);
    }, { threshold: [0, 0.5, 1] }).observe(hero);
  })();

  // positions depend on the text widths, so re-measure when fonts arrive
  function relayoutAll() {
    trimInk();
    avatar.relayout();
    chips.forEach(function (c) { if (!c.inst.isOpen) c.inst.relayout(); });
  }
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(function () { relayoutAll(); start(); });
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', relayoutAll);
  } else start();
  window.addEventListener('load', function () { relayoutAll(); start(); });

  window.__about = { ROT: ROT, chips: chips, avatar: avatar, relayoutAll: relayoutAll, advance: advance };

  /* ================= ?tune: "Câu skill" panel (bottom-right, left of the spring panel) ================= */
  if (/[?&]tune\b/.test(location.search)) {
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;right:254px;bottom:12px;z-index:100;width:230px;padding:10px 12px;background:#fff;' +
      'border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.2);font:12px/1.4 system-ui,sans-serif;color:#111';
    var title = document.createElement('div'); title.textContent = 'Câu skill'; title.style.cssText = 'font-weight:600;margin-bottom:4px';
    panel.appendChild(title);
    [['period', 'Nhịp đổi chữ (ms)', 1500, 12000, 100], ['stagger', 'Lệch nhịp giữa các ô (ms)', 0, 4000, 50],
     ['slideMs', 'Thời gian trượt chữ (ms)', 100, 1500, 10], ['dist', 'Quãng trượt (px)', 0, 60, 1], ['blur', 'Độ mờ (px)', 0, 12, .5]].forEach(function (d) {
      var row = document.createElement('label'), name = document.createElement('div'), out = document.createElement('b'), inp = document.createElement('input');
      row.style.cssText = 'display:block;margin:4px 0';
      out.style.cssText = 'float:right;font-weight:600'; out.textContent = ROT[d[0]];
      name.textContent = d[1]; name.appendChild(out);
      inp.type = 'range'; inp.min = d[2]; inp.max = d[3]; inp.step = d[4]; inp.value = ROT[d[0]]; inp.style.width = '100%';
      inp.addEventListener('input', function () {
        ROT[d[0]] = +inp.value; out.textContent = inp.value;
        if (d[0] === 'period' || d[0] === 'stagger') resetPhases();
      });
      row.appendChild(name); row.appendChild(inp); panel.appendChild(row);
    });
    var cp = document.createElement('button');
    cp.type = 'button'; cp.textContent = 'Copy số'; cp.style.cssText = 'margin-top:6px;font:inherit;padding:3px 10px';
    cp.addEventListener('click', function () {
      var t = 'nhịp đổi chữ: ' + ROT.period + 'ms, lệch nhịp: ' + ROT.stagger + 'ms, trượt chữ: ' + ROT.slideMs + 'ms, quãng trượt: ' + ROT.dist + 'px, độ mờ: ' + ROT.blur + 'px';
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      cp.textContent = 'Đã copy'; setTimeout(function () { cp.textContent = 'Copy số'; }, 1000);
    });
    panel.appendChild(cp);
    document.body.appendChild(panel);
  }
})();
