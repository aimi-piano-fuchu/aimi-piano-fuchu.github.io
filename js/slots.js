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
    // サーバーが「空き枠なし」を返したら、古いキャッシュも消す（古い曜日が残り続けないように）
    try { if (data) localStorage.setItem(CACHE_KEY, JSON.stringify(data)); else localStorage.removeItem(CACHE_KEY); } catch (e) {}
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
      // まだ空き枠が登録されていない時は、枠ごと出さない
      if (!cfg.demo && !el.hasAttribute('data-keep')) { el.hidden = true; return; }
      el.innerHTML = '<p class="slots__fallback">' + esc(el.getAttribute('data-fallback') || '最新の空き状況は、お問い合わせフォームからお気軽にお尋ねください。') + '</p>';
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
        (rows || '<li class="slot slot--full"><span class="slot__state">現在空きはありません</span></li>') + '</ul></div>';
    }).join('');
    var when = fmtDate(data.updated);
    el.innerHTML =
      '<div class="slots__head"><p class="slots__title">現在の空き枠</p>' +
      (when ? '<p class="slots__updated">' + when + '更新</p>' : '<p class="slots__updated">サンプル表示</p>') + '</div>' +
      '<div class="slots__grid">' + cols + '</div>' +
      (data.note ? '<p class="slots__note">' + esc(data.note) + '</p>' : '') +
      (openCount === 0 ? '<p class="slots__note">現在、すべての枠が埋まっています。キャンセル待ちはお問い合わせください。</p>' : '');
  }

  // 開講日：管理画面の曜日・開講時間に合わせて、各ページの表示を書きかえる
  // （HTMLに書いてある内容は、読み込み前と通信できない時の表示）
  var DEFAULT_HOURS = { '金曜': '14:00〜20:00', '土曜': '9:00〜18:00' };
  var EN = { '月曜': 'Mon', '火曜': 'Tue', '水曜': 'Wed', '木曜': 'Thu', '金曜': 'Fri', '土曜': 'Sat', '日曜': 'Sun' };
  function hoursOf(d) { return d.hours != null ? d.hours : (DEFAULT_HOURS[d.day] || ''); }

  var original = [];
  function applyDays(data) {
    var els = document.querySelectorAll('[data-days]');
    if (!original.length) els.forEach(function (el) { original.push([el, el.innerHTML]); });
    if (!data || !data.days || !data.days.length) {
      // 曜日が登録されていない時は、HTMLに書いてある元の表示に戻す
      original.forEach(function (o) { o[0].innerHTML = o[1]; });
      return;
    }
    var days = data.days;
    els.forEach(function (el) {
      var kind = el.getAttribute('data-days');
      if (kind === 'cards') {
        el.innerHTML = days.map(function (d) {
          return '<div class="day"><p class="day__name">' + esc(d.day) + '日<span>' + (EN[d.day] || '') + '</span></p>' +
            '<p class="day__time num">' + (esc(hoursOf(d)) || '時間はご相談ください') + '</p></div>';
        }).join('');
      } else if (kind === 'short') {
        el.textContent = days.map(function (d) { return d.day.charAt(0); }).join('・') + '曜日';
      } else if (kind === 'list') {
        el.innerHTML = days.map(function (d) { return esc(d.day) + (hoursOf(d) ? ' ' + esc(hoursOf(d)) : ''); }).join('<br>');
      } else if (kind === 'sentence') {
        el.innerHTML = days.map(function (d) { return '<span class="nw">' + esc(d.day + hoursOf(d)) + '</span>'; }).join('、');
      } else if (kind === 'hint') {
        var tail = days.some(hoursOf) ? 'です。' : '。';
        el.innerHTML = days.map(function (d, i) {
          return '<span class="nw">' + esc(d.day + (hoursOf(d) ? 'は' + hoursOf(d) : '')) + (i < days.length - 1 ? '、' : tail) + '</span>';
        }).join('');
      } else if (kind === 'choices') {
        var checked = {};
        el.querySelectorAll('input:checked').forEach(function (i) { checked[i.value] = true; });
        el.innerHTML = days.map(function (d, i) {
          return '<label class="choice"><input type="checkbox" id="day-' + i + '" name="days" value="' + esc(d.day) + '"' +
            (checked[d.day] ? ' checked' : '') + '><span>' + esc(d.day) + '</span></label>';
        }).join('');
      }
    });
  }

  // お問い合わせ：体験レッスンの「ご希望の枠」を、空いている枠から作る（最後に「その他の日時」）
  function applySlotChoices(data) {
    document.querySelectorAll('[data-slot-choices]').forEach(function (el) {
      var open = [];
      ((data && data.days) || []).forEach(function (d) {
        (d.slots || []).forEach(function (s) { if (s.open && String(s.time).trim()) open.push(d.day + ' ' + s.time); });
      });
      var field = el.closest('.field');
      if (!open.length) { el.innerHTML = ''; field.setAttribute('data-empty', ''); document.dispatchEvent(new CustomEvent('slots:choices')); return; }
      field.removeAttribute('data-empty');
      var checked = {};
      el.querySelectorAll('input:checked').forEach(function (i) { checked[i.value] = true; });
      el.innerHTML = open.concat(['その他の日時']).map(function (v, i) {
        return '<label class="choice"><input type="checkbox" id="slot-' + i + '" name="slot" value="' + esc(v) + '"' +
          (checked[v] ? ' checked' : '') + '><span>' + esc(v) + '</span></label>';
      }).join('');
      document.dispatchEvent(new CustomEvent('slots:choices'));
    });
  }

  window.AimiSlots = { load: load, post: post, render: render, sample: SAMPLE, readDemo: readDemo, writeDemo: writeDemo, esc: esc, defaultHours: DEFAULT_HOURS };

  var slotEls = document.querySelectorAll('[data-slots]');
  if (!slotEls.length && !document.querySelector('[data-days]') && !document.querySelector('[data-slot-choices]')) return;
  var cached = cfg.formEndpoint ? readCache() : null;
  slotEls.forEach(function (el) {
    if (cached) render(el, cached);
    else el.innerHTML = '<p class="slots__fallback">空き状況を読み込んでいます…</p>';
  });
  if (cached) { applyDays(cached); applySlotChoices(cached); }
  load().then(function (d) {
    slotEls.forEach(function (el) { render(el, d); });
    applyDays(d);
    applySlotChoices(d);
  }).catch(function () { slotEls.forEach(function (el) { render(el, null); }); });
})();
