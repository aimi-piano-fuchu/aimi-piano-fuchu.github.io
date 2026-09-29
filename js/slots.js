// 空き枠：読み込み・表示（公開ページ）と、管理画面から使う共通処理
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var DEMO_KEY = 'aimi-slots-demo';
  var CACHE_KEY = 'aimi-slots-cache';

  // フォーム送信先が未設定のテスト版で見せるサンプル
  var SAMPLE = {
    updated: '',
    note: 'その他の時間はご相談ください。',
    days: [
      { day: '金曜', slots: [{ time: '17:00〜', open: true }, { time: '18:00〜', open: true }] },
      { day: '土曜', slots: [{ time: '9:00〜', open: true }, { time: '11:10〜', open: true }] }
    ]
  };

  function readDemo() {
    try { var t = localStorage.getItem(DEMO_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  function writeDemo(data) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }

  function readCache() {
    try { var t = localStorage.getItem(CACHE_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  function writeCache(data) {
    try { if (data) localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  // Apps Script は初回応答が遅いことがあるので、8秒で見切って案内文に切り替える
  function load() {
    if (!cfg.formEndpoint) {
      if (!cfg.demo) return Promise.resolve(null);
      return Promise.resolve(readDemo() || JSON.parse(JSON.stringify(SAMPLE)));
    }
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(cfg.formEndpoint + '?action=slots', ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (res) {
        clearTimeout(timer);
        var data = res && res.result === 'success' ? res.slots : null;
        writeCache(data);
        return data;
      })
      .catch(function () { clearTimeout(timer); return readCache(); });
  }

  function post(params) {
    var body = new URLSearchParams();
    Object.keys(params).forEach(function (k) { body.append(k, params[k]); });
    return fetch(cfg.formEndpoint, { method: 'POST', body: body }).then(function (r) { return r.json(); });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function fmtDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    return m ? (+m[2]) + '月' + (+m[3]) + '日' : '';
  }

  function render(el, data) {
    if (!data || !data.days || !data.days.length) {
      el.innerHTML = '<p class="slots__fallback">最新の空き状況は、お問い合わせフォームからお気軽にお尋ねください。</p>';
      return;
    }
    var openCount = 0;
    var cols = data.days.map(function (d) {
      var rows = (d.slots || []).map(function (s) {
        if (s.open) openCount++;
        return '<li class="slot' + (s.open ? ' slot--open' : ' slot--full') + '"><span class="slot__time num">' + esc(s.time) +
          '</span><span class="slot__state">' + (s.open ? '空きあり' : '満席') + '</span></li>';
      }).join('');
      return '<div class="slots__day"><p class="slots__name">' + esc(d.day) + '</p><ul class="slots__list">' +
        (rows || '<li class="slot slot--full"><span class="slot__time">—</span><span class="slot__state">満席</span></li>') + '</ul></div>';
    }).join('');
    var when = fmtDate(data.updated);
    el.innerHTML =
      '<div class="slots__head"><p class="slots__title">現在の空き枠</p>' +
      (when ? '<p class="slots__updated">' + when + '更新</p>' : '<p class="slots__updated">サンプル表示</p>') + '</div>' +
      '<div class="slots__grid">' + cols + '</div>' +
      (data.note ? '<p class="slots__note">' + esc(data.note) + '</p>' : '') +
      (openCount === 0 ? '<p class="slots__note">現在、すべての枠が埋まっています。キャンセル待ちはお問い合わせください。</p>' : '');
  }

  window.AimiSlots = { load: load, post: post, render: render, sample: SAMPLE, readDemo: readDemo, writeDemo: writeDemo, esc: esc };

  document.querySelectorAll('[data-slots]').forEach(function (el) {
    var cached = cfg.formEndpoint ? readCache() : null;
    if (cached) render(el, cached);
    else el.innerHTML = '<p class="slots__fallback">空き状況を読み込んでいます…</p>';
    load().then(function (d) { render(el, d); }).catch(function () { render(el, null); });
  });
})();
