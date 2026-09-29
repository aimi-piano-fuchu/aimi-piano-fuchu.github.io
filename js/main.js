(function () {
  'use strict';

  // ---- header: menu toggle & scrolled state
  var body = document.body;
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = body.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.querySelector('.sr-only').textContent = open ? 'メニューを閉じる' : 'メニューを開く';
    });
    document.querySelectorAll('.gnav a').forEach(function (a) {
      a.addEventListener('click', function () {
        body.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('menu-open')) {
        body.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
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
      pager.innerHTML = '';
      if (pages > 1) {
        for (var p = 1; p <= pages; p++) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = p;
          b.setAttribute('aria-label', p + 'ページ目');
          if (p === state.page) b.setAttribute('aria-current', 'true');
          b.addEventListener('click', (function (n) {
            return function () {
              state.page = n; render();
              list.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
          })(p));
          pager.appendChild(b);
        }
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
