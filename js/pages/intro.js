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
    enterRise: 0, enterLineDur: 700, enterLineFade: 200, enterStagger: 100,   // all 3 lines start rising at t=0, each enterStagger ms after the previous one: offset (stage px), duration per line, fade-in (ms); independent of typing
    enterScale: 1, enterDur: 900, enterWait: 0,             // cluster holds this scale; it starts shrinking to 1 at 2*enterStagger + .85*enterLineDur + enterWait (right after the last rise), over enterDur (expo-out). rise 0 + scale 1 = no entrance
    glyphStart: 600, glyphStep: 450, glyphMax: 3,   // after the intro: letters of "Engineer" swap to coloured code glyphs, one swap every glyphStep ms (steady beat), at most glyphMax at once; loops forever
    parallel: true,                 // user test 2026-11-15: all 3 lines type at the same moment (false = the old one-after-another timeline)
    seed: 7                           // fixed seed = same "human" rhythm every run
  };
  var SPRING = { k: 650, c: 32 };     // same as spotlight.js open
  var TOAST_TEXT = 'Switched input to English (US)';

  /* ================= TIMELINE (data) =================
     pause {ms} | caret {line, mode:'bar'|'block'|'off'} | type {line, text, think:{charIndex: ms}} | telex {line, ch, delay}
     backspace {line, n, delay} | handles | cursorIn | drag | cursorOut | toast {hold} | framing | badge
     (everything from handles on is fire-and-forget: use pause to space it) */
  function steps() { return TIME.parallel ? stepsParallel() : stepsSequential(); }
  function stepsParallel() { return [   // three tracks start together after TIME.start; the purple selection starts when line 2 is done
    { do: 'pause', ms: TIME.start },
    { do: 'par', steps: [
      { do: 'caret', line: 'hi', mode: 'bar' },
      { do: 'type', line: 'hi', text: 'Hi! I’m an', rate: 12 },
      { do: 'pause', ms: 300 },
      { do: 'caret', line: 'hi', mode: 'off' }
    ] },
    { do: 'par', steps: [
      { do: 'caret', line: 'ai', mode: 'bar' },
      { do: 'type', line: 'ai', text: 'AI  Product  Design', rate: 12, think: { 4: TIME.think } },
      { do: 'pause', ms: 120 },
      { do: 'par', steps: [
        { do: 'handles' },
        { do: 'pause', ms: TIME.handlesPause },
        { do: 'cursorIn' },
        { do: 'pause', ms: TIME.cursorPause },
        { do: 'drag' },
        { do: 'pause', ms: TIME.drag + TIME.cursorLinger },
        { do: 'cursorOut' }
      ] },
      { do: 'pause', ms: 180 },
      { do: 'caret', line: 'ai', mode: 'off' }
    ] },
    { do: 'caret', line: 'eng', mode: 'block' },
    { do: 'pause', ms: 150 },
    { do: 'type', line: 'eng', text: '</Engine', rate: 3 },
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
  function stepsSequential() { return [   // function so ?tune values are read at every replay
    { do: 'pause', ms: TIME.start },
    { do: 'caret', line: 'hi', mode: 'bar' },            // line rises are no longer triggered here: compile() starts all three at t=0
    { do: 'type', line: 'hi', text: 'Hi! I’m an', rate: 12 },
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
    toast: scene.querySelector('.toast'), cluster: scene.querySelector('.hero-cluster')
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
  /* per-line groups: elements that rise together with a line (transform only; their own opacity / clip logic is untouched) */
  var groups = { hi: [lines.hi.el], ai: [lines.ai.el, el.selBg.parentNode], eng: [lines.eng.el, el.yellow, el.framing] };
  var carets = {};      // one caret per line: { el, ch, mode ('bar' | 'block' | null = hidden), blinking, lastOp }
  ['hi', 'ai', 'eng'].forEach(function (n) {
    var el_ = document.createElement('div'); el_.className = 'caret'; head.appendChild(el_);
    var ch_ = document.createElement('span'); ch_.className = 'caret-ch'; el_.appendChild(ch_);   // white copy of the char under the block
    carets[n] = { el: el_, ch: ch_, mode: null, blinking: false, lastOp: 0 };
  });

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dbg = window.__intro = { hold: Infinity, restart: null };   // hold = freeze the timeline at t ms (for screenshots)

  /* ================= state ================= */
  var lineY = { hi: 0, ai: 0, eng: 0 };            // current rise offset (stage px) of each line: the caret lives outside the lines, so it adds this itself
  var ev, evI, anims, springs, raf = 0, t0 = 0, lastT = 0;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  /* total on-screen scale of the cluster = --stage-scale x the entrance scale. Every rect-based measurement below only uses DIFFERENCES between rects
     (char - line, baseline - line), so the entrance translate cancels out and dividing by this scale gives untransformed stage px. */
  function scale() { var c = el.cluster, w = c.offsetWidth; return w ? (c.getBoundingClientRect().width / w) || 1 : 1; }
  function easeSine(p) { return .5 - .5 * Math.cos(Math.PI * p); }
  function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

  /* ---------- caret ---------- */
  function place(name, mode) {
    var C = carets[name], caret = C.el, caretCh = C.ch, L = lines[name], cs = L.chars, n = L.n, k = scale(), lr = L.el.getBoundingClientRect(), x, w, r, idx;
    if (mode === 'block') {                         // sits ON the last typed char (inverse video); slot 0 while the line is empty
      idx = clamp(n - 1, 0, cs.length - 1); r = cs[idx].getBoundingClientRect(); x = r.left;
      w = r.width / k - (parseFloat(getComputedStyle(L.el).letterSpacing) || 0);   // full monospace cell
      caretCh.textContent = n > 0 ? cs[idx].textContent : '';
      caret.classList.add('block');
    } else {
      x = n < cs.length ? cs[n].getBoundingClientRect().left : cs[n - 1].getBoundingClientRect().right;   // (x - lr.left) below is a difference: translate-free
      w = TIME.caretBar; caret.classList.remove('block');
    }
    var h = lr.height / k, dy = 0;
    if (mode !== 'block') { var ch = parseFloat(getComputedStyle(L.el).fontSize) * TIME.caretEm, bl = (L.base.getBoundingClientRect().top - lr.top) / k; dy = bl + TIME.caretDrop - ch; h = ch; }   // thin I-beam: height from font-size, bottom = baseline + caretDrop
    caret.style.width = w.toFixed(2) + 'px';
    caret.style.height = h.toFixed(2) + 'px';
    caret.style.transform = 'translate3d(' + (parseFloat(getComputedStyle(L.el).left) + (x - lr.left) / k).toFixed(2) + 'px,' + (parseFloat(getComputedStyle(L.el).top) + dy + (lineY[name] || 0)).toFixed(2) + 'px,0)';
  }
  function solid(name, t) {
    var C = carets[name]; C.lastOp = t;
    if (C.blinking) { C.el.classList.remove('blink'); C.blinking = false; }
  }
  function refresh(name, t) { if (carets[name].mode) { place(name, carets[name].mode); solid(name, t); } }
  function caretOff(name) { var C = carets[name]; C.mode = null; C.el.classList.remove('on', 'blink'); C.blinking = false; }

  /* ---------- ops (what each timeline event does) ---------- */
  var ops = {
    caret: function (s, t) {
      var k;
      if (s.mode === 'off') { if (s.line) caretOff(s.line); else for (k in carets) caretOff(k); return; }
      if (!TIME.parallel) for (k in carets) if (k !== s.line) caretOff(k);   // sequential: a single caret that moves from line to line
      carets[s.line].mode = s.mode; carets[s.line].el.classList.add('on'); refresh(s.line, t);
    },
    type: function (s, t, ch) { var L = lines[s.line], c = L.chars[L.n]; c.textContent = ch; c.style.opacity = 1; L.n++; refresh(s.line, t); yellowFor(s.line, t); },
    telex: function (s, t) { var L = lines[s.line]; L.chars[L.n - 1].textContent = s.ch; refresh(s.line, t); },
    back: function (s, t) { var L = lines[s.line]; L.n--; var c = L.chars[L.n]; c.style.opacity = 0; c.textContent = L.text[L.n]; refresh(s.line, t); yellowFor(s.line, t); }
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

  /* ---------- per-line rise ---------- */
  function paintLine(name, p) {      // p 0..1; expo-out
    var q = p >= 1 ? 0 : Math.pow(2, -10 * p), y = TIME.enterRise * q, g = groups[name], i;
    lineY[name] = y;
    for (i = 0; i < g.length; i++) g[i].style.transform = p >= 1 ? '' : 'translate3d(0,' + y.toFixed(2) + 'px,0)';
    g[0].style.opacity = p >= 1 ? '' : clamp(p * TIME.enterLineDur / Math.max(1, TIME.enterLineFade), 0, 1).toFixed(3);
    if (carets[name].mode) place(name, carets[name].mode);
  }
  function zoomOut(t0) {                 // cluster scale: enterScale -> 1, expo-out; scheduled right after the last line's rise
    var cl = el.cluster, s0 = TIME.enterScale;
    anims.push({ t0: t0, dur: D(TIME.enterDur), will: 'transform', node: cl, fn: function (p) {
      cl.style.transform = p >= 1 ? '' : 'scale(' + (1 + (s0 - 1) * Math.pow(2, -10 * p)).toFixed(4) + ')';
    } });
  }
  function riseLine(name, t) {
    if (reduced || TIME.enterRise <= 0) return;
    var g = groups[name], i;
    for (i = 0; i < g.length; i++) g[i].style.willChange = i === 0 ? 'transform, opacity' : 'transform';   // only while moving
    anims.push({ t0: t, dur: D(TIME.enterLineDur), fn: function (p) { paintLine(name, p); if (p >= 1) for (var k = 0; k < g.length; k++) g[k].style.willChange = ''; }, node: g[0] });
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
    ['hi', 'ai', 'eng'].forEach(function (n, i) { add(i * TIME.enterStagger / sp, function (tm) { riseLine(n, tm); }); });   // rises start at t=0, staggered; typing does not drive them
    if (!reduced && TIME.enterScale !== 1 && TIME.enterDur > 0) add((2 * TIME.enterStagger + .85 * TIME.enterLineDur + TIME.enterWait) / sp, function (tm) { zoomOut(tm); });
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
  var FW = 894.4, FH = 156, EW = 894.36, EH = 156.64;   // widths follow the -7px letter-spacing (was 802 / 801.96)
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
    for (var cn in carets) { var C = carets[cn]; if (C.mode && !C.blinking && tm - C.lastOp > TIME.idleBlink) { C.el.classList.add('blink'); C.blinking = true; } }
    if (evI >= ev.length && !anims.length && !springs.length) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }

  /* ---------- reset / finish ---------- */
  function clearInline() {
    head.style.transform = ''; el.cluster.style.cssText = '';
    for (var g in groups) { lineY[g] = 0; groups[g].forEach(function (n, i) { if (i === 0) n.style.cssText = ''; else { n.style.transform = ''; n.style.willChange = ''; } }); }
    [el.yellow, el.framing, el.badge, el.selBg, el.hL, el.hR, el.toast, el.cursor, el.fl, el.ft, el.fr, el.fb, el.htl, el.htr, el.hbl, el.hbr].forEach(function (n) { n.style.cssText = ''; });
    sel.pl = sel.pr = sel.d = sel.jy = sel.cur = 0; yel.cur = 0; yel.anim = null;
  }
  function setFinal() {      // static layout + block cursor blinking at the end of line 3
    var k; for (k in lines) { lines[k].chars.forEach(function (c, i) { c.textContent = lines[k].text[i]; c.style.opacity = 1; }); lines[k].n = lines[k].chars.length; }
    clearInline(); root.classList.remove('intro-on'); root.classList.add('intro-run');
    for (k in carets) caretOff(k);
    carets.eng.mode = 'block'; carets.eng.el.classList.add('on'); place('eng', 'block');
    if (!carets.eng.blinking) { carets.eng.el.classList.add('blink'); carets.eng.blinking = true; }
  }
  /* ---------- glyph loop (ref: "/a de<el+pe¬s"): after the intro, letters of "Engineer" (line-3 chars 2..9) take turns becoming coloured code glyphs.
     Monospace cells, so nothing reflows; text-only writes, one char per step. ---------- */
  var GLYPHS = '/<>{}[]+=;*#&|~!$%_¬'.split('');
  var GLYPH_COLORS = ['var(--accent-red-solid)', 'var(--accent-blue-solid)', 'var(--accent-pink-solid)', 'var(--accent-purple-solid)', 'var(--accent-green-solid)'];
  var GLYPH_RECENT = 10;   // a glyph is not reused until this many others have been shown (pool is 20)
  var glyph = { timer: 0, on: [], recent: [], r: Math.random };
  function pick(list, avoid) {   // random item not in avoid (falls back to the whole list if everything is excluded)
    var ok = list.filter(function (x) { return avoid.indexOf(x) < 0; });
    if (!ok.length) ok = list;
    return ok[Math.floor(glyph.r() * ok.length)];
  }
  function glyphSet(i, on) {
    var c = lines.eng.chars[i];
    if (on) {
      var col = pick(GLYPH_COLORS, glyph.on.map(function (j) { return lines.eng.chars[j].style.color; }));   // colours on screen stay distinct, like the ref
      var g = pick(GLYPHS, glyph.recent);                                                                   // no repeats on screen, nor among the last GLYPH_RECENT
      glyph.recent.push(g); if (glyph.recent.length > GLYPH_RECENT) glyph.recent.shift();
      c.textContent = g; c.style.color = col; glyph.on.push(i);
    } else {
      c.textContent = lines.eng.text[i]; c.style.color = ''; glyph.on.splice(glyph.on.indexOf(i), 1);
    }
  }
  /* steady conveyor: once glyphMax are up, every step retires the OLDEST glyph and adds a new one in the same beat,
     so each glyph lives exactly glyphMax steps (no random long holds) */
  function glyphStep() {
    if (!document.hidden) {
      var gone = -1, free = [], i;
      if (glyph.on.length >= TIME.glyphMax) { gone = glyph.on[0]; glyphSet(gone, false); }
      for (i = 2; i <= 9; i++) if (i !== gone && glyph.on.indexOf(i) < 0 && glyph.on.indexOf(i - 1) < 0 && glyph.on.indexOf(i + 1) < 0) free.push(i);   // never side by side, never the cell just restored
      if (free.length) glyphSet(free[Math.floor(glyph.r() * free.length)], true);
    }
    glyph.timer = setTimeout(glyphStep, TIME.glyphStep / TIME.speed);
  }
  function glyphStart() { glyphStop(); if (!reduced) glyph.timer = setTimeout(glyphStep, TIME.glyphStart / TIME.speed); }
  function glyphStop() { clearTimeout(glyph.timer); glyph.timer = 0; while (glyph.on.length) glyphSet(glyph.on[0], false); }

  function finish() { raf = 0; setFinal(); glyphStart(); }
  function reset() {
    var k; cancelAnimationFrame(raf); raf = 0; glyphStop();
    root.classList.add('intro-on', 'intro-run');
    for (k in lines) { lines[k].n = 0; lines[k].chars.forEach(function (c, i) { c.style.opacity = 0; c.textContent = lines[k].text[i]; }); }
    clearInline(); for (k in carets) { caretOff(k); carets[k].el.style.transform = ''; carets[k].lastOp = 0; }
    ev = compile(); evI = 0; anims = []; springs = []; t0 = 0; lastT = 0;
    if (!reduced) {
      if (TIME.enterRise > 0) for (var g in groups) { lineY[g] = TIME.enterRise; paintLine(g, 0); }   // lines wait below, invisible, until their typing starts
      if (TIME.enterScale !== 1 && TIME.enterDur > 0) {      // whole cluster holds the big scale; zoomOut() (scheduled when the last line starts rising) brings it to 1
        el.cluster.style.willChange = 'transform'; el.cluster.style.transform = 'scale(' + TIME.enterScale.toFixed(4) + ')';
      }
    }
  }
  function run() { reset(); raf = requestAnimationFrame(tick); if (window.__imgEnter) window.__imgEnter.start(); }   // image entrance (js/pages/img-enter.js) runs in parallel, never delays the typing
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
     ['stampScale', 'Đóng dấu: phóng to ban đầu (×)', 1.2, 3, .1], ['stampFall', 'Đóng dấu: thời gian rơi (ms)', 80, 400, 10], ['stampShake', 'Đóng dấu: rung khi đập (px)', 0, 6, 1],
     ['enterRise', 'Vào: quãng trượt mỗi dòng (px)', 0, 400, 5], ['enterLineDur', 'Vào: thời gian trượt mỗi dòng (ms)', 200, 2000, 50], ['enterStagger', 'Vào: lệch nhịp giữa các dòng (ms)', 0, 400, 5], ['enterScale', 'Vào: phóng to ban đầu (×)', 1, 2, .01], ['enterWait', 'Vào: chờ trước khi thu nhỏ (ms)', 0, 1500, 50], ['enterDur', 'Vào: thời gian thu nhỏ (ms)', 400, 3000, 50]].forEach(function (d) {
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
    document.fonts.load('140px "Cal Sans"', 'AI Hi! I’m an'),
    document.fonts.load('500 140px "IBM Plex Mono"', '</Engineêể>')    // vietnamese subset for ê / ể
  ]) : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(boot, boot);
})();
