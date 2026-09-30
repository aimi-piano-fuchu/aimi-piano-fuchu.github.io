(function () {
  'use strict';

  // ---- header: menu toggle & scrolled state
  var body = document.body;
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.menu-toggle');
  // 前のページで開いたまま戻ってきた時など、残っている「開いた」状態を消す（スクロールが止まったままになるため）
  body.classList.remove('menu-open');
  var setLabel = function (open) {
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    var sr = toggle.querySelector('.sr-only');
    if (sr) sr.textContent = open ? 'メニューを閉じる' : 'メニューを開く';
  };
  var closeMenu = function () {
    if (!body.classList.contains('menu-open')) return;
    body.classList.remove('menu-open');
    setLabel(false);
  };
  if (toggle) {
    toggle.addEventListener('click', function () {
      setLabel(body.classList.toggle('menu-open'));
    });
    // メニュー内のリンク・ページ内リンク（#〜）を押したら閉じる
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      if (a.closest('.gnav') || (a.getAttribute('href') || '').charAt(0) === '#') closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('menu-open')) {
        closeMenu();
        toggle.focus();
      }
    });
    // Android の「戻る」（bfcache から復元）・タブ切り替え・画面の回転・PC幅への拡大では必ず閉じる
    window.addEventListener('pageshow', closeMenu);
    window.addEventListener('orientationchange', closeMenu);
    document.addEventListener('visibilitychange', function () { if (document.hidden) closeMenu(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1180) closeMenu(); });
  }

  var floatCta = document.querySelector('.float-cta');
  // 下部の申し込み帯やフッターが見えている間は、固定ボタンを出さない（同じボタンが2つ並ぶため）
  var blockers = [].slice.call(document.querySelectorAll('.cta, .site-footer, .form'));
  var blocked = 0;
  if (floatCta && 'IntersectionObserver' in window) {
    var seen = new Set();
    var bo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
      blocked = seen.size;
      onScroll();
    });
    blockers.forEach(function (el) { bo.observe(el); });
  }
  var onScroll = function () {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (floatCta) {
      var nearBottom = window.innerHeight + y > document.documentElement.scrollHeight - 420;
      floatCta.classList.toggle('is-visible', y > 520 && !nearBottom && !blocked);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- reveal on scroll (content is visible without JS; fail-safe timer)
  var items = [].slice.call(document.querySelectorAll('.reveal'));
  var showAll = function () { items.forEach(function (el) { el.classList.add('is-in'); }); };
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
    // 画面外で IO が動かない環境（プレビューなど）でも本文が消えたままにならないように
    setTimeout(showAll, 2500);
  }

  // ---- news list: category filter + pagination
  var list = document.getElementById('news-list');
  if (list) {
    var rows = [].slice.call(list.children);
    document.addEventListener('news:updated', function () { rows = [].slice.call(list.children); render(); });
    var per = parseInt(list.getAttribute('data-per-page'), 10) || 20;
    var pager = document.getElementById('pager');
    var count = document.getElementById('news-count');
    var buttons = [].slice.call(document.querySelectorAll('.filter-btn'));
    var state = { cat: '', page: 1 };

    var render = function () {
      var match = rows.filter(function (r) { return !state.cat || r.getAttribute('data-cat') === state.cat; });
      var pages = Math.max(1, Math.ceil(match.length / per));
      if (state.page > pages) state.page = pages;
      rows.forEach(function (r) { r.hidden = true; });
      match.slice((state.page - 1) * per, state.page * per).forEach(function (r) { r.hidden = false; });
      if (count) count.textContent = (state.cat ? '「' + state.cat + '」' : 'すべて') + '　' + match.length + '件';
      if (!pager) return;
      pager.innerHTML = '';
      if (pages > 1) {
        // ページ番号は「最新（1）・今のページの前後1つ・最後」だけ。間は「…」、両端に「前へ／次へ」
        var go = function (n) {
          return function () {
            state.page = n; render();
            list.scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
        };
        var add = function (label, n, opts) {
          opts = opts || {};
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = label;
          b.setAttribute('aria-label', opts.aria || (n + 'ページ目'));
          if (opts.cls) b.className = opts.cls;
          if (n === state.page && !opts.cls) b.setAttribute('aria-current', 'true');
          if (opts.disabled) b.disabled = true; else b.addEventListener('click', go(n));
          pager.appendChild(b);
        };
        var gap = function () {
          var sp = document.createElement('span');
          sp.className = 'pager__gap'; sp.textContent = '…'; sp.setAttribute('aria-hidden', 'true');
          pager.appendChild(sp);
        };
        add('‹', state.page - 1, { cls: 'pager__step', aria: '前のページ', disabled: state.page === 1 });
        var shown = [1, state.page - 1, state.page, state.page + 1, pages]
          .filter(function (n, i, a) { return n >= 1 && n <= pages && a.indexOf(n) === i; })
          .sort(function (x, y) { return x - y; });
        shown.forEach(function (n, i) {
          if (i && n - shown[i - 1] > 1) gap();
          add(n === 1 ? '最新' : String(n), n, n === 1 ? { aria: '1ページ目（最新）' } : null);
        });
        add('›', state.page + 1, { cls: 'pager__step', aria: '次のページ', disabled: state.page === pages });
      }
    };
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        state.cat = b.getAttribute('data-filter');
        state.page = 1;
        render();
      });
    });
    render();
  }
})();
