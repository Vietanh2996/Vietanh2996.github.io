/* Cursor guide (reusable): one of the wandering cursors (.cursor--pink / .cursor--yellow) leaves its CSS wander loop, flies to a
   target element, "hovers" it (adds .is-guided so the target can show its hover look), turns its name chip into a Figma-style cursor
   chat and types a hint, then erases it, flies back to its rest spot and hands over to the wander loop again.

   API (window.CursorGuide):
     CursorGuide.show({ cursor, target, text, at, hold })  -> Promise, one run. Resolves false if it could not run (cursor busy, hidden page...).
         cursor: element or selector of the wandering cursor   target: element or selector to point at
         text: hint to type   at: [x, y] point on the target for the arrow tip, 0..1 (default [.62, .68])   hold: ms the hint stays (default 2200)
     CursorGuide.schedule({ ...show options, first, every, until })  -> { stop() }. Runs show() first ms after the intro ends, then every `every` ms.
         until(): return true to stop for good (e.g. the visitor already used the control).
   Skips quietly while the intro runs, a spotlight is open, the page is hidden, the cursor is busy (another guide or img-enter), or under reduced motion.
   Usage on the home page: bottom of this file (theme toggle). For the left nav later: another CursorGuide.schedule({...}) call. */
(function () {
  'use strict';
  var T = { fly: 950, settle: 250, type: 45, erase: 22, hold: 2200, home: 950, bow: 60 };   // ms / px
  var HX = 5.7, HY = 5.8;                   // arrow tip inside the 56px cursor box (thumb.js / img-enter.js)
  var root = document.documentElement;
  var layer = document.getElementById('cursor-layer');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var busy = false;

  function $(x) { return typeof x === 'string' ? document.querySelector(x) : x; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function bowPath(a, b, p, bow) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, s = Math.sin(Math.PI * p) * bow;
    return { x: a.x + dx * p - dy / len * s, y: a.y + dy * p + dx / len * s };
  }
  function put(c, pt) { c.style.translate = (pt.x - HX).toFixed(2) + 'px ' + (pt.y - HY).toFixed(2) + 'px'; }
  function nowTip(c) {                       // current arrow tip, read from the (possibly animated) translate
    var v = getComputedStyle(c).translate.split(' ');
    return { x: (parseFloat(v[0]) || 0) + HX, y: (parseFloat(v[1]) || 0) + HY };
  }
  function restTip(c) {                      // where the wander loop starts/rests (mirrors --rx/--ry in thumb.css, scroll top)
    var cs = getComputedStyle(c), S = parseFloat(getComputedStyle(root).getPropertyValue('--stage-scale')) || 1;
    var pad = parseFloat(cs.getPropertyValue('--cur-pad')) || 0, vw = layer.clientWidth - pad;   // phones: mobile.css shrinks --vw by the chip and clamps --rx
    return { x: Math.min(vw / 2 + (parseFloat(cs.getPropertyValue('--tx')) - 960) * S, pad ? vw - 6.3 : Infinity), y: layer.clientHeight / 2 + (parseFloat(cs.getPropertyValue('--ty')) - 540) * S };
  }
  function fly(c, from, toFn, ms) {          // toFn re-read every frame so a moving target (resize, chrome scale) is still hit
    return new Promise(function (done) {
      var t0 = 0;
      function f(now) {
        if (!t0) t0 = now;
        var p = clamp((now - t0) / ms, 0, 1);
        put(c, bowPath(from, toFn(), ease(p), T.bow));
        if (p < 1) requestAnimationFrame(f); else done();
      }
      requestAnimationFrame(f);
    });
  }
  function typeInto(el, text, ms) {
    return new Promise(function (done) {
      var i = 0;
      (function step() { el.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(step, ms); else done(); })();
    });
  }
  function eraseFrom(el, ms) {
    return new Promise(function (done) {
      (function step() { var s = el.textContent; el.textContent = s.slice(0, -1); if (s.length > 1) setTimeout(step, ms); else done(); })();
    });
  }
  function canRun(c) {
    return !reduced && layer && c && !busy && !document.hidden && !root.classList.contains('intro-on') &&
      !document.body.classList.contains('is-spotlight') && !c.classList.contains('he-fly') && getComputedStyle(c).visibility !== 'hidden';
  }

  function show(o) {
    var c = $(o.cursor), target = $(o.target), chip = c && c.querySelector('.cursor-chip');
    if (!target || !chip || !canRun(c)) return Promise.resolve(false);
    var at = o.at || [.62, .68], name = chip.textContent, msg;
    function aim() { var r = target.getBoundingClientRect(); return { x: r.left + r.width * at[0], y: r.top + r.height * at[1] }; }
    busy = true;
    var from = nowTip(c);
    put(c, from); c.classList.add('he-fly', 'cg-fly');            // freeze where the wander loop had it, then take over
    return fly(c, from, aim, T.fly)
      .then(function () { target.classList.add('is-guided'); return wait(T.settle); })
      .then(function () {
        chip.textContent = ''; chip.classList.add('is-chat');
        msg = document.createElement('span'); msg.className = 'cg-msg'; chip.appendChild(msg);
        msg.textContent = o.text; chip.style.visibility = 'hidden';       // measure the full hint: would it run off the right / bottom edge?
        var W = layer.clientWidth, H = layer.clientHeight, k = c.getBoundingClientRect().width / 56 || 1, r;
        chip.classList.toggle('is-flip', chip.getBoundingClientRect().right > W - 12);
        chip.classList.toggle('is-up', chip.getBoundingClientRect().bottom > H - 12);   // e.g. the theme / language combo at the bottom on phones
        r = chip.getBoundingClientRect();                                  // still too wide (narrow phone): slide it back inside the screen
        var dx = Math.max(12 - r.left, Math.min(0, W - 12 - r.right));
        chip.style.translate = dx ? (dx / k).toFixed(1) + 'px 0' : '';
        msg.textContent = ''; chip.style.visibility = '';
        return typeInto(msg, o.text, T.type);
      })
      .then(function () { return wait(o.hold || T.hold); })
      .then(function () { return eraseFrom(msg, T.erase); })
      .then(function () {
        chip.classList.remove('is-chat', 'is-flip', 'is-up'); chip.style.translate = ''; chip.textContent = name; target.classList.remove('is-guided');
        return fly(c, nowTip(c), function () { return restTip(c); }, T.home);
      })
      .then(function () {                                           // hand back: the wander keyframes start at the rest spot, so no jump
        c.style.translate = ''; c.classList.remove('he-fly', 'cg-fly'); busy = false; return true;
      }, function () { busy = false; return false; });
  }

  function schedule(o) {
    var timer = 0, stopped = false, ran = false;
    function stop() { stopped = true; clearTimeout(timer); }
    function tick() {
      if (stopped) return;
      if (o.until && o.until()) return stop();
      if (!canRun($(o.cursor))) { timer = setTimeout(tick, 2000); return; }   // not now (intro, spotlight, busy...): try again shortly
      show(o).then(function (ok) {
        if (ok) ran = true;
        if (!stopped) timer = setTimeout(tick, ok ? o.every : 2000);
      });
    }
    timer = setTimeout(tick, o.first || 0);
    return { stop: stop, get ran() { return ran; } };
  }

  window.CursorGuide = { show: show, schedule: schedule, timing: T };

  /* ---------- home page: the Việt Anh cursor (pink) guides the visitor around the site. It points at the light/dark toggle, once shortly after the intro, then every minute,
     until the visitor clicks the toggle on this page view ---------- */
  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    var used = false;
    toggle.addEventListener('click', function () { used = true; });
    schedule({
      cursor: '.cursor--pink', target: toggle, get text() { return window.I18N ? I18N.t('cursor.mode', 'Try here to change mode') : 'Try here to change mode'; },
      first: 3000, every: 60000, until: function () { return used; }
    });
  }
  /* ---------- language toggle: same, ~15s after the intro (so it doesn't queue right behind the theme hint), then every minute ---------- */
  var langBtn = document.querySelector('.lang-toggle');
  if (langBtn) {
    var langUsed = false;
    langBtn.addEventListener('click', function () { langUsed = true; });
    schedule({
      cursor: '.cursor--pink', target: langBtn, at: [.5, .62],
      get text() { var fb = root.lang === 'vi' ? 'Đổi sang tiếng Anh ở đây nè' : 'Switch to Vietnamese here'; return window.I18N ? I18N.t('cursor.lang', fb) : fb; },
      first: 15000, every: 60000, until: function () { return langUsed; }
    });
  }

  /* ---------- About: once the Việt Anh avatar is fully on screen, the Việt Anh cursor flies over and says to click it (the avatar spotlight).
     Once per time it scrolls into view, at most twice per page view; never again after the visitor hovers or clicks the avatar / pill.
     Text: key 'cursor.avatar' (not in js/pages/lang.js yet, so the fallback per language below is what shows). ---------- */
  var av = document.getElementById('who-avatar'), pill = document.querySelector('.who-pill');
  if (av && 'IntersectionObserver' in window) {
    var avUsed = false, avIn = false, avTimer = 0, avShown = 0, AV_MAX = 2;
    [av, pill].forEach(function (el) {
      if (!el) return;
      el.addEventListener('click', function () { avUsed = true; });
      el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') avUsed = true; });
    });
    function avText() {
      var fb = root.lang === 'vi' ? 'Bấm thử đi, có cái này hay lắm' : 'Click me, there’s something fun';
      return window.I18N ? I18N.t('cursor.avatar', fb) : fb;
    }
    function avTry() {
      avTimer = 0;
      if (avUsed || !avIn || avShown >= AV_MAX) return;
      show({ cursor: '.cursor--pink', target: av, text: avText(), at: [.72, .78], hold: 2600 }).then(function (ok) {
        if (ok) avShown++;
        else if (avIn && !avUsed) avTimer = setTimeout(avTry, 1500);   // busy (theme hint, spotlight...): try again while it is still in view
      });
    }
    new IntersectionObserver(function (es) {
      var e = es[es.length - 1], was = avIn;
      avIn = e.isIntersecting && e.intersectionRatio > .95;
      if (avIn && !was && !avTimer) avTimer = setTimeout(avTry, 1200);    // let the scroll settle first
      if (!avIn && avTimer) { clearTimeout(avTimer); avTimer = 0; }
    }, { threshold: [0, .95, 1] }).observe(av);
  }
})();
