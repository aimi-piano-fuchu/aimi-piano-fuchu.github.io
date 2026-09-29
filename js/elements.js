// 「4つのこと」：1〜4を押す（PCはカーソルを合わせる）と説明が切り替わる。スマホでは押した項目の下に開く
(function () {
  'use strict';
  var root = document.querySelector('[data-elements]');
  if (!root) return;
  var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
  var panels = [].slice.call(root.querySelectorAll('[role="tabpanel"]'));
  var box = root.querySelector('.elements__panels');
  var mq = window.matchMedia('(max-width: 860px)');
  var current = 1;

  function place() {
    // スマホ：選んだ項目の直後へ、PC：右の列へ
    var li = tabs[current].closest('li');
    if (mq.matches) li.after(box); else root.appendChild(box);
  }
  function select(i, focus) {
    current = i;
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      t.closest('li').classList.toggle('is-focus', on);
      panels[k].hidden = !on;
    });
    place();
    if (focus) tabs[i].focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i); });
    t.addEventListener('mouseenter', function () { if (window.matchMedia('(hover: hover)').matches && !mq.matches) select(i); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select((i + tabs.length - 1) % tabs.length, true); }
    });
  });
  (mq.addEventListener ? mq.addEventListener('change', place) : mq.addListener(place));
  select(1);
})();
