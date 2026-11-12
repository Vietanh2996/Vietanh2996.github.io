/* Scene-1 intro: the headline is "typed" live. One rAF loop, time-based; only transform / opacity / clip-path are written.
   Only the idle caret blink is CSS. Springs reuse spotlight.js (open k=650 c=32, m=1, semi-implicit Euler, 1/240s substeps).
   Replay for testing: add ?intro to the URL, then click anywhere in scene 1. */
(function () {
  'use strict';

  /* ================= TIMING (ms unless noted), tune here ================= */
  var TIME = {
    speed: 1,                         // global multiplier (2 = twice as fast); applied to every pause / delay / tween
    start: 150,                       // wait before the first key
    delay12: 63,                      // mean ms per char, lines 1-2 (skewed: mostly quick, some slow)
    delay3: 125,                      // mean ms per char, line 3 (incl. the Telex part)
    burstChance: .16, burstLen: [3, 5],                         // quick bursts (delay x .45-.8)
    hesitateChance: .05,                                        // short random hesitation (delay x 3)
    afterSpace: .8, afterBang: 4.5,   // extra pause after a space / "!", in mean-delay units
    think: 700,                       // "choosing the word" pause before "Product"
    telexE: 1.6, telexR: 2,           // Unikey e -> ê, r -> ể, in line-3-delay units
    toastWait: 900,                   // toast up, before the correction starts (block cursor sits still on Enginể)
    backspace: 125,                   // per deleted char (slow enough to see)
    retypeGap: 300,                   // pause between the last backspace and retyping
    toastHold: 2000, toastFade: 260,  // toast visible time (default: fades just as the retype starts), fade-out
    idleBlink: 220,                   // idle time before the caret starts blinking
    handlesPause: 140, cursorPause: 120,   // purple selection: handles -> cursor appears -> drag
    drag: 650, dragWobble: .018, dragJitter: 3,    // purple drag duration (ms), speed variation, hand jitter (px)
    cursorIn: 180, cursorLinger: 200, cursorOut: 180, cursorScale: .85,
    yellowCell: 70,                   // yellow cell grows under each typed char of "Engineer"
    frame: 1300,                      // blue framing box drawn from its top-left corner
    caretBar: 6, caretEm: .936, caretDrop: 8.5,   // thin caret: width px, height as a ratio of font-size (em), caret bottom below the baseline px
    stampScale: 2.2, stampFall: 180, stampShake: 2,   // VIBECODE stamp: start scale, fall time (ms), headline thud (px, 0 = off)
    seed: 7                           // fixed seed = same "human" rhythm every run
  };
  var SPRING = { k: 650, c: 32 };     // same as spotlight.js open
  var TOAST_TEXT = 'Switched input to English (US)';

  /* ================= TIMELINE (data) =================
     pause {ms} | caret {line, mode:'bar'|'block'|'off'} | type {line, text, think:{charIndex: ms}} | telex {line, ch, delay}
     backspace {line, n, delay} | handles | cursorIn | drag | cursorOut | toast {hold} | framing | badge
     (everything from handles on is fire-and-forget: use pause to space it) */
  function steps() { return [   // function so ?tune values are read at every replay
    { do: 'pause', ms: TIME.start },
    { do: 'caret', line: 'hi', mode: 'bar' },
    { do: 'type', line: 'hi', text: 'Hi! I’m a', rate: 12 },
    { do: 'pause', ms: 220 },
    { do: 'caret', line: 'ai', mode: 'bar' },
    { do: 'pause', ms: 120 },
    { do: 'type', line: 'ai', text: 'AI  Product  Design', rate: 12, think: { 4: TIME.think } },
    { do: 'pause', ms: 120 },
    { do: 'caret', mode: 'off' },
    { do: 'par', steps: [                                // purple selection runs on its own track while line 3 types
      { do: 'handles' },                                   // collapsed selection: both handles stacked at the left of "Product"
      { do: 'pause', ms: TIME.handlesPause },
      { do: 'cursorIn' },                                  // black move-h cursor on the right handle
      { do: 'pause', ms: TIME.cursorPause },
      { do: 'drag' },                                      // cursor + right handle + purple fill travel left -> right
      { do: 'pause', ms: TIME.drag + TIME.cursorLinger },
      { do: 'cursorOut' }
    ] },
    { do: 'pause', ms: 150 },
    { do: 'caret', line: 'eng', mode: 'block' },
    { do: 'pause', ms: 250 },
    { do: 'type', line: 'eng', text: '</Engine', rate: 3 },     // each typed char of "Engineer" also grows the yellow cell under it
    { do: 'telex', line: 'eng', ch: 'ê', delay: TIME.telexE },
    { do: 'telex', line: 'eng', ch: 'ể', delay: TIME.telexR },
    { do: 'pause', ms: 400 },
    { do: 'toast', text: TOAST_TEXT, hold: TIME.toastHold },
    { do: 'pause', ms: TIME.toastWait },
    { do: 'backspace', line: 'eng', n: 6, delay: TIME.backspace },
    { do: 'pause', ms: TIME.retypeGap },
    { do: 'type', line: 'eng', text: 'Engineer>', rate: 3 },
    { do: 'pause', ms: 100 },
    { do: 'framing' },
    { do: 'pause', ms: TIME.frame + 40 },
    { do: 'badge' }
  ]; }

  /* ================= setup ================= */
  var root = document.documentElement;
  var scene = document.querySelector('section.thumb');
  if (!scene) return;
  var head = scene.querySelector('.headline');
  var el = {
    yellow: scene.querySelector('.hl-yellow'), framing: scene.querySelector('.framing'), badge: scene.querySelector('.badge-vibe'),
    cursor: scene.querySelector('.intro-cursor'),
    fl: scene.querySelector('.fr-l'), ft: scene.querySelector('.fr-t'), fr: scene.querySelector('.fr-r'), fb: scene.querySelector('.fr-b'),
    htl: scene.querySelector('.fr-h--tl'), htr: scene.querySelector('.fr-h--tr'), hbl: scene.querySelector('.fr-h--bl'), hbr: scene.querySelector('.fr-h--br'),
    selBg: scene.querySelector('.select-bg'), hL: scene.querySelector('.handle--l'), hR: scene.querySelector('.handle--r'),
    toast: scene.querySelector('.toast')
  };
  var lines = {};
  [['hi', '.hl-hi'], ['ai', '.hl-ai'], ['eng', '.hl-eng']].forEach(function (d) {
    var node = head.querySelector(d[1]), text = node.textContent, chars = [], i, c;
    node.textContent = '';
    for (i = 0; i < text.length; i++) {            // every char takes its final place from the start: no layout jitter
      c = document.createElement('em'); c.className = 'c'; c.textContent = text[i]; node.appendChild(c); chars.push(c);
    }
    var mk = document.createElement('i'); mk.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; node.appendChild(mk);   // zero-size marker on the baseline
    lines[d[0]] = { el: node, text: text, chars: chars, n: 0, base: mk };
  });
  var caret = document.createElement('div'); caret.className = 'caret'; head.appendChild(caret);
  var caretCh = document.createElement('span'); caretCh.className = 'caret-ch'; caret.appendChild(caretCh);   // white copy of the char under the block

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dbg = window.__intro = { hold: Infinity, restart: null };   // hold = freeze the timeline at t ms (for screenshots)

  /* ================= state ================= */
  var ev, evI, anims, springs, raf = 0, t0 = 0, lastT = 0, lastOp = 0, cur = null, blinking = false, caretOn = false;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function scale() { return parseFloat(getComputedStyle(root).getPropertyValue('--stage-scale')) || 1; }
  function easeSine(p) { return .5 - .5 * Math.cos(Math.PI * p); }
  function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

  /* ---------- caret ---------- */
  function place(name, mode) {
    var L = lines[name], cs = L.chars, n = L.n, k = scale(), lr = L.el.getBoundingClientRect(), x, w, r, idx;
    if (mode === 'block') {                         // sits ON the last typed char (inverse video); slot 0 while the line is empty
      idx = clamp(n - 1, 0, cs.length - 1); r = cs[idx].getBoundingClientRect(); x = r.left;
      w = r.width / k - (parseFloat(getComputedStyle(L.el).letterSpacing) || 0);   // full monospace cell
      caretCh.textContent = n > 0 ? cs[idx].textContent : '';
      caret.classList.add('block');
    } else {
      x = n < cs.length ? cs[n].getBoundingClientRect().left : cs[n - 1].getBoundingClientRect().right;
      w = TIME.caretBar; caret.classList.remove('block');
    }
    var h = lr.height / k, dy = 0;
    if (mode !== 'block') { var ch = parseFloat(getComputedStyle(L.el).fontSize) * TIME.caretEm, bl = (L.base.getBoundingClientRect().top - lr.top) / k; dy = bl + TIME.caretDrop - ch; h = ch; }   // thin I-beam: height from font-size, bottom = baseline + caretDrop
    caret.style.width = w.toFixed(2) + 'px';
    caret.style.height = h.toFixed(2) + 'px';
    caret.style.transform = 'translate3d(' + (parseFloat(getComputedStyle(L.el).left) + (x - lr.left) / k).toFixed(2) + 'px,' + (parseFloat(getComputedStyle(L.el).top) + dy).toFixed(2) + 'px,0)';
  }
  function solid(t) {
    lastOp = t;
    if (blinking) { caret.classList.remove('blink'); blinking = false; }
  }
  function refresh(t) { if (cur && cur.mode !== 'off') { place(cur.line, cur.mode); solid(t); } }

  /* ---------- ops (what each timeline event does) ---------- */
  var ops = {
    caret: function (s, t) {
      if (s.mode === 'off') { cur = null; caretOn = false; caret.classList.remove('on', 'blink'); blinking = false; return; }
      cur = { line: s.line, mode: s.mode }; caretOn = true; caret.classList.add('on'); refresh(t);
    },
    type: function (s, t, ch) { var L = lines[s.line], c = L.chars[L.n]; c.textContent = ch; c.style.opacity = 1; L.n++; refresh(t); yellowFor(s.line, t); },
    telex: function (s, t) { var L = lines[s.line]; L.chars[L.n - 1].textContent = s.ch; refresh(t); },
    back: function (s, t) { var L = lines[s.line]; L.n--; var c = L.chars[L.n]; c.style.opacity = 0; c.textContent = L.text[L.n]; refresh(t); yellowFor(s.line, t); }
  };

  /* ---------- yellow highlight: one rect (final geometry), revealed one cell per typed char of "Engineer" (line-3 chars 2..9) ---------- */
  var yel = { cur: 0, anim: null };
  function yellowFor(name, tm) {
    if (name !== 'eng') return;
    var to = clamp(lines.eng.n - 2, 0, 8) / 8, from = yel.cur, i;
    if (yel.anim) { i = anims.indexOf(yel.anim); if (i >= 0) anims.splice(i, 1); yel.anim = null; }
    if (from === to) return;
    el.yellow.style.willChange = 'clip-path';
    yel.anim = { t0: tm, dur: D(TIME.yellowCell), node: el.yellow, will: 'clip-path', fn: function (p) {
      yel.cur = from + (to - from) * p; el.yellow.style.clipPath = 'inset(0 ' + ((1 - yel.cur) * 100).toFixed(3) + '% 0 0)';
    } };
    anims.push(yel.anim);
  }

  /* ---------- animation helpers ---------- */
  function D(ms) { return ms / TIME.speed; }
  function anim(t, dur, fn, will, node) {          // time-based tween, p 0..1
    if (will) node.style.willChange = will;
    anims.push({ t0: t, dur: dur, fn: fn, node: node, will: will });
  }
  function spring(fn, node) {                       // spotlight.js spring, p 0 -> 1
    node.style.willChange = 'transform, opacity';
    fn(0);
    springs.push({ p: 0, v: 0, fn: fn, node: node });
  }

  /* ---------- timeline compiler: STEPS -> absolute-time events (one fixed-seed random stream) ---------- */
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function compile() {
    var out = [], r = rng(TIME.seed), burst = 0, sp = TIME.speed;
    function add(at, fn) { out.push({ at: at, fn: fn }); }
    function between(a) { return a[0] + (a[1] - a[0]) * r(); }
    function human(prev, mean) {
      var d;
      if (burst > 0) { burst--; d = mean * (.45 + .35 * r()); }
      else {
        d = mean * (.35 + 1.95 * r() * r());
        if (r() < TIME.burstChance) burst = Math.round(between(TIME.burstLen));
        if (r() < TIME.hesitateChance) d += mean * 3;
      }
      if (prev === ' ') d += mean * TIME.afterSpace;
      if (prev === '!') d += mean * TIME.afterBang;
      return d / sp;
    }
    function emit(list, t) {
      list.forEach(function (s) {
      var i, prev = null, at, mean = s.rate === 3 ? TIME.delay3 : TIME.delay12;
      switch (s.do) {
        case 'pause': t += s.ms / sp; break;
        case 'par': emit(s.steps, t); break;      // parallel track: starts now, does not advance the main clock
        case 'caret': add(t, function (tm) { ops.caret(s, tm); }); break;
        case 'type':
          for (i = 0; i < s.text.length; i++) { t += human(prev, mean) + (s.think && s.think[i] || 0) / sp; prev = s.text[i]; add(t, (function (ch) { return function (tm) { ops.type(s, tm, ch); }; })(prev)); }
          break;
        case 'telex': t += s.delay * TIME.delay3 / sp; add(t, function (tm) { ops.telex(s, tm); }); break;
        case 'backspace':
          for (i = 0; i < s.n; i++) { t += s.delay * (.85 + .3 * r()) / sp; add(t, function (tm) { ops.back(s, tm); }); }
          break;
        case 'handles':
          add(t, function (tm) { spring(function (p) { popL(p); }, el.hL); });
          add(t + 60, function (tm) { spring(function (p) { popR(p); }, el.hR); });
          break;
        case 'cursorIn':
          add(t, function (tm) { anim(tm, D(TIME.cursorIn), function (p) { sel.cur = p; paintCursor(); }, 'transform, opacity', el.cursor); });
          break;
        case 'drag':    // ease-in-out with a slight speed wobble + hand jitter; handle, fill and cursor all follow d
          add(t, function (tm) {
            anim(tm, D(TIME.drag), function (p) {
              sel.d = clamp(easeSine(p) + TIME.dragWobble * Math.sin(p * Math.PI * 3) * Math.sin(p * Math.PI), 0, 1);
              sel.jy = TIME.dragJitter * Math.sin(p * Math.PI * 2.3) * Math.sin(p * Math.PI);
              paintSel(); paintCursor();
            }, 'transform', el.hR);
          });
          break;
        case 'cursorOut':
          add(t, function (tm) { anim(tm, D(TIME.cursorOut), function (p) { sel.cur = 1 - p; paintCursor(); }, 'transform, opacity', el.cursor); });
          break;
        case 'toast':
          add(t, function (tm) {
            el.toast.textContent = s.text;
            spring(function (p) { el.toast.style.opacity = clamp(p / .35, 0, 1).toFixed(3); el.toast.style.transform = 'translate3d(0,' + (16 * (1 - p)).toFixed(2) + 'px,0) scale(' + (.9 + .1 * p).toFixed(4) + ')'; }, el.toast);
          });
          add(t + s.hold / sp, function (tm) {
            anim(tm, D(TIME.toastFade), function (p) { el.toast.style.opacity = (1 - p).toFixed(3); el.toast.style.transform = 'translate3d(0,' + (6 * p).toFixed(2) + 'px,0) scale(1)'; }, 'transform, opacity', el.toast);
          });
          break;
        case 'framing':   // drawn like a drag-selection: top-left handle stays, the others track their corners, edges grow with them
          add(t, function (tm) { anim(tm, D(TIME.frame), function (p) { paintFrame(ease(p)); }, 'transform, opacity', el.framing); });
          break;
        case 'badge':   // rubber stamp: big and tilted, falls ease-in to scale 1, then the spotlight spring takes its velocity (squash + bounce)
          add(t, function (tm) {
            var fall = D(TIME.stampFall), s0 = TIME.stampScale, handed = false;
            el.badge.style.willChange = 'transform, opacity';
            anim(tm, fall, function (p) {
              var sc = s0 - (s0 - 1) * p * p;
              el.badge.style.opacity = clamp(p * fall / 100, 0, 1).toFixed(3);   // fade in within the first ~100ms
              el.badge.style.transform = 'translate(-50%, -50%) rotate(' + (-3.2 - 8 * (1 - p)).toFixed(3) + 'deg) scale(' + sc.toFixed(4) + ')';
              if (p >= 1 && !handed) {                                            // impact
                handed = true;
                // spring variable p: scale = 2 - p, so p = 1 is rest; the fall moves p upward at this speed (per second)
                springs.push({ p: 1, v: 2 * (s0 - 1) * 1000 / TIME.stampFall * TIME.speed, node: el.badge, fn: function (q) {
                  el.badge.style.transform = 'translate(-50%, -50%) rotate(-3.2deg) scale(' + (2 - q).toFixed(4) + ')';
                } });
                if (TIME.stampShake > 0) anim(tm + fall, D(120), function (q) {   // thud: headline nudges down and back
                  head.style.transform = 'translate3d(0,' + (TIME.stampShake * Math.sin(Math.PI * q)).toFixed(2) + 'px,0)';
                }, 'transform', head);
              }
            }, 'transform, opacity', el.badge);
          });
          break;
      }
      });
      return t;
    }
    emit(steps(), 0);
    out.sort(function (a, b) { return a.at - b.at; });   // parallel tracks interleave
    return out;
  }
  /* purple selection (Figma 3764:63707 -> 3764:63715): right handle travels 511px, the fill is scaled from its left edge */
  var SEL_DX = 511, SEL_X = 544.5, SEL_Y = 502.15;          // handle travel; right-handle centre at rest (stage px)
  var sel = { pl: 0, pr: 0, d: 0, jy: 0, cur: 0 };
  function paintSel() {
    el.hR.style.transform = 'translate3d(' + (SEL_DX * (sel.d - 1)).toFixed(2) + 'px,0,0) scale(' + (.5 + .5 * sel.pr).toFixed(4) + ')';
    el.selBg.style.transform = 'scaleX(' + Math.max(.006, sel.d).toFixed(4) + ')';
  }
  function popL(p) {
    sel.pl = p; el.hL.style.opacity = clamp(p / .3, 0, 1).toFixed(3); el.hL.style.transform = 'scale(' + (.5 + .5 * p).toFixed(4) + ')';
    el.selBg.style.opacity = (.2 * clamp(p / .3, 0, 1)).toFixed(3);
  }
  function popR(p) { sel.pr = p; el.hR.style.opacity = clamp(p / .3, 0, 1).toFixed(3); paintSel(); }
  function paintCursor() {
    var sc = TIME.cursorScale * (.85 + .15 * sel.cur);
    el.cursor.style.opacity = clamp(sel.cur, 0, 1).toFixed(3);
    el.cursor.style.transform = 'translate3d(' + (SEL_X + SEL_DX * sel.d - 7).toFixed(2) + 'px,' + (SEL_Y + sel.jy - 5.3).toFixed(2) + 'px,0) scale(' + sc.toFixed(4) + ')';
  }
  /* framing: p 0 = small square at the top-left corner, 1 = full box (838 x 192) */
  var FW = 802, FH = 156, EW = 801.96, EH = 156.64;
  function paintFrame(p) {
    var x = FW * p, y = FH * p, q = Math.max(p, .0001);
    el.framing.style.opacity = clamp(p / .12, 0, 1).toFixed(3);
    el.htr.style.transform = 'translate3d(' + (x - FW).toFixed(2) + 'px,0,0)';
    el.hbl.style.transform = 'translate3d(0,' + (y - FH).toFixed(2) + 'px,0)';
    el.hbr.style.transform = 'translate3d(' + (x - FW).toFixed(2) + 'px,' + (y - FH).toFixed(2) + 'px,0)';
    el.ft.style.transform = 'scaleX(' + q.toFixed(4) + ')';
    el.fl.style.transform = 'scaleY(' + q.toFixed(4) + ')';
    el.fb.style.transform = 'translate3d(0,' + (EH * (p - 1)).toFixed(2) + 'px,0) scaleX(' + q.toFixed(4) + ')';
    el.fr.style.transform = 'translate3d(' + (EW * (p - 1)).toFixed(2) + 'px,0,0) scaleY(' + q.toFixed(4) + ')';
  }

  /* ---------- the one loop ---------- */
  function tick(now) {
    if (!t0) t0 = now;
    var tm = Math.min(now - t0, dbg.hold), dt = clamp((tm - lastT) / 1000, 0, 1 / 30), i, a, s, n, h, st, p;
    lastT = tm;
    while (evI < ev.length && ev[evI].at <= tm) { ev[evI].fn(ev[evI].at); evI++; }
    for (i = anims.length - 1; i >= 0; i--) {
      a = anims[i]; p = clamp((tm - a.t0) / a.dur, 0, 1); a.fn(p);
      if (p >= 1) { if (a.will) a.node.style.willChange = ''; anims.splice(i, 1); }
    }
    if (dt > 0) for (i = springs.length - 1; i >= 0; i--) {
      s = springs[i]; n = Math.max(1, Math.round(dt * 240)); h = dt / n;
      for (st = 0; st < n; st++) { s.v += (-SPRING.k * (s.p - 1) - SPRING.c * s.v) * h; s.p += s.v * h; }
      if (Math.abs(s.p - 1) < .0005 && Math.abs(s.v) < .005) { s.fn(1); s.node.style.willChange = ''; springs.splice(i, 1); }
      else s.fn(s.p);
    }
    if (caretOn && !blinking && tm - lastOp > TIME.idleBlink) { caret.classList.add('blink'); blinking = true; }
    if (evI >= ev.length && !anims.length && !springs.length) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }

  /* ---------- reset / finish ---------- */
  function clearInline() {
    head.style.transform = '';
    [el.yellow, el.framing, el.badge, el.selBg, el.hL, el.hR, el.toast, el.cursor, el.fl, el.ft, el.fr, el.fb, el.htl, el.htr, el.hbl, el.hbr].forEach(function (n) { n.style.cssText = ''; });
    sel.pl = sel.pr = sel.d = sel.jy = sel.cur = 0; yel.cur = 0; yel.anim = null;
  }
  function setFinal() {      // static layout + block cursor blinking at the end of line 3
    var k; for (k in lines) { lines[k].chars.forEach(function (c, i) { c.textContent = lines[k].text[i]; c.style.opacity = 1; }); lines[k].n = lines[k].chars.length; }
    clearInline(); root.classList.remove('intro-on'); root.classList.add('intro-run');
    cur = { line: 'eng', mode: 'block' }; caretOn = true; caret.classList.add('on'); place('eng', 'block');
    if (!blinking) { caret.classList.add('blink'); blinking = true; }
  }
  function finish() { raf = 0; setFinal(); }
  function reset() {
    var k; cancelAnimationFrame(raf); raf = 0;
    root.classList.add('intro-on', 'intro-run');
    for (k in lines) { lines[k].n = 0; lines[k].chars.forEach(function (c, i) { c.style.opacity = 0; c.textContent = lines[k].text[i]; }); }
    clearInline(); caret.classList.remove('on', 'blink'); caret.style.transform = ''; blinking = false; caretOn = false; cur = null;
    ev = compile(); evI = 0; anims = []; springs = []; t0 = 0; lastT = 0; lastOp = 0;
  }
  function run() { reset(); raf = requestAnimationFrame(tick); }
  dbg.restart = run;

  /* ---------- ?tune: live timing panel (same idea as the spotlight ?tune panel; bottom-left so the two never overlap) ---------- */
  if (/[?&]tune\b/.test(location.search)) {
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:100;width:230px;max-height:calc(100vh - 24px);overflow:auto;padding:10px 12px;background:#fff;' +
      'border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.2);font:12px/1.4 system-ui,sans-serif;color:#111';
    var title = document.createElement('div'); title.textContent = 'Chỉnh nhịp intro (bấm Chạy lại để xem)'; title.style.cssText = 'font-weight:600;margin-bottom:4px';
    panel.appendChild(title);
    var hint = document.createElement('div'); hint.textContent = 'ms = phần nghìn giây, số nhỏ = nhanh hơn. Tốc độ chung: số lớn = nhanh hơn.'; hint.style.cssText = 'color:#666;font-size:11px;margin-bottom:6px';
    panel.appendChild(hint);
    [['speed', 'Tốc độ chung (×)', .4, 3, .05], ['delay12', 'Gõ dòng 1–2: mỗi chữ (ms)', 15, 200, 1], ['delay3', 'Gõ dòng 3: mỗi chữ (ms)', 20, 300, 1],
     ['think', 'Ngập ngừng trước "Product" (ms)', 0, 1500, 10], ['drag', 'Kéo highlight tím (ms)', 200, 2500, 10], ['frame', 'Kéo khung xanh (ms)', 300, 3000, 10],
     ['backspace', 'Xoá mỗi chữ (ms)', 30, 300, 5], ['toastHold', 'Thời gian hiện thông báo (ms)', 400, 4000, 50], ['toastWait', 'Dừng trước khi xoá (ms)', 0, 2000, 10],
     ['stampScale', 'Đóng dấu: phóng to ban đầu (×)', 1.2, 3, .1], ['stampFall', 'Đóng dấu: thời gian rơi (ms)', 80, 400, 10], ['stampShake', 'Đóng dấu: rung khi đập (px)', 0, 6, 1]].forEach(function (d) {
      var row = document.createElement('label'), name = document.createElement('div'), out = document.createElement('b'), inp = document.createElement('input');
      row.style.cssText = 'display:block;margin:4px 0';
      out.style.cssText = 'float:right;font-weight:600'; out.textContent = TIME[d[0]];
      name.textContent = d[1]; name.appendChild(out);
      inp.type = 'range'; inp.min = d[2]; inp.max = d[3]; inp.step = d[4]; inp.value = TIME[d[0]]; inp.style.width = '100%';
      inp.addEventListener('input', function () { TIME[d[0]] = +inp.value; out.textContent = inp.value; });
      row.appendChild(name); row.appendChild(inp); panel.appendChild(row);
    });
    var FIT = window.__fit || { ui: .92, max: 1, refit: function () {} };   // from fit-stage.js: applies live, no replay
    [['ui', 'Tỷ lệ tổng (×)', .7, 1.2, .01], ['max', 'Cỡ to nhất (×)', .6, 1.5, .01]].forEach(function (d) {
      var row = document.createElement('label'), name = document.createElement('div'), out = document.createElement('b'), inp = document.createElement('input');
      row.style.cssText = 'display:block;margin:4px 0';
      out.style.cssText = 'float:right;font-weight:600'; out.textContent = FIT[d[0]];
      name.textContent = d[1]; name.appendChild(out);
      inp.type = 'range'; inp.min = d[2]; inp.max = d[3]; inp.step = d[4]; inp.value = FIT[d[0]]; inp.style.width = '100%';
      inp.addEventListener('input', function () { FIT[d[0]] = +inp.value; out.textContent = inp.value; FIT.refit(); });
      row.appendChild(name); row.appendChild(inp); panel.appendChild(row);
    });
    function btn(label, fn) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'margin:6px 6px 0 0;font:inherit;padding:3px 10px';
      b.addEventListener('click', fn); panel.appendChild(b); return b;
    }
    btn('Chạy lại', function () { run(); });
    var cp = btn('Copy số', function () {
      var t = 'var FIT = { ui: ' + FIT.ui + ', max: ' + FIT.max + ' };\n' + 'var TIME = {\n' + Object.keys(TIME).map(function (k) { return '  ' + k + ': ' + JSON.stringify(TIME[k]); }).join(',\n') + '\n};';
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      cp.textContent = 'Đã copy'; setTimeout(function () { cp.textContent = 'Copy số'; }, 1000);
    });
    document.body.appendChild(panel);
  }

  /* ---------- boot ---------- */
  function boot() {
    if (reduced) { setFinal(); return; }
    run();
    if (/[?&]intro(?:[=&]|$)/.test(location.search)) scene.addEventListener('click', run);
  }
  var fontsReady = document.fonts && document.fonts.load ? Promise.all([
    document.fonts.load('140px "Cal Sans"', 'AI Hi! I’m a'),
    document.fonts.load('500 140px "IBM Plex Mono"', '</Engineêể>')    // vietnamese subset for ê / ể
  ]) : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(boot, boot);
})();
