/* Visual Playground cards on the shared spotlight engine (js/pages/spotlight.js): click a card (click anywhere again to close) -> the page blurs and the
   project's best scenes (data-scenes on the card) fly out of it as small browser windows, laid out beside the card where there is room.
   Also sets --pg-h on .pg-fit to the canvas' real height so the section reserves the right space. */
(function () {
  'use strict';
  var SW = 1920, EDGE = 40, GAP = 36, CG = 24;          // stage px: canvas edge margin, gap card <-> windows, gap between columns
  var W = 460, H = W / 1.66 + 27, TW = 300, TH = 540 + 27;   // 16:9-ish screen window; tall full-page window (shot + padding + dots row)
  var ROT = [-5, 4, 3, -4], TROT = [-2, 2], DIN = [0, 30, 60, 90, 120], DOUT = [60, 45, 30, 15, 0];
  var section = document.querySelector('.stage-section.playground');
  if (!section) return;
  var fit = section.querySelector('.pg-fit'), canvas = section.querySelector('.pg-canvas');
  function size() { fit.style.setProperty('--pg-h', canvas.offsetHeight + 'px'); }
  size();
  if (window.ResizeObserver) new ResizeObserver(size).observe(canvas);

  var SP = window.Spotlight;
  if (!SP) return;
  function f(n) { return n.toFixed(2); }
  function measure(node) {
    var r = node.getBoundingClientRect(), cr = canvas.getBoundingClientRect(), s = cr.width / SW || 1;
    return { x: (r.left - cr.left) / s, y: (r.top - cr.top) / s, w: r.width / s, h: r.height / s };
  }
  var lit = 0, reduced = SP.reduced.matches, mq = window.__mobileFit && window.__mobileFit.mq;
  var SCROLL = { speed: 90, rest: 900, back: 1100 }, CYCLE = { step: 1600, offset: 400 };   // stage px/s, ms; ms per screen, delay between windows

  // full page sliding up inside its window: rest at the top, scroll down, rest, glide back up, repeat
  function scroller(shot, img) {
    var y = 0, phase = 0, t = 0;   // phase 0 rest top, 1 down, 2 rest bottom, 3 glide up
    function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
    return {
      step: function (dt) {
        var max = Math.max(0, img.offsetHeight - shot.clientHeight);
        if (phase === 0 || phase === 2) { t += dt; if (t >= SCROLL.rest) { t = 0; phase++; } }
        else if (phase === 1) { y = Math.min(max, y + SCROLL.speed * dt / 1000); if (y >= max) phase = 2; }
        else { t += dt; var p = Math.min(1, t / SCROLL.back); y = max * (1 - ease(p)); if (p >= 1) { t = 0; phase = 0; } }
        img.style.transform = 'translate3d(0,' + (-y).toFixed(2) + 'px,0)';
      },
      reset: function () { y = 0; phase = 0; t = 0; img.style.transform = ''; }
    };
  }
  // screens cross-fading in turn; each window starts a little later than the previous one
  function cycler(imgs, i) {
    var t = -i * CYCLE.offset, cur = 0;
    function show(n) { imgs[cur].classList.remove('is-on'); cur = n; imgs[cur].classList.add('is-on'); }
    return {
      step: function (dt) { if (imgs.length < 2) return; t += dt; if (t >= CYCLE.step) { t = 0; show((cur + 1) % imgs.length); } },
      reset: function () { t = -i * CYCLE.offset; show(0); }
    };
  }

  section.querySelectorAll('.pg-card[data-scenes]').forEach(function (card) {
    var media = card.querySelector('.pg-media');
    var comp = document.createElement('div');
    comp.className = 'sp-comp pg-comp';
    canvas.appendChild(comp);
    // data-scenes: windows separated by ';'. "tall:<img>" = tall window, full page scrolling itself; "scroll:<img>" = same in a screen-shaped window;
    // "a|b|c" = screens that cross-fade in turn
    var loops = [];
    var sats = card.getAttribute('data-scenes').split(';').map(function (grp, i) {
      var fig = document.createElement('figure'), shot = document.createElement('div');
      fig.className = 'pg-sat';
      fig.innerHTML = '<img class="pg-dots" src="assets/home/playground/dots.svg" alt="">';
      var m = /^(tall|scroll):/.exec(grp), scroll = !!m, srcs = (m ? grp.slice(m[0].length) : grp).split('|');
      fig.tall = !!m && m[1] === 'tall';
      if (fig.tall) fig.classList.add('pg-sat--tall');
      shot.className = 'pg-shot pg-shot--' + (scroll ? 'scroll' : 'cycle');
      var imgs = srcs.map(function (src, j) {
        var im = document.createElement('img');
        im.alt = ''; im.decoding = 'async'; im.loading = 'lazy'; im.src = 'assets/home/playground/' + src.trim();
        if (!scroll && j === 0) im.className = 'is-on';
        shot.appendChild(im);
        return im;
      });
      fig.appendChild(shot);
      comp.appendChild(fig);
      loops.push(scroll ? scroller(shot, imgs[0]) : cycler(imgs, i));
      return fig;
    });
    var raf = 0, last = 0;
    function frame(t) {
      var dt = last ? Math.min(64, t - last) : 0; last = t;
      loops.forEach(function (l) { l.step(dt); });
      raf = requestAnimationFrame(frame);
    }
    function play(on) {
      if (on && !raf && !reduced) { last = 0; raf = requestAnimationFrame(frame); }
      if (!on) { cancelAnimationFrame(raf); raf = 0; loops.forEach(function (l) { l.reset(); }); }
    }
    var units = sats.map(function (el, i) {
      return { el: el, dIn: DIN[i % 5], dOut: DOUT[i % 5], amp: 2 + .5 * i, tilt: 0, kf: .5 - .05 * i, spin: .12,   // gentle drift: the screens must stay readable
               sat: { dx: 0, dy: 0, s0: .3, r0: -2 * ROT[i % 4] } };
    });
    /* phones: the canvas only shows ~720 of its 1920 stage px, so windows beside the card would be cut off. Instead they gather in the
       middle of the screen over the blurred page: the tall full pages side by side on top, the screen windows below at almost full width
       (narrowed only when the stack would not fit the screen height). */
    function phone(self, m, cx, cy) {
      var cr = canvas.getBoundingClientRect(), s = cr.width / SW || 1, G = 10 / s, TOP = 70 / s;
      var vx1 = -cr.left / s + G, vx2 = (window.innerWidth - cr.left) / s - G;
      var vy1 = (TOP - cr.top) / s, vy2 = (window.innerHeight - 16 - cr.top) / s;
      var talls = [], wides = [];
      sats.forEach(function (el, i) { (el.tall ? talls : wides).push(i); });
      var tRow = talls.length ? TH : 0, n = wides.length;
      var avail = vy2 - vy1 - tRow - (talls.length && n ? CG : 0) - (n - 1) * CG;
      var ww = Math.max(W, Math.min(vx2 - vx1, n ? (avail / n - 27) * 1.66 : 0)), wh = ww / 1.66 + 27;
      var total = tRow + (talls.length && n ? CG : 0) + n * wh + (n - 1) * CG;
      var mid = (vx1 + vx2) / 2 - m.x, y = Math.max(vy1, (vy1 + vy2 - total) / 2) - m.y;
      var k = { x1: m.x, y1: m.y, x2: m.x + m.w, y2: m.y + m.h };
      function put(i, x, yy, w, h, rot) {
        var el = sats[i], u = self.units[i];
        el.style.width = sats[i].tall ? '' : f(w) + 'px';
        el.style.left = f(x) + 'px'; el.style.top = f(yy) + 'px'; el.style.rotate = rot + 'deg';
        u.dx = cx - (x + w / 2); u.dy = cy - (yy + h / 2);
        k.x1 = Math.min(k.x1, m.x + x); k.y1 = Math.min(k.y1, m.y + yy); k.x2 = Math.max(k.x2, m.x + x + w); k.y2 = Math.max(k.y2, m.y + yy + h);
      }
      var rw = talls.length * TW + (talls.length - 1) * CG;
      talls.forEach(function (i, j) { put(i, mid - rw / 2 + j * (TW + CG), y, TW, TH, TROT[j % 2]); });
      y += tRow + (talls.length && n ? CG : 0);
      wides.forEach(function (i, j) { put(i, mid - ww / 2, y, ww, wh, j % 2 ? 1.5 : -1.5); y += wh + CG; });
      var P = 10;
      return { open: { rect: { x1: m.x - P, y1: m.y - P, x2: m.x + m.w + P, y2: m.y + m.h + P } }, keep: k };
    }
    var inst = SP.create({
      comp: comp, source: card, space: canvas, spaceW: SW, units: units, clickOnly: true,
      layout: function (self) {
        var m = measure(media);
        if (!m.w) return null;
        comp.style.transform = 'translate(' + f(m.x) + 'px,' + f(m.y) + 'px)';
        var cx = m.w / 2, cy = m.h / 2;
        if (mq && mq.matches) return phone(self, m, cx, cy);
        sats.forEach(function (el) { el.style.width = ''; });
        // columns: each tall window is a column of its own, screens stack two to a column
        var talls = [], wides = [], cols = [];
        sats.forEach(function (el, i) { (el.tall ? talls : wides).push(i); });
        talls.forEach(function (i) { cols.push({ w: TW, items: [i], tall: true }); });
        for (var j = 0; j < wides.length; j += 2) cols.push({ w: W, items: wides.slice(j, j + 2) });
        var roomL = m.x - GAP - EDGE, roomR = SW - EDGE - (m.x + m.w + GAP);
        // each column goes to the side that still has room for it (widest columns placed first); if neither fits, the roomier side
        var room = { '-1': roomL, '1': roomR }, used = { '-1': 0, '1': 0 }, sides = [];
        cols.map(function (c, ci) { return ci; }).sort(function (a, b2) { return cols[b2].w - cols[a].w; }).forEach(function (ci) {
          var c = cols[ci], fitR = used[1] + c.w <= room[1], fitL = used[-1] + c.w <= room[-1];
          var side = fitR && fitL ? (room[1] - used[1] >= room[-1] - used[-1] ? 1 : -1) : fitR ? 1 : fitL ? -1 :
                     (room[1] - used[1] >= room[-1] - used[-1] ? 1 : -1);
          sides[ci] = side; used[side] += c.w + CG;
        });
        used = { '-1': 0, '1': 0 };
        var k = { x1: m.x, y1: m.y, x2: m.x + m.w, y2: m.y + m.h }, ti = 0, wi = 0;
        cols.forEach(function (c, ci) {
          var side = sides[ci], off = used[side];
          used[side] += c.w + CG;
          var x = side > 0 ? m.w + GAP + off : -GAP - off - c.w;
          c.items.forEach(function (i, r) {
            var el = sats[i], h = c.tall ? TH : H, y;
            if (c.tall) y = cy - h / 2 + (ci % 2 ? 24 : -24);
            else y = c.items.length > 1 ? (r ? cy + 6 : cy - h - 6) : cy - h / 2;
            var rot = c.tall ? TROT[ti++ % 2] : ROT[wi++ % 4], dx = c.tall ? 0 : (r ? -18 : 18) * side;
            el.style.left = f(x + dx) + 'px'; el.style.top = f(y) + 'px'; el.style.rotate = rot + 'deg';
            var u = self.units[i];
            u.dx = cx - (x + dx + c.w / 2); u.dy = cy - (y + h / 2);   // flies out from the card centre
            k.x1 = Math.min(k.x1, m.x + x + dx); k.y1 = Math.min(k.y1, m.y + y); k.x2 = Math.max(k.x2, m.x + x + dx + c.w); k.y2 = Math.max(k.y2, m.y + y + h);
          });
        });
        var P = 10, KP = 30;
        return { open: { rect: { x1: m.x - P, y1: m.y - P, x2: m.x + m.w + P, y2: m.y + m.h + P } },
                 keep: { x1: k.x1 - KP, y1: k.y1 - KP, x2: k.x2 + KP, y2: k.y2 + KP } };
      },
      onShown: function (on) {
        if (on === card.classList.contains('is-open')) return;
        card.classList.toggle('is-open', on);
        play(on);
        lit += on ? 1 : -1;
        section.classList.toggle('is-lit', lit > 0);
      }
    });
    inst.relayout();
    window.addEventListener('resize', inst.relayout);
  });
})();
