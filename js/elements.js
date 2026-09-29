// 「4つのこと」
// PC：1〜4を押す（カーソルを合わせる）と右の説明が切り替わる
// スマホ：最初は閉じていて、押した項目の下に説明が開く（もう一度押すと閉じる）
(function () {
  'use strict';
  var root = document.querySelector('[data-elements]');
  if (!root) return;
  var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
  var panels = [].slice.call(root.querySelectorAll('[role="tabpanel"]'));
  var box = root.querySelector('.elements__panels');
  var mq = window.matchMedia('(max-width: 860px)');
  var current = mq.matches ? -1 : 1;

  function render() {
    tabs.forEach(function (t, k) {
      var on = k === current;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('aria-expanded', on ? 'true' : 'false');
      t.closest('li').classList.toggle('is-focus', on);
      t.closest('li').classList.toggle('is-open', on);
      panels[k].hidden = !on;
    });
    if (mq.matches) {
      box.hidden = current < 0;
      if (current >= 0) tabs[current].closest('li').after(box);
    } else {
      box.hidden = false;
      root.appendChild(box);
    }
  }
  function select(i) {
    current = (mq.matches && i === current) ? -1 : i;
    render();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i); });
    t.addEventListener('mouseenter', function () {
      if (!mq.matches && window.matchMedia('(hover: hover)').matches && current !== i) select(i);
    });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i + tabs.length - 1) % tabs.length;
      if (n !== null) { e.preventDefault(); current = n; render(); tabs[n].focus(); }
    });
  });
  var onChange = function () { if (!mq.matches && current < 0) current = 1; render(); };
  (mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange));
  render();
})();
