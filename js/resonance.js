/* Resonance（音の波紋）の背景
   固定キャンバスに、教室のモチーフ（音の輪）を描く。
   ・ヒーローの写真から波紋が広がり続ける
   ・各セクションの見出しが画面に入ると、左右の端で「音が鳴る」ように輪が生まれる
   ・スクロールの速さで輪がわずかに揺れる／マウスを動かすと小さな波紋
   タッチ操作は一切奪わない（passive のみ）。動きを減らす設定では静止画。
   スマホは 30fps・輪を減らす・拡大率1.5まで。遅い端末は自動で静止画（html.rz-static）に切り替える。
   メニューを開いている間・タブが隠れている間は止める。 */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var dark = window.matchMedia('(prefers-color-scheme: dark)');

  // 見出しの英字ラベル（build.py が大きな英字と番号を書き出している）
  var heads = [].slice.call(document.querySelectorAll('main .eyebrow.has-ghost'));

  var cv = document.getElementById('resonance');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  if (!ctx) return;
  root.classList.add('has-resonance');

  // 遅そうな端末・データセーバーでは最初から静止画
  var conn = navigator.connection || {};
  var weak = conn.saveData || ((navigator.hardwareConcurrency || 8) <= 4 && (navigator.deviceMemory || 8) <= 4);
  var staticMode = !!weak;
  function goStatic() { staticMode = true; root.classList.add('rz-static'); running = false; requestDraw(); }
  if (staticMode) root.classList.add('rz-static');

  var W = 0, H = 0, dpr = 1, mobile = false;
  var col = { dusty: [138, 154, 176], accent: [196, 145, 138] };
  function parse(c) {
    c = c.trim();
    if (c.charAt(0) === '#') {
      if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)];
    }
    var m = c.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [138, 154, 176];
  }
  function readColors() {
    var cs = getComputedStyle(root);
    col.dusty = parse(cs.getPropertyValue('--dusty') || '#8A9AB0');
    col.accent = parse(cs.getPropertyValue('--accent') || '#C4918A');
    col.isDark = parse(cs.getPropertyValue('--paper') || '#F6F7F9')[0] < 80;
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }

  // ---- 波紋の発生源
  var photo = document.querySelector('.hero__photo');
  var sources = [];
  function buildSources() {
    sources = [];
    var sy = window.scrollY || 0;
    if (photo) {
      var r = photo.getBoundingClientRect();
      sources.push({ main: true, x: r.left + r.width / 2, docY: r.top + sy + r.height * 0.42,
        r0: r.width * 0.56, gap: mobile ? 18 : 26, n: mobile ? 16 : 22, color: 'dusty', alpha: col.isDark ? .34 : .5, energy: .6, el: null });
    }
    heads.forEach(function (eb, i) {
      var box = eb.parentElement;
      if (box.closest('.hero')) return;
      var r = box.getBoundingClientRect();
      var right = i % 2 === 0;
      sources.push({ main: false, side: right, x: right ? W * (mobile ? 1.02 : .95) : W * (mobile ? -.02 : .05),
        docY: r.top + sy + Math.min(r.height, 120) * .5, r0: mobile ? 20 : 34, gap: mobile ? 16 : 22, n: mobile ? 9 : 13,
        color: i % 3 === 1 ? 'accent' : 'dusty', alpha: col.isDark ? .34 : .5, energy: 0, el: box, struck: false });
    });
  }

  var waves = [];
  function strike(s, strength) {
    s.energy = Math.min(1.4, s.energy + strength);
    waves.push({ x: s.x, docY: s.docY, r: s.r0, v: mobile ? .09 : .12, life: 1, max: s.r0 + s.gap * s.n * 1.1, color: s.color, a: s.alpha * 1.4, src: s });
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    mobile = W < 760;
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.25);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    readColors();
    buildSources();
    requestDraw();
  }

  // ---- 入力（すべて passive）
  var scrollY = window.scrollY || 0, lastY = scrollY, vel = 0;
  var px = -9999, py = -9999, lastPointerWave = 0;
  var fine = window.matchMedia('(pointer: fine)').matches;
  // 静止画のときはスクロール中に描き直さず、止まってから1回だけ描く（遅い端末でスクロールを重くしない）
  var idleTimer = 0;
  window.addEventListener('scroll', function () {
    scrollY = window.scrollY || 0;
    if (staticMode || reduce.matches) { clearTimeout(idleTimer); idleTimer = setTimeout(requestDraw, 160); }
    else requestDraw();
  }, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  if (fine) {
    window.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      var now = performance.now();
      if (!reduce.matches && now - lastPointerWave > 900) {
        lastPointerWave = now;
        waves.push({ x: px, docY: py + scrollY, r: 4, v: .07, life: 1, max: 180, color: 'accent', a: col.isDark ? .35 : .45, small: true });
      }
    }, { passive: true });
  }
  document.addEventListener('pointerdown', function (e) {
    if (reduce.matches) return;
    waves.push({ x: e.clientX, docY: e.clientY + scrollY, r: 4, v: .1, life: 1, max: mobile ? 160 : 220, color: 'accent', a: col.isDark ? .4 : .5, small: true });
  }, { passive: true });

  // 見出しが画面に入ったら「鳴らす」
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        sources.forEach(function (s) { if (s.el === en.target && !reduce.matches) { strike(s, 1); } });
      });
    }, { rootMargin: '0px 0px -20% 0px' });
    heads.forEach(function (eb) { io.observe(eb.parentElement); });
  }

  // ---- 描画
  var SEG = 90;
  function menuOpen() { return document.body.classList.contains('menu-open'); }
  function ring(cx, cy, r, amp, k, phase) {
    ctx.beginPath();
    if (amp < .15 || mobile && amp < .6) { ctx.arc(cx, cy, r, 0, Math.PI * 2); return; }
    for (var j = 0; j <= SEG; j++) {
      var th = j / SEG * Math.PI * 2;
      var rr = r + amp * Math.sin(k * th + phase);
      var x = cx + rr * Math.cos(th), y = cy + rr * Math.sin(th);
      if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  var keysEls = [].slice.call(document.querySelectorAll('.keys'));
  // 鍵盤の区切りは、画面に見えているものだけ位置を測る（毎フレーム全部測ると重い）
  var keysVisible = [];
  if ('IntersectionObserver' in window) {
    var kio = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var i = keysVisible.indexOf(en.target);
        if (en.isIntersecting && i < 0) keysVisible.push(en.target);
        if (!en.isIntersecting && i >= 0) keysVisible.splice(i, 1);
      });
    }, { rootMargin: '50px 0px' });
    keysEls.forEach(function (el) { kio.observe(el); });
  } else keysVisible = keysEls;
  var track = document.querySelector('.marquee__track');
  var marqueeAnim = null;

  var t0 = performance.now(), lastT = t0, pending = false, running = false;
  function draw(now) {
    var dt = Math.min(64, now - lastT); lastT = now;
    var still = reduce.matches || staticMode;
    var t = still ? 0 : (now - t0);
    // 速度（なめらかに）
    var dy = scrollY - lastY; lastY = scrollY;
    vel += ((dt > 0 ? dy / dt : 0) - vel) * .12;
    var speed = Math.min(3, Math.abs(vel));
    var par = still ? 1 : .82; // 背景は少し遅れて動く（奥行き）

    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;

    for (var i = 0; i < sources.length; i++) {
      var s = sources[i];
      var cy = s.docY - scrollY * par - (still ? 0 : (1 - par) * 0);
      if (!s.main) cy = s.docY - scrollY * par + (1 - par) * H * .3;
      var reach = s.r0 + s.gap * s.n;
      if (cy < -reach || cy > H + reach) { s.energy *= .96; continue; }
      if (!still) s.energy += ((s.main ? .5 : 0) - s.energy) * .012;
      var c = col[s.color];
      var squeeze = 1 - Math.min(.18, speed * .06);
      for (var n = 0; n < s.n; n++) {
        var fall = 1 - n / s.n;
        var r = s.r0 + n * s.gap * squeeze + (still ? 0 : Math.sin(t * .0009 - n * .5) * 2.2);
        var amp = still ? 0 : (s.energy * 2.2 + speed * 2.4) * fall * (n % 2 ? 1 : .7);
        var a = s.alpha * Math.pow(fall, 1.35) * (s.main ? 1 : (.45 + s.energy * .55));
        if (a < .01) continue;
        ctx.strokeStyle = rgba(c, a);
        ring(s.x, cy, r, amp, 3 + (n % 4), t * .0007 * (n % 2 ? 1 : -1) + n);
        ctx.stroke();
      }
    }

    // 広がって消える波
    if (!still) {
      var mainS = sources[0];
      if (mainS && mainS.main && (!mainS.nextWave || now > mainS.nextWave)) {
        mainS.nextWave = now + 2600;
        waves.push({ x: mainS.x, docY: mainS.docY, r: mainS.r0, v: mobile ? .07 : .09, life: 1, max: mainS.r0 + mainS.gap * mainS.n, color: 'dusty', a: mainS.alpha * 1.3, main: true });
      }
      for (var w = waves.length - 1; w >= 0; w--) {
        var wv = waves[w];
        wv.r += wv.v * dt;
        var prog = (wv.r) / wv.max;
        if (prog >= 1) { waves.splice(w, 1); continue; }
        var wy = wv.small ? wv.docY - scrollY : wv.docY - scrollY * par + ((wv.src && !wv.src.main) ? (1 - par) * H * .3 : 0);
        var fade = Math.sin(Math.min(1, prog) * Math.PI) * (1 - prog * .4);
        ctx.lineWidth = wv.small ? 1 : 1.4;
        ctx.strokeStyle = rgba(col[wv.color], wv.a * fade);
        ring(wv.x, wy, wv.r, wv.small ? 0 : 1.2 + speed * 2, 5, t * .001);
        ctx.stroke();
        if (wv.small && prog < .7) { // 小さな波紋はもう1本
          ctx.strokeStyle = rgba(col[wv.color], wv.a * fade * .5);
          ring(wv.x, wy, wv.r * .6, 0, 0, 0); ctx.stroke();
        }
      }
      ctx.lineWidth = 1;
    }

    // 鍵盤の区切り線：画面を通るにつれて光が左から右へ
    var ps = keysVisible.map(function (el) {
      var rc = el.getBoundingClientRect();
      if (rc.bottom < -50 || rc.top > H + 50) return null;
      return still ? .5 : Math.max(-.2, Math.min(1.2, 1.1 - (rc.top + rc.height / 2) / H * 1.2));
    });
    ps.forEach(function (p, k) { if (p !== null) keysVisible[k].style.setProperty('--p', p.toFixed(3)); });

    // マーキー：スクロールに合わせて速く／上に戻ると逆向き
    // スマホでは速度を変えない（毎フレーム書きかえると Android で指を離したあとの慣性スクロールが消える）
    if (track && !still && fine) {
      if (!marqueeAnim && track.getAnimations) marqueeAnim = track.getAnimations()[0] || null;
      if (marqueeAnim) marqueeAnim.playbackRate = 1 + Math.max(-4, Math.min(6, vel * 2.2));
    }

    pending = false;
  }

  function requestDraw() {
    if (!pending && !running) { pending = true; requestAnimationFrame(draw); }
  }

  // 常時アニメーション（PC 約40fps・スマホ 約30fps。タブが隠れている間・メニューを開いている間は止める）
  var lastFrame = 0, probeStart = 0, probeFrames = 0, probeWork = 0;
  function loop(now) {
    if (!running) return;
    if (menuOpen()) { running = false; waitMenu(); return; }
    var step = mobile ? 33 : 24;
    if (now - lastFrame >= step) {
      lastFrame = now;
      var t1 = performance.now();
      draw(now);
      // 最初の約4秒の描画時間を測り、重ければ静止画に切り替える
      if (probeStart >= 0) {
        if (!probeStart) probeStart = now;
        probeFrames++; probeWork += performance.now() - t1;
        if (now - probeStart > 4000) {
          var avg = probeWork / probeFrames;
          var fps = probeFrames / ((now - probeStart) / 1000);
          probeStart = -1;
          if (avg > (mobile ? 12 : 16) || fps < (mobile ? 18 : 24)) { goStatic(); return; }
        }
      }
    }
    requestAnimationFrame(loop);
  }
  var menuTimer = 0;
  function waitMenu() {
    clearInterval(menuTimer);
    menuTimer = setInterval(function () { if (!menuOpen()) { clearInterval(menuTimer); start(); } }, 400);
  }
  function start() {
    if (reduce.matches || staticMode || document.hidden) { running = false; requestDraw(); return; }
    if (running) return;
    // 重さの計測中に止まっていた時間を数えないよう、計測をやり直す
    if (probeStart > 0) { probeStart = 0; probeFrames = 0; probeWork = 0; }
    running = true; lastT = performance.now(); requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; else start(); });
  reduce.addEventListener && reduce.addEventListener('change', function () { running = false; start(); });
  dark.addEventListener && dark.addEventListener('change', function () { readColors(); buildSources(); requestDraw(); });

  resize();
  window.addEventListener('load', function () { buildSources(); requestDraw(); });
  // 画像やフォントの読み込みで位置が変わるので、少し後にも測り直す
  setTimeout(buildSources, 1200);
  // 最初は止まった輪を描き、ページの読み込みが終わってから動かし始める（最初の表示を速く）
  requestDraw();
  function kick() { setTimeout(start, 1200); }
  if (document.readyState === 'complete') kick(); else window.addEventListener('load', kick);
})();
