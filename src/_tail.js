
  // ---------- 文章（数字は上の計算から） ----------
  document.getElementById('spec').innerHTML =
    'モジュール ' + G.mn + '・' + G.z + ' 歯・ねじれ角 ' + G.beta + '°・歯幅 ' + G.b + ' mm のはすば歯車。' +
    '<b class="i">緑＝真値（誤差 0）</b>　<b class="e">橙＝誤差あり</b>　1 µm ＝ 1/1000 mm（髪の毛の太さは約 70 µm）';
  document.getElementById('points').innerHTML = POINTS.map(function (p) { return '<li>' + p + '</li>'; }).join('');
  document.getElementById('lead').innerHTML = '歯車の形は helical_gear.py の創成歯形。' + (LEAD || '');
  var panels = ORDER.map(function (k) {
    var c = document.getElementById('cv-' + k); c.setAttribute('aria-label', ARIA[k]);
    return { c: c, draw: PANELS[k] };
  });
  var playBtn = document.getElementById('playToggle');
  var speedBtn = document.getElementById('speedToggle');
  var SPEEDS = [1, 0.5, 0.25], LABELS = ['速さ 1×', '速さ 0.5×', '速さ 0.25×'];
  var si = 0;
  window.ANIM_PERIOD = PERIOD;   // 録画スクリプトが1周の長さを読む
  var paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var time = paused ? END + 0.1 : 0, last = 0, tokenAge = 1;
  function syncBtn() { playBtn.textContent = paused ? '再生' : '一時停止'; playBtn.setAttribute('aria-pressed', paused ? 'true' : 'false'); }
  playBtn.addEventListener('click', function () { paused = !paused; syncBtn(); });
  speedBtn.addEventListener('click', function () { si = (si + 1) % SPEEDS.length; speedBtn.textContent = LABELS[si]; });
  document.getElementById('restart').addEventListener('click', function () { time = 0; });
  syncBtn();
  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    tokenAge += dt || 0.016;
    if (tokenAge > 0.4) { readTokens(); tokenAge = 0; }
    if (!paused) time += dt * SPEEDS[si];
    var t = time % PERIOD;
    panels.forEach(function (p) { p.draw(fit(p.c), t); });
    requestAnimationFrame(loop);
  }
  readTokens();
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>
