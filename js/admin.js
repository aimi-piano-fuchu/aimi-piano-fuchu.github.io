// 空き枠の管理画面
(function () {
  'use strict';

  var S = window.AimiSlots;
  var cfg = window.SITE_CONFIG || {};
  var demo = !cfg.formEndpoint;
  var PASS_KEY = 'aimi-admin-pass';
  var ID_KEY = 'aimi-admin-id';

  var loginBox = document.getElementById('admin-login');
  var editor = document.getElementById('admin-editor');
  var daysEl = document.getElementById('admin-days');
  var noteEl = document.getElementById('admin-note');
  var statusEl = document.getElementById('admin-status');
  var previewEl = document.getElementById('admin-preview');
  var saveBtn = document.getElementById('admin-save');
  var data = null;
  var pass = '';
  var adminId = '';

  function getSaved(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function setSaved(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  function msg(kind, title, text) {
    statusEl.innerHTML = '<div class="panel panel--' + kind + '"><h3>' + title + '</h3>' + (text ? '<p>' + text + '</p>' : '') + '</div>';
  }

  function refreshPreview() { S.render(previewEl, data); }

  function draw() {
    daysEl.innerHTML = '';
    data.days.forEach(function (d, di) {
      var box = document.createElement('section');
      box.className = 'admin-day';
      box.innerHTML = '<h2 class="h3">' + S.esc(d.day) + '</h2><ul class="admin-slots"></ul>' +
        '<button type="button" class="btn btn--ghost btn--sm admin-add">＋ 時間を追加</button>';
      var ul = box.querySelector('ul');
      d.slots.forEach(function (s, si) {
        var li = document.createElement('li');
        li.className = 'admin-slot';
        var id = 'slot-' + di + '-' + si;
        li.innerHTML =
          '<label class="sr-only" for="' + id + '">' + S.esc(d.day) + 'の時間</label>' +
          '<input class="input admin-time" id="' + id + '" value="' + S.esc(s.time) + '" placeholder="例）16:00〜">' +
          '<button type="button" class="admin-toggle' + (s.open ? ' is-open' : '') + '" aria-pressed="' + (s.open ? 'true' : 'false') + '">' + (s.open ? '空きあり' : '満席') + '</button>' +
          '<button type="button" class="admin-del" aria-label="この時間を削除">削除</button>';
        li.querySelector('.admin-time').addEventListener('input', function (e) { s.time = e.target.value; refreshPreview(); });
        li.querySelector('.admin-toggle').addEventListener('click', function () { s.open = !s.open; draw(); });
        li.querySelector('.admin-del').addEventListener('click', function () { d.slots.splice(si, 1); draw(); });
        ul.appendChild(li);
      });
      box.querySelector('.admin-add').addEventListener('click', function () {
        d.slots.push({ time: '', open: true });
        draw();
        var inputs = daysEl.querySelectorAll('.admin-day')[di].querySelectorAll('.admin-time');
        inputs[inputs.length - 1].focus();
      });
      daysEl.appendChild(box);
    });
    noteEl.value = data.note || '';
    refreshPreview();
  }

  noteEl.addEventListener('input', function () { data.note = noteEl.value; refreshPreview(); });

  function openEditor() {
    loginBox.hidden = true;
    editor.hidden = false;
    document.getElementById('admin-tabs').hidden = false;
    window.AimiAdminCred = { id: adminId, pass: pass };
    document.dispatchEvent(new CustomEvent('admin:login', { detail: window.AimiAdminCred }));
    // 管理画面は時間がかかっても本物のデータを待つ（途中で見切るとサンプルで上書きしてしまうため）
    saveBtn.disabled = true;
    daysEl.innerHTML = '<p class="field__hint">空き枠を読み込んでいます…（初回は30秒ほどかかることがあります）</p>';
    var loader = demo ? S.load() : fetch(cfg.formEndpoint + '?action=slots').then(function (r) { return r.json(); })
      .then(function (res) { if (!res || res.result !== 'success') throw new Error('load'); return res.slots; });
    loader.then(function (d) {
      data = d || { note: 'その他の時間はご相談ください。', days: [{ day: '金曜', slots: [] }, { day: '土曜', slots: [] }] };
      if (!data.days) data.days = [];
      draw();
      saveBtn.disabled = false;
    }).catch(function () {
      daysEl.innerHTML = '';
      msg('err', '読み込めませんでした', '通信を確認して、ページを開き直してください。（保存はできないようにしてあります）');
    });
  }

  document.getElementById('admin-login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('admin-id').value.trim();
    var v = document.getElementById('admin-pass').value.trim();
    var err = document.getElementById('admin-login-error');
    if (demo) { adminId = id; pass = v; openEditor(); return; }
    if (!id || !v) { err.textContent = 'IDとパスコードを入力してください。'; return; }
    err.textContent = '確認しています…';
    S.post({ action: 'checkPass', id: id, pass: v }).then(function (res) {
      if (res && res.result === 'success') { adminId = id; pass = v; setSaved(ID_KEY, id); setSaved(PASS_KEY, v); err.textContent = ''; openEditor(); }
      else err.textContent = 'IDかパスコードがちがいます。何度もまちがえると、10分ほど受け付けなくなります。';
    }).catch(function () { err.textContent = '通信できませんでした。電波の良い場所でもう一度お試しください。'; });
  });

  saveBtn.addEventListener('click', function () {
    if (!data) return;
    data.days.forEach(function (d) { d.slots = d.slots.filter(function (s) { return s.time.trim(); }); });
    if (demo) {
      var t = new Date();
      data.updated = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
      S.writeDemo(data);
      draw();
      msg('ok', '保存しました（テスト版）', 'テスト版なので、この端末のブラウザにだけ保存されます。本番ではサイトを見る全員に反映されます。');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = '保存しています…';
    S.post({ action: 'saveSlots', id: adminId, pass: pass, slots: JSON.stringify(data) }).then(function (res) {
      if (!res || res.result !== 'success') throw new Error(res && res.message);
      data = res.slots;
      draw();
      msg('ok', '保存しました', 'サイトの空き枠に反映されました（表示が変わらないときは、ページを再読み込みしてください）。');
    }).catch(function (err) {
      if (err && err.message === 'pass') msg('err', '保存できませんでした', 'IDかパスコードが変わった可能性があります。ページを開き直して、もう一度ログインしてください。');
      else msg('err', '保存できませんでした', '通信がうまくいきませんでした。少し待ってから、もう一度「保存する」を押してください。');
    }).then(function () {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存する';
    });
  });

  if (demo) document.getElementById('admin-demo').hidden = false;
  var saved = getSaved(PASS_KEY);
  if (saved && !demo) { adminId = getSaved(ID_KEY); pass = saved; openEditor(); }
})();
