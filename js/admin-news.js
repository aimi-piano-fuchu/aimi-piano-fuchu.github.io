// 管理画面：お知らせの投稿・削除と、Instagram への受け渡し
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var S = window.AimiSlots;
  var cred = null;
  var loaded = false;
  // ログイン情報は admin.js が先に用意していることがある（ページを開き直したとき）
  function getCred() { return cred || window.AimiAdminCred || null; }
  var files = [];          // 選んだ写真（縮小済みの File）
  var dataUrls = [];       // 送信用の JPEG データ

  var tabSlots = document.getElementById('tab-btn-slots');
  var tabNews = document.getElementById('tab-btn-news');
  var paneSlots = document.getElementById('admin-editor');
  var paneNews = document.getElementById('admin-news');
  var form = document.getElementById('news-form');
  var photoInput = document.getElementById('news-photos');
  var thumbs = document.getElementById('news-thumbs');
  var statusEl = document.getElementById('news-status');
  var submit = document.getElementById('news-submit');
  var postsEl = document.getElementById('admin-posts');
  var esc = S.esc;

  function showTab(news) {
    tabSlots.setAttribute('aria-selected', news ? 'false' : 'true');
    tabNews.setAttribute('aria-selected', news ? 'true' : 'false');
    paneSlots.hidden = news;
    paneNews.hidden = !news;
  }
  tabSlots.addEventListener('click', function () { showTab(false); });
  tabNews.addEventListener('click', function () { showTab(true); if (!loaded && cfg.formEndpoint) loadPosts(); });

  var today = new Date();
  document.getElementById('news-date').value = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);

  function msg(kind, title, html) {
    statusEl.innerHTML = '<div class="panel panel--' + kind + '"><h3>' + title + '</h3>' + (html || '') + '</div>';
  }

  // 写真を長辺1280pxのJPEGに縮小（送信を軽くするため）
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var max = 1280, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var url = c.toDataURL('image/jpeg', 0.84);
        c.toBlob(function (b) { resolve({ url: url, file: new File([b], 'aimi-piano-' + Date.now() + '.jpg', { type: 'image/jpeg' }) }); }, 'image/jpeg', 0.84);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  photoInput.addEventListener('change', function () {
    var picked = [].slice.call(photoInput.files || []).slice(0, 4);
    thumbs.innerHTML = '';
    Promise.all(picked.map(shrink)).then(function (res) {
      files = res.map(function (r) { return r.file; });
      dataUrls = res.map(function (r) { return r.url; });
      thumbs.innerHTML = dataUrls.map(function (u) { return '<img src="' + u + '" alt="">'; }).join('');
      if ((photoInput.files || []).length > 4) msg('err', '写真は4枚までです', '<p>最初の4枚を使います。</p>');
    }).catch(function () { msg('err', '写真を読み込めませんでした', '<p>別の写真で試してください。</p>'); });
  });

  function caption(title, body) {
    return title + '\n\n' + (body ? body + '\n\n' : '') +
      'あいみピアノ教室（府中市四谷）\n体験レッスン受付中♪ プロフィールのリンクからどうぞ\n\n' +
      '#あいみピアノ教室 #府中市ピアノ教室 #府中市 #国立市 #日野市 #ピアノ教室 #リトミック #習い事';
  }

  // 投稿のあと：文章をコピーして、写真と一緒に共有シートを開く（Instagramを選ぶ）
  function shareToInstagram(text, shareFiles) {
    var done = function (note) {
      msg('ok', '投稿しました', '<p>サイトのお知らせに載りました（反映まで1分ほど）。</p>' + (note || ''));
    };
    var copy = navigator.clipboard ? navigator.clipboard.writeText(text).catch(function () {}) : Promise.resolve();
    copy.then(function () {
      if (shareFiles.length && navigator.canShare && navigator.canShare({ files: shareFiles })) {
        msg('ok', '投稿しました', '<p>次に、Instagram に渡します。</p><button type="button" class="btn btn--primary" id="ig-share">Instagram に渡す</button><p class="field__hint">共有の画面で「Instagram」を選ぶと、写真が入った状態で開きます。文章はコピー済みなので、キャプション欄を長押しして「ペースト」してください。</p>');
        // 共有はボタンを押した直後でないと動かない端末があるため、ボタンを挟む
        document.getElementById('ig-share').addEventListener('click', function () {
          navigator.clipboard && navigator.clipboard.writeText(text).catch(function () {});
          navigator.share({ files: shareFiles }).then(function () { done('<p>Instagram の画面で、キャプションをペーストして投稿してください。</p>'); })
            .catch(function () { done('<p>共有はキャンセルされました。あとでもう一度渡す場合は、下の一覧の「Instagramに渡す」から。</p>'); });
        });
      } else {
        done('<p>この端末では写真を直接渡せないため、文章だけコピーしました。Instagram アプリで写真を選び、キャプションにペーストしてください。</p><textarea class="textarea" readonly>' + esc(text) + '</textarea>');
      }
    });
  }

  function renderPosts(posts) {
    if (!posts.length) { postsEl.innerHTML = '<li class="field__hint">まだありません。</li>'; return; }
    postsEl.innerHTML = posts.map(function (p) {
      return '<li class="admin-post"><a href="news/p?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a>' +
        '<button type="button" class="admin-del" data-id="' + esc(p.id) + '">削除</button>' +
        '<small>' + esc(p.date) + '・' + esc(p.category) + (p.images.length ? '・写真' + p.images.length + '枚' : '') + '</small></li>';
    }).join('');
    postsEl.querySelectorAll('.admin-del').forEach(function (b) {
      var armed = false;
      b.addEventListener('click', function () {
        if (!armed) { armed = true; b.textContent = 'もう一度押すと削除'; setTimeout(function () { armed = false; b.textContent = '削除'; }, 4000); return; }
        b.disabled = true; b.textContent = '削除しています…';
        var c = getCred();
        S.post({ action: 'deleteNews', id: c.id, pass: c.pass, postId: b.getAttribute('data-id') })
          .then(function (res) { if (res.result !== 'success') throw 0; renderPosts(res.posts); })
          .catch(function () { b.disabled = false; b.textContent = '削除'; msg('err', '削除できませんでした', '<p>少し待ってからもう一度お試しください。</p>'); });
      });
    });
  }

  function loadPosts() {
    loaded = true;
    fetch(cfg.formEndpoint + '?action=news').then(function (r) { return r.json(); })
      .then(function (res) { renderPosts(res.posts || []); })
      .catch(function () { postsEl.innerHTML = '<li class="field__hint">一覧を読み込めませんでした。ページを開き直してください。</li>'; });
  }

  document.addEventListener('admin:login', function (e) {
    cred = e.detail;
    if (cfg.formEndpoint) loadPosts();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = document.getElementById('news-title').value.trim();
    var body = document.getElementById('news-body').value.trim();
    if (!title) { msg('err', '題名を入れてください'); document.getElementById('news-title').focus(); return; }
    var c = getCred();
    if (!c || !cfg.formEndpoint) { msg('err', '投稿できません', '<p>ログインし直してください。</p>'); return; }
    var post = {
      title: title, body: body,
      category: document.getElementById('news-cat').value,
      date: document.getElementById('news-date').value,
      images: dataUrls
    };
    var wantIg = document.getElementById('news-ig').checked;
    var shareFiles = files.slice();
    submit.disabled = true; submit.textContent = '投稿しています…';
    S.post({ action: 'postNews', id: c.id, pass: c.pass, post: JSON.stringify(post) })
      .then(function (res) {
        if (!res || res.result !== 'success') throw new Error(res && res.message);
        renderPosts(res.posts);
        try { localStorage.removeItem('aimi-news-cache'); } catch (err) {}
        form.reset(); thumbs.innerHTML = ''; files = []; dataUrls = [];
        document.getElementById('news-date').value = post.date;
        if (wantIg) shareToInstagram(caption(title, body), shareFiles);
        else msg('ok', '投稿しました', '<p>サイトのお知らせに載りました。</p>');
      })
      .catch(function (err) {
        msg('err', '投稿できませんでした', err && err.message === 'pass'
          ? '<p>ログインが切れたようです。ページを開き直してログインしてください。</p>'
          : '<p>通信がうまくいきませんでした。写真が多い場合は枚数を減らして、もう一度お試しください。</p>');
      })
      .then(function () { submit.disabled = false; submit.textContent = '投稿する'; });
  });
})();
