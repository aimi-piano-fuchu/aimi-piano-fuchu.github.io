(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;
  var status = document.getElementById('form-status');
  var submit = document.getElementById('submit-btn');
  var endpoint = (window.SITE_CONFIG && window.SITE_CONFIG.formEndpoint) || '';
  var INSTAGRAM = 'https://www.instagram.com/aimi_piano_/';

  var rules = {
    name: function (v) { return v.trim() ? '' : 'お名前を入力してください。'; },
    age: function (v) { return v ? '' : 'レッスンを受ける方の年齢を選んでください。'; },
    email: function (v) {
      if (!v.trim()) return 'メールアドレスを入力してください。';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'メールアドレスの形式を確認してください（例：example@mail.com）。';
    }
  };

  function setError(name, msg) {
    var field = form.querySelector('[data-field="' + name + '"]');
    if (!field) return;
    var el = field.querySelector('.field__error');
    field.classList.toggle('field--error', !!msg);
    if (msg) {
      if (!el) { el = document.createElement('p'); el.className = 'field__error'; el.id = 'err-' + name; field.appendChild(el); }
      el.textContent = msg;
      var input = field.querySelector('input, select, textarea');
      if (input) input.setAttribute('aria-describedby', el.id);
    } else if (el) {
      el.remove();
    }
  }

  function validate() {
    var first = null;
    Object.keys(rules).forEach(function (k) {
      var msg = rules[k](form.elements[k].value);
      setError(k, msg);
      if (msg && !first) first = form.elements[k];
    });
    var agree = document.getElementById('agree');
    if (!agree.checked && !first) first = agree;
    return first;
  }

  Object.keys(rules).forEach(function (k) {
    form.elements[k].addEventListener('blur', function () {
      if (form.querySelector('[data-field="' + k + '"].field--error')) setError(k, rules[k](form.elements[k].value));
    });
  });

  // 「体験レッスン」を選んだときだけ、枠・曜日・日時の欄を出す。
  // 空き枠があれば「ご希望の枠」から選び、「その他の日時」を選んだときだけ曜日・日時の欄を出す。
  function syncFields() {
    var trial = form.querySelector('input[name="type"]:checked').value.indexOf('体験') >= 0;
    var slotField = form.querySelector('[data-field="slot"]');
    var hasSlots = slotField && !slotField.hasAttribute('data-empty') && slotField.querySelector('input[name="slot"]');
    var other = !!form.querySelector('input[name="slot"][value="その他の日時"]:checked');
    if (slotField) slotField.hidden = !(trial && hasSlots);
    ['days', 'times'].forEach(function (k) {
      var f = form.querySelector('[data-field="' + k + '"]');
      if (f) f.hidden = !trial || (hasSlots && !other);
    });
  }
  form.addEventListener('change', function (e) {
    if (e.target && (e.target.name === 'type' || e.target.name === 'slot')) syncFields();
  });
  document.addEventListener('slots:choices', syncFields);
  syncFields();

  function panel(kind, title, html) {
    status.innerHTML = '<div class="panel panel--' + kind + '"><h3>' + title + '</h3>' + html + '</div>';
    status.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = validate();
    if (bad) {
      if (bad.id === 'agree') panel('err', '送信できませんでした', '<p>プライバシーポリシーへの同意にチェックを入れてください。</p>');
      bad.focus();
      return;
    }
    if (form.elements.website.value) return; // bot

    var visible = function (sel) { var f = form.querySelector(sel); return f && !f.hidden; };
    var slots = visible('[data-field="slot"]') ? [].slice.call(form.querySelectorAll('input[name="slot"]:checked')).map(function (x) { return x.value; }) : [];
    var days = visible('[data-field="days"]') ? [].slice.call(form.querySelectorAll('input[name="days"]:checked')).map(function (x) { return x.value; }) : [];
    // 選んだ枠は「希望曜日」の欄にまとめて送る（GAS・記録表はそのまま使える）
    days = slots.filter(function (v) { return v !== 'その他の日時'; }).concat(days);
    var data = new URLSearchParams();
    data.append('type', form.querySelector('input[name="type"]:checked').value);
    ['name', 'kana', 'age', 'experience', 'times', 'email', 'tel', 'message', 'source'].forEach(function (k) {
      data.append(k, k === 'times' && !visible('[data-field="times"]') ? '' : form.elements[k].value.trim());
    });
    data.append('days', days.join('・'));

    if (!endpoint) {
      panel('err', 'フォームは準備中です',
        '<p>申し訳ありません。現在このフォームからは送信できません。お手数ですが、<a href="' + INSTAGRAM + '" target="_blank" rel="noopener">InstagramのDM（@aimi_piano_）</a>からご連絡ください。</p>');
      return;
    }

    submit.disabled = true;
    submit.textContent = '送信しています…';
    fetch(endpoint, { method: 'POST', body: data })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || res.result !== 'success') throw new Error('bad response');
        form.reset();
        panel('ok', '送信が完了しました',
          '<p>お問い合わせありがとうございます。ご入力のメールアドレスに確認メールをお送りしました。内容を確認のうえ、講師からご連絡します。</p><p>確認メールが届かない場合は、迷惑メールフォルダをご確認ください。</p>');
      })
      .catch(function () {
        panel('err', '送信できませんでした',
          '<p>通信がうまくいかなかったようです。少し時間をおいて、もう一度お試しください。続けて失敗する場合は、<a href="' + INSTAGRAM + '" target="_blank" rel="noopener">InstagramのDM（@aimi_piano_）</a>からご連絡ください。</p>');
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = 'この内容で送信する';
      });
  });
})();
