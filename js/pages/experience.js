/* Experience (draft). Tick bar drawn on a canvas in screen pixels. While the pointer is anywhere in the section one zone is active
   (picked by x, clamped to the bar): its ticks take the zone colour, its tint shows, and the indicator follows the pointer.
   Zone 4 (data-down, the side job) overlaps the end of zone 3: there BOTH indicators show, zone 3 above the bar and zone 4 below it,
   GAP px apart, and the overlap's ticks alternate between the two colours.
   Ticks near the pointer stretch taller; ticks the pointer has left shrink back over time (a fading trail).
   Markup in index.html, styles in experience.css. */
(function () {
  'use strict';
  var canvas = document.getElementById('exp-canvas');
  if (!canvas) return;
  var section = canvas.closest('.experience'), fit = canvas.parentElement, ticks = fit.querySelector('.exp-ticks'), ctx = ticks.getContext('2d');
  var zones = [].slice.call(canvas.querySelectorAll('.exp-zone'));
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 2202, BAR_Y = 160, BAR_H = 38, PITCH = 8, TICK_W = 2;
  var GROW = { up: 12, down: 30 };          // stage px a tick can stretch above / below the bar at full lift
  var MARK_UP = 76, MARK_W = 3, OFF = 80, TOP = BAR_Y - OFF;   // year marks: 3px lines, top fixed MARK_UP above the bar, bottom rides the wave's bottom; OFF = canvas headroom above the bar
  var RADIUS = 56;                          // stage px: width (sigma) of the lift around the pointer
  var FADE = 760, MIN_H = 12;               // stage px from the indicator at which the resting bar has shrunk to MIN_H (smooth taper, centred on the bar)
  var DECAY = 0.0045;                       // per ms: how fast a left-behind tick sinks back (higher = shorter trail)
  var N = Math.floor((W - TICK_W) / PITCH) + 1, lift = new Float32Array(N);
  var years = [].slice.call(canvas.querySelectorAll('.exp-yr')).map(function (el) { return { el: el, z: el.dataset.z, x: Math.round((parseFloat(el.style.left) - 7) / PITCH) * PITCH }; });
  var GAP = 24;                             // stage px (3 ticks) between the two indicators in the overlap
  var main = zones.filter(function (z) { return !z.hasAttribute('data-down'); }), side = zones.filter(function (z) { return z.hasAttribute('data-down'); })[0];
  var lastX = null, cur = null, dual = false, ax = 0, px = -1, raf = 0, last = 0;
  var LOGO_DIR = 'assets/shared/company/';
  zones.forEach(function (z) {                // data-co="file|Name|years|title|dur;...": companies in order, sized by years (default 1); title / dur override the role and duration
    var co = z.dataset.co.split(';').map(function (p) { p = p.split('|'); return { file: p[0], name: p[1], w: +(p[2] || 1), title: p[3] || '', dur: p[4] || '' }; });
    var tot = co.reduce(function (a, c) { return a + c.w; }, 0), acc = 0;
    co.forEach(function (c) { c.from = acc / tot; acc += c.w; });
    z._co = co;
  });

  function geom() {
    var cr = canvas.getBoundingClientRect(), fr = fit.getBoundingClientRect(), s = cr.width / W, dpr = window.devicePixelRatio || 1;
    var cssW = W * s, cssH = (OFF + BAR_H + GROW.down) * s;
    ticks.style.left = (cr.left - fr.left) + 'px'; ticks.style.top = (TOP * s) + 'px';
    ticks.style.width = cssW + 'px'; ticks.style.height = cssH + 'px';
    var pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
    if (ticks.width !== pw || ticks.height !== ph) { ticks.width = pw; ticks.height = ph; }
    return s * dpr;
  }
  function colours(z) { var cs = getComputedStyle(z); return { x0: z.offsetLeft, x1: z.offsetLeft + z.offsetWidth, c: cs.getPropertyValue('--c').trim(), tint: cs.getPropertyValue('--tint').trim() }; }
  function bar(x, y, w, h) {                 // vertical line with round ends (falls back to square on old browsers)
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, w / 2); ctx.fill(); } else ctx.fillRect(x, y, w, h);
  }
  function draw() {
    var k = geom(), tw = Math.max(1, Math.round(TICK_W * k));
    var grey = getComputedStyle(canvas).getPropertyValue('--tick-grey').trim();
    var on = cur && colours(cur), alt = dual && colours(side);
    ctx.clearRect(0, 0, ticks.width, ticks.height);
    var marked = {}, bot = {}; years.forEach(function (m) { marked[m.x] = 1; });
    for (var i = 0; i < N; i++) {
      var x = i * PITCH, l = lift[i], hit = on && x >= on.x0 && x < on.x1, use = on;
      if (alt && x >= alt.x0 && x < alt.x1) { hit = true; if (i % 2) use = alt; }   // overlap: ticks alternate main / side colour
      var t = Math.min(1, Math.abs(x + TICK_W / 2 - ax) / FADE), h = MIN_H + (BAR_H - MIN_H) * (1 - t * t * (3 - 2 * t));   // taper: full at the indicator, MIN_H from FADE on
      var y0 = Math.round((OFF + (BAR_H - h) / 2 - GROW.up * l) * k), y1 = Math.round((OFF + (BAR_H + h) / 2 + GROW.down * l) * k);
      if (marked[x]) bot[x] = [y0, y1];       // the year mark follows this tick's wave
      if (y1 - y0 < 1) continue;
      if (hit) {                              // tint column for this tick's 8px slot, same height as the tick, so the background rides the wave
        var tx0 = Math.round(x * k), tx1 = Math.round(Math.min(W, x + PITCH) * k);
        ctx.fillStyle = use.tint; ctx.fillRect(tx0, y0, tx1 - tx0, y1 - y0);
      }
      if (marked[x]) continue;               // a year mark replaces this tick
      ctx.fillStyle = hit ? use.c : grey;
      bar(Math.round(x * k), y0, tw, y1 - y0);
    }
    years.forEach(function (m) {              // year marks: the active zone's own mark lights in its colour ("now" = the side zone, while both show)
      var c = cur && cur.dataset.z === m.z ? on.c : dual && side.dataset.z === m.z ? alt.c : '';
      ctx.fillStyle = c || grey;
      var mw = Math.max(2, Math.round(MARK_W * k));   // 3px, centred on the tick slot (kept inside the canvas at 2017)
      var my1 = bot[m.x][1], my0 = Math.round((OFF - MARK_UP) * k);   // fixed top, bottom follows the wave down
      bar(Math.max(0, Math.round((m.x + TICK_W / 2 - MARK_W / 2) * k)), my0, mw, my1 - my0);
      m.el.style.color = c;
    });
  }
  function frame(now) {                     // lift ticks around the pointer, let the rest sink back; stop once everything is flat
    var dt = last ? Math.min(64, now - last) : 16; last = now;
    var fall = Math.exp(-DECAY * dt), live = false;
    for (var i = 0; i < N; i++) {
      var target = px >= 0 ? Math.exp(-Math.pow(i * PITCH - px, 2) / (2 * RADIUS * RADIUS)) : 0;
      var l = lift[i] * fall;
      if (target > l) l += (target - l) * Math.min(1, dt / 60);   // rise fast but not instantly
      lift[i] = l < 0.002 ? 0 : l;
      if (lift[i]) live = true;
    }
    draw();
    if (live || px >= 0) raf = requestAnimationFrame(frame); else { raf = 0; last = 0; }
  }
  function kick() { if (!raf && !reduced) { last = 0; raf = requestAnimationFrame(frame); } else if (reduced) draw(); }

  /* photos: set n shows pool[(slot + (n-1)*3) % 11], so each zone change brings in 3 new pictures and shifts the rest */
  var PHOTOS = [].slice.call(canvas.querySelectorAll('.exp-ph')), POOL = [], photoSet = 0;
  for (var p = 1; p <= 11; p++) POOL.push('assets/home/experience/p' + (p < 10 ? '0' : '') + p + '.jpg');
  /* focal point per picture (object-position), so the person / group sits in the middle of the crop, small circles included */
  var POS = ['64% 40%', '50% 28%', '50% 22%', '56% 42%', '50% 55%', '50% 50%', '50% 42%', '50% 50%', '50% 68%', '40% 40%', '62% 45%'];
  POOL.forEach(function (src) { new Image().src = src; });   // preload so swaps don't flash
  function setPhotos(n) {
    if (n === photoSet) return;
    var animate = photoSet !== 0 && !reduced; photoSet = n;
    PHOTOS.forEach(function (f, i) {
      var k = (i + (n - 1) * 3) % POOL.length, img = f.querySelector('img'), src = POOL[k];
      if (img.getAttribute('src') === src) { img.style.objectPosition = POS[k]; return; }
      if (!animate) { img.src = src; img.style.objectPosition = POS[k]; return; }
      clearTimeout(f._t1); clearTimeout(f._t2);
      f._t1 = setTimeout(function () {           // staggered: shrink + fade out, swap, spring back
        f.classList.remove('is-back'); f.classList.add('is-swap');
        f._t2 = setTimeout(function () { img.src = src; img.style.objectPosition = POS[k]; f.classList.add('is-back'); f.classList.remove('is-swap'); }, 220);
      }, i * 45);
    });
  }

  /* indicator: line + ring + label (title, duration, pill with one logo + company). Two of them: A for zones 1-3, B (a clone) for zone 4 */
  function dur(s) { return window.I18N ? I18N.dur(s) : s; }
  function Ind(el) {
    return { el: el, title: el.querySelector('.exp-title'), dur: el.querySelector('.exp-dur'), logos: el.querySelector('.exp-logos'),
      co: el.querySelector('.exp-co'), label: el.querySelector('.exp-label'), zone: null, ci: -1, swap: false };
  }
  var A = Ind(canvas.querySelector('.exp-ind'));
  var bEl = A.el.cloneNode(true); A.el.after(bEl); var B = Ind(bEl);
  function indZone(I, z) {
    if (I.zone === z) return;
    I.zone = z;
    if (!z) { I.el.classList.remove('is-on'); return; }
    I.el.dataset.z = z.dataset.z;
    I.title.textContent = z.dataset.title; I.dur.textContent = dur(z.dataset.dur);
    I.title.parentElement.classList.remove('is-swap');   // the zone's show animation plays on the heading instead
    I.el.classList.toggle('is-down', z.hasAttribute('data-down'));
    I.ci = -1; I.swap = false;                 // first company of a zone appears with the label (no slide)
    I.el.classList.add('is-on');
    I.el.classList.remove('is-anim'); void I.el.offsetWidth; I.el.classList.add('is-anim');   // replay the show animation
  }
  function indCo(I, c, animate) {           // swap company: old name slides up/out, new slides in, pill width eases to fit; its logo pops in
    var nt = c.title || I.zone.dataset.title, nd = dur(c.dur || I.zone.dataset.dur);
    if (animate && (I.title.textContent !== nt || I.dur.textContent !== nd)) {   // role / duration changed inside the zone: replay the rise on the heading
      var h = I.title.parentElement; h.classList.remove('is-swap'); void h.offsetWidth; h.classList.add('is-swap');
    }
    I.title.textContent = nt; I.dur.textContent = nd;
    var img = new Image(); img.src = LOGO_DIR + c.file + '.png'; img.alt = '';
    var oldImgs = [].slice.call(I.logos.children); I.logos.appendChild(img);
    if (animate) { img.classList.add('is-in'); oldImgs.forEach(function (o) { o.classList.add('is-out'); setTimeout(function () { o.remove(); }, 200); }); }
    else oldImgs.forEach(function (o) { o.remove(); });
    var t = document.createElement('span'); t.className = 'exp-co-t'; t.textContent = c.name;
    var olds = [].slice.call(I.co.children);
    I.co.classList.toggle('no-anim', !animate);
    I.co.appendChild(t);
    I.co.style.width = t.offsetWidth + 'px';
    if (!animate) { olds.forEach(function (o) { o.remove(); }); return; }
    t.classList.add('is-in');
    olds.forEach(function (o) { o.classList.remove('is-in'); o.classList.add('is-out'); setTimeout(function () { o.remove(); }, 260); });
  }
  function indPlace(I, z, x) {
    indZone(I, z);
    var f = (x - z.offsetLeft) / z.offsetWidth, ci = 0;
    z._co.forEach(function (c, i) { if (f >= c.from) ci = i; });           // company under the pointer
    if (ci !== I.ci) { I.ci = ci; indCo(I, z._co[ci], I.swap); I.swap = true; }
    I.el.style.translate = x.toFixed(1) + 'px 0';
    var flip = x + 35 + I.label.offsetWidth > W;
    if (mobile()) {                          // phones: the canvas is cropped, so flip when the label would run past the screen edge
      var s = canvas.getBoundingClientRect().width / W;
      flip = (parseFloat(canvas.style.left) || 0) + (x + 35 + I.label.offsetWidth) * s > fit.clientWidth - 8;
    }
    I.el.classList.toggle('is-flip', flip);
  }

  function zoneAt(x) { for (var i = 0; i < main.length; i++) if (x < main[i].offsetLeft + main[i].offsetWidth) return main[i]; return main[main.length - 1]; }
  function move(e) {
    if (mobile()) return;
    var r = canvas.getBoundingClientRect(), s = r.width / W;
    px = place((e.clientX - r.left) / s);
    kick();
  }
  /* stage quote above the bar. data-quote holds lines split by "|", read in order along the zone. "~" splits them into one group per
     company (zone 2: Direction / MISA, zone 3: One Mount / VSF): each group stays inside its company's stretch.
     While both indicators show, the side zone's lines are used. New lines come in word by word. */
  var quote = canvas.querySelector('.exp-quote-t'), quoteKey = null;
  function parseQuotes() {                   // data-quote-vi holds the Vietnamese lines (same "|" / "~" layout), used when <html lang="vi">
    zones.forEach(function (z) {
      var src = (window.I18N && I18N.lang === 'vi' && z.dataset.quoteVi) || z.dataset.quote || '';
      var g = src.split('~');
      z._q = g.length === z._co.length ? g.map(function (t) { return t.split('|'); }) : [g.join('|').split('|')];
    });
  }
  parseQuotes();
  document.addEventListener('langchange', function () {
    parseQuotes(); quoteKey = null;
    [A, B].forEach(function (I) { if (I.zone) I.dur.textContent = dur(I.ci >= 0 && I.zone._co[I.ci] && I.zone._co[I.ci].dur || I.zone.dataset.dur); });
    if (cur && lastX != null) place(lastX);
  });
  function setQuote(z, x) {
    if (!quote) return;
    var f = Math.max(0, Math.min(.999, (x - z.offsetLeft) / z.offsetWidth)), gi = 0, a = 0, b = 1;
    if (z._q.length > 1) {
      z._co.forEach(function (c, k) { if (f >= c.from) gi = k; });
      a = z._co[gi].from; b = gi + 1 < z._co.length ? z._co[gi + 1].from : 1;
    }
    if (side && z !== side) {                 // past side.offsetLeft the side zone's lines take over, so squeeze this group's lines into the part still shown
      var end = (side.offsetLeft - z.offsetLeft) / z.offsetWidth;
      if (end > a && end < b) b = end;
    }
    var q = z._q[gi], i = Math.min(q.length - 1, Math.floor((f - a) / (b - a) * q.length)), text = q[i];
    var key = z.dataset.z + ':' + gi + ':' + i;
    if (key === quoteKey) return;
    var first = quoteKey === null; quoteKey = key;
    if (first || reduced) { quote.textContent = text; return; }
    clearTimeout(quote._t); quote.classList.add('is-out');
    quote._t = setTimeout(function () { words(text); quote.classList.remove('is-out'); }, 200);
  }
  function words(text) {                       // new line comes in word by word (staggered rise + unblur, see .exp-qw)
    quote.textContent = '';
    text.split(' ').forEach(function (w, i) {
      var s = document.createElement('span'); s.className = 'exp-qw'; s.textContent = w; s.style.animationDelay = (i * 70) + 'ms';
      quote.appendChild(s); quote.appendChild(document.createTextNode(' '));
    });
  }
  function place(x) {                         // stage x, clamped to the bar: left of it = zone 1, right of it = zone 3
    x = Math.max(2, Math.min(W - 2, x)); lastX = x;
    cur = zoneAt(x);
    dual = !!side && x >= side.offsetLeft;
    var xa = dual ? Math.min(x, W - 2 - GAP) : x;
    indPlace(A, cur, xa);
    if (dual) indPlace(B, side, xa + GAP); else indZone(B, null);
    setPhotos(dual ? +side.dataset.z : +cur.dataset.z);
    if (dual) setQuote(side, xa + GAP); else setQuote(cur, x);
    ax = dual ? xa + GAP / 2 : x;
    draw();
    return x;
  }
  /* phones (fit-stage mobile mode): no hover, so the page scroll scrubs along the bar (the section is tall, the bar block sticky) and the
     canvas pans so the active point stays centred; the quote follows the viewport centre. */
  var mq = window.__mobileFit && window.__mobileFit.mq;
  function mobile() { return !!(mq && mq.matches); }
  function pan(x) {
    var fw = fit.clientWidth, s = canvas.getBoundingClientRect().width / W, g = 16;
    var left = Math.max(fw - W * s - g, Math.min(g, fw / 2 - x * s));
    canvas.style.left = left.toFixed(1) + 'px';
    if (quote) quote.parentElement.style.left = ((fw / 2 - left) / s).toFixed(1) + 'px';
  }
  function scrub() {
    if (!mobile()) { if (canvas.style.left) { canvas.style.left = ''; if (quote) quote.parentElement.style.left = ''; draw(); } return; }
    var r = section.getBoundingClientRect(), span = r.height - window.innerHeight;
    var p = span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0, x = 2 + p * (W - 4);
    pan(x); px = place(x); kick();
  }
  window.addEventListener('scroll', scrub, { passive: true });
  window.addEventListener('resize', scrub);
  section.addEventListener('pointermove', move);
  section.addEventListener('pointerenter', move);
  section.addEventListener('pointerleave', function () { px = -1; kick(); });   // keep the last zone + indicators, only the wave settles

  /* scroll parallax on the photos (same feel as the hero images): each drifts against the scroll by a depth factor, bigger photo =
     nearer = faster. Offset is measured from the bar block's centre to the viewport centre, so they sit at their design spot when it is
     centred. Transform-only (the frames use translate / rotate / scale for layout and the swap), rAF lerp toward the scroll target. */
  var PAR = { near: .32, far: .08, smooth: .88 };
  var depth = PHOTOS.map(function (f) { return +f.style.getPropertyValue('--w') || 120; });
  var dMin = Math.min.apply(null, depth), dMax = Math.max.apply(null, depth);
  depth = depth.map(function (w) { return PAR.far + (PAR.near - PAR.far) * (w - dMin) / Math.max(1, dMax - dMin); });
  var parCur = null, parTo = 0, parRaf = 0, parLast = 0;
  function parTarget() { var r = fit.getBoundingClientRect(); return (r.top + r.height / 2 - window.innerHeight / 2) / (canvas.getBoundingClientRect().width / W || 1); }
  /* entrance: the first time the block scrolls into view, the photos fly out from the centre of the visible bar block to their spots,
     fast then slowing down (ease-out), slightly staggered. fly[i] = 0..1 progress; until it starts they are hidden. */
  var FLY = { dur: 1100, stagger: 45, from: .35 };   // ms, ms between photos, start scale
  var fly = PHOTOS.map(function () { return reduced ? 1 : 0; }), flyT0 = 0, flyC = [0, 0];
  function easeOut(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }   // expo out: quick launch, long soft landing
  function parApply(o) {
    PHOTOS.forEach(function (f, i) {
      var e = easeOut(fly[i]), dx = 0, dy = depth[i] * o, sc = '';
      if (e < 1) { dx = (flyC[0] - f.offsetLeft) * (1 - e); dy += (flyC[1] - f.offsetTop) * (1 - e); sc = ' scale(' + (FLY.from + (1 - FLY.from) * e).toFixed(3) + ')'; }
      f.style.transform = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)' + sc;
      f.style.opacity = e < 1 ? Math.min(1, fly[i] * 5).toFixed(3) : '';
    });
  }
  var flyGen = 0, flyArmed = true;   // gen cancels a running fly when the block leaves; armed = may launch on next entry
  function flyFrame(t, g) {
    if (g !== flyGen) return;
    var done = true;
    fly = fly.map(function (v, i) { var p = Math.max(0, (t - flyT0 - i * FLY.stagger) / FLY.dur); if (p < 1) done = false; return Math.min(1, p); });
    parApply(parCur === null ? parTarget() : parCur);
    if (!done) requestAnimationFrame(function (n) { flyFrame(n, g); });
  }
  function launch() {
    var cr = canvas.getBoundingClientRect(), fr = fit.getBoundingClientRect(), s = cr.width / W || 1;
    flyC = [(fr.left + fr.width / 2 - cr.left) / s, (fr.top + fr.height / 2 - cr.top) / s];   // centre of the visible block, in canvas px
    flyT0 = performance.now(); var g = ++flyGen; requestAnimationFrame(function (n) { flyFrame(n, g); });
  }
  if (!reduced && window.IntersectionObserver) {
    PHOTOS.forEach(function (f) { f.style.opacity = '0'; });
    /* replays every visit: launch once 35% is in view; once the block is fully off screen, reset (hidden at the centre) for the next entry */
    var io = new IntersectionObserver(function (en) {
      var e = en[0];
      if (e.isIntersecting && e.intersectionRatio >= .35 && flyArmed) { flyArmed = false; launch(); }
      else if (!e.isIntersecting && !flyArmed) { flyArmed = true; flyGen++; fly = fly.map(function () { return 0; }); PHOTOS.forEach(function (f) { f.style.opacity = '0'; }); }
    }, { threshold: [0, .35] });
    io.observe(fit);
  } else fly = fly.map(function () { return 1; });
  function parFrame(t) {
    parRaf = 0;
    var dt = Math.min((t - parLast) / 16.667, 4) || 1; parLast = t;
    parCur += (parTo - parCur) * (1 - Math.pow(PAR.smooth, dt));
    if (Math.abs(parTo - parCur) < .1) { parCur = parTo; parApply(parCur); return; }
    parApply(parCur); parRaf = requestAnimationFrame(parFrame);
  }
  function parallax() {
    parTo = parTarget();
    if (parCur === null || reduced) { parCur = parTo; parApply(parCur); return; }
    if (!parRaf) { parLast = performance.now(); parRaf = requestAnimationFrame(parFrame); }
  }
  if (!reduced) { window.addEventListener('scroll', parallax, { passive: true }); window.addEventListener('resize', parallax); parallax(); }

  place(main[0].offsetWidth / 2);            // always one zone active: start on zone 1
  scrub();
  window.addEventListener('resize', draw);
  if (window.ResizeObserver) new ResizeObserver(draw).observe(fit);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts) document.fonts.ready.then(draw);
})();
