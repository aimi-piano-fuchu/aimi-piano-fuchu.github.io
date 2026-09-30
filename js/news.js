// 管理画面から投稿したお知らせを読み込んで、一覧・トップ・記事ページに差し込む
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var CACHE_KEY = 'aimi-news-cache';
  var root = document.documentElement.getAttribute('data-root') || '';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
  function writeCache(d) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (e) {} }

  function load() {
    if (!cfg.formEndpoint) return Promise.resolve([]);
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
    return fetch(cfg.formEndpoint + '?action=news', ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (res) {
        clearTimeout(timer);
        var posts = res && res.result === 'success' ? res.posts || [] : [];
        // 日付・画像が欠けた投稿で表示全体が止まらないように形をそろえる
        posts = posts.filter(function (p) { return p && p.id; }).map(function (p) {
          p.date = String(p.date || ''); p.category = p.category || ''; p.title = p.title || '';
          p.images = p.images || [];
          return p;
        });
        writeCache(posts);
        return posts;
      })
      .catch(function () { clearTimeout(timer); return readCache() || []; });
  }

  var chev = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>';
  function row(p) {
    return '<li data-cat="' + esc(p.category) + '" data-dyn="1"><a class="news-item" href="' + root + 'news/p?id=' + encodeURIComponent(p.id) + '">' +
      '<time datetime="' + esc(p.date) + '">' + esc(p.date.replace(/-/g, '.')) + '</time>' +
      '<span class="news-item__cat">' + esc(p.category) + '</span>' +
      '<span class="news-item__title">' + esc(p.title) + '</span>' + chev + '</a></li>';
  }

  // 静的な記事と日付順に混ぜる
  function merge(list, posts, limit) {
    list.querySelectorAll('li[data-dyn]').forEach(function (li) { li.remove(); });
    // すでに静的ページになっている投稿は二重に出さない
    posts = posts.filter(function (p) { return !list.querySelector('li[data-id="' + p.id + '"]'); });
    var tmp = document.createElement('ul');
    tmp.innerHTML = posts.map(row).join('');
    [].slice.call(tmp.children).forEach(function (li) {
      var d = li.querySelector('time').getAttribute('datetime');
      var before = [].slice.call(list.children).filter(function (x) {
        var t = x.querySelector('time'); return t && t.getAttribute('datetime') <= d;
      })[0];
      list.insertBefore(li, before || null);
    });
    if (limit) [].slice.call(list.children).slice(limit).forEach(function (li) { li.remove(); });
    document.dispatchEvent(new CustomEvent('news:updated'));
  }

  function renderArticle(el, posts) {
    var id = new URLSearchParams(location.search).get('id');
    var p = posts.filter(function (x) { return x.id === id; })[0];
    if (!p) {
      el.innerHTML = '<h1>記事が見つかりません</h1><p>削除されたか、URLがまちがっている可能性があります。</p><p><a class="btn btn--ghost btn--sm" href="./">お知らせ一覧へ戻る</a></p>';
      return;
    }
    document.title = p.title + '｜あいみピアノ教室';
    el.innerHTML =
      '<div class="article__meta"><time datetime="' + esc(p.date) + '" class="num">' + esc(p.date.replace(/-/g, '.')) + '</time><span class="news-item__cat">' + esc(p.category) + '</span></div>' +
      '<h1>' + esc(p.title) + '</h1>' +
      (p.body ? '<div class="article__body">' + esc(p.body) + '</div>' : '') +
      (p.images && p.images.length ? '<div class="article__images">' + p.images.map(function (src, i) {
        return '<img src="' + esc(src) + '" alt="「' + esc(p.title) + '」の写真 ' + (i + 1) + '" loading="lazy" referrerpolicy="no-referrer">';
      }).join('') + '</div>' : '') +
      '<p><a class="btn btn--ghost btn--sm" href="./">お知らせ一覧へ戻る</a></p>';
  }

  var list = document.getElementById('news-list') || document.getElementById('latest-news');
  var article = document.getElementById('dyn-article');
  if (!list && !article) return;

  var cached = readCache();
  if (cached) {
    if (list) merge(list, cached, list.id === 'latest-news' ? 4 : 0);
    if (article) renderArticle(article, cached);
  }
  load().then(function (posts) {
    if (list) merge(list, posts, list.id === 'latest-news' ? 4 : 0);
    if (article) renderArticle(article, posts);
  });

  window.AimiNews = { load: load, esc: esc };
})();
