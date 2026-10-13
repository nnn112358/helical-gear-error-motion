  // ---------- 計算 ----------
  // 山の間隔（平均）：平均線を下から上へ横切る点の間隔の平均（JIS の RSm / WSm と同じ考え方）
  function spacing(y, len) {
    var xs = [], i, n = y.length - 1;
    for (i = 1; i <= n; i++) if (y[i - 1] < 0 && y[i] >= 0) xs.push((i - 1 + (-y[i - 1]) / (y[i] - y[i - 1])) / n * len);
    var d = 0; for (i = 1; i < xs.length; i++) d += xs[i] - xs[i - 1];
    return { mean: xs.length > 1 ? d / (xs.length - 1) : NaN, xs: xs };
  }
  function mxa(a) { return a.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0); }
  function meanAbs(a) { return a.reduce(function (s, v) { return s + Math.abs(v); }, 0) / a.length; }
  var SR = { y: ROUGH.y, len: ROUGH.len, Ra: meanAbs(ROUGH.y), Rz: range(ROUGH.y), sp: spacing(ROUGH.y, ROUGH.len) };
  var SW = { y: WAVE.y, len: WAVE.len, Wa: meanAbs(WAVE.y), Wt: range(WAVE.y), sp: spacing(WAVE.y, WAVE.len) };
  // 縦目盛り：2 パネル共通。両方の最大の振れが収まる 5 µm きざみ
  YR = Math.ceil(Math.max(mxa(SR.y), mxa(SW.y)) * 1.2 / 5) * 5;
  function CHECK() { return { YR: YR, Ra: SR.Ra, Rz: SR.Rz, RSm: SR.sp.mean, Wt: SW.Wt, Wa: SW.Wa, WSm: SW.sp.mean, len: SR.len }; }
  // ---------- 計算ここまで ----------

  // 歯面の拡大図に、表面の凹凸 Y を法線方向に乗せる
  function surfaceView(ctx, t, S, K, probeName) {
    var g = grow(t), u = prog(t), cur = Math.round(u * (S.y.length - 1));
    var right = FL.slice(0, I_FORM), probe = null, j, n = S.y.length - 1;
    for (j = 0; j <= n; j++) {
      var fa = flankAt(j / n * S.len), dv = K * g * S.y[j] / 1000;
      right.push([fa.p[0] + fa.n[0] * dv, fa.p[1] + fa.n[1] * dv]);
      if (t >= T_SWEEP && j === cur) probe = [right[right.length - 1], fa.n];
    }
    drawTooth(ctx, right, probe, probeName);
    // 1 mm のものさし（横の細かさの目安）
    var a = tScreen(flankAt(0.5).p), b = tScreen(flankAt(1.5).p);
    var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(30, 62); ctx.lineTo(30 + len, 62); ctx.moveTo(30, 58); ctx.lineTo(30, 66); ctx.moveTo(30 + len, 58); ctx.lineTo(30 + len, 66); ctx.stroke();
    tag(ctx, '1 mm', 30 + len / 2, 50, { size: 9 });
    return cur;
  }
  // チャート：凹凸の線と、描き終わったら隣り合う山の間隔を 1 つ示す
  function surfaceChart(ctx, t, S, cur, effect) {
    chartFrame(ctx, '0', fx(S.len, 1) + ' mm', '歯面に沿って', effect, t);
    if (t < T_SWEEP) return;
    var n = S.y.length - 1;
    chartLine(ctx, S.y.map(function (_, i) { return i / n; }), S.y, cur);
    if (t < END || S.sp.xs.length < 2) return;
    // 真ん中あたりの 1 組
    var k = Math.floor((S.sp.xs.length - 1) / 2), x1 = CX0 + S.sp.xs[k] / S.len * (CX1 - CX0), x2 = CX0 + S.sp.xs[k + 1] / S.len * (CX1 - CX0);
    var yb = cy(-YR * 0.62);
    ctx.strokeStyle = T.warn; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x1, yb - 4); ctx.lineTo(x1, yb + 4); ctx.moveTo(x1, yb); ctx.lineTo(x2, yb); ctx.moveTo(x2, yb - 4); ctx.lineTo(x2, yb + 4); ctx.stroke();
    tag(ctx, '間隔 ' + fx(S.sp.xs[k + 1] - S.sp.xs[k], 2) + ' mm', (x1 + x2) / 2, yb + 11, { size: 9, color: T.warn });
  }

  PANELS.rough = function (ctx, t) {
    var K = 20;
    viewFrame(ctx, '歯1枚を拡大・右の歯面をなぞる', K);
    var cur = surfaceView(ctx, t, SR, K, '触針');
    surfaceChart(ctx, t, SR, cur, '細かいギザギザ');
    var seen = SR.y.slice(0, cur + 1), on = t >= T_SWEEP;
    numbers(ctx, [
      { label: '算術平均粗さ Ra', val: on ? meanAbs(seen) : null, d: 2 },
      { label: '最大高さ', val: on ? range(seen) : null }
    ], '想定  Ra ' + fx(RA, 1) + ' µm（歯切りのまま程度）／山の間隔 平均 ' + fx(SR.sp.mean, 2) + ' mm');
  };

  PANELS.wave = function (ctx, t) {
    var K = 20;
    viewFrame(ctx, '同じ歯面・うねりだけを乗せる', K);
    var cur = surfaceView(ctx, t, SW, K, '触針');
    surfaceChart(ctx, t, SW, cur, 'ゆるやかな波');
    var seen = SW.y.slice(0, cur + 1), on = t >= T_SWEEP;
    numbers(ctx, [
      { label: 'うねりの最大高さ Wt', val: on ? range(seen) : null },
      { label: '山の間隔（平均）', ideal: '—', val: t >= END ? SW.sp.mean : null, d: 2, unit: 'mm' }
    ], '想定  Wt ' + fx(SW.Wt, 1) + ' µm（規格の許容値は無い）');
  };

  var f1 = function (v) { return fx(v, 1); };
  LEAD = '粗さとうねりは、どちらも歯面の凹凸。違いは波長で、粗さは山の間隔が約 ' + fx(SR.sp.mean, 2) + ' mm、うねりは約 ' + fx(SW.sp.mean, 2) + ' mm。どちらも想定の値で、ずれは図で ×20 に拡大している。';
  POINTS = ['粗さもうねりも歯面の凹凸。違うのは高さではなく<em>波の間隔</em>',
    '粗さは山の間隔 約 ' + fx(SR.sp.mean, 2) + ' mm の<em>細かいギザギザ</em>、うねりは約 ' + fx(SW.sp.mean, 2) + ' mm の<em>ゆるやかな波</em>'];
  ARIA.rough = '歯面粗さ：歯面を ' + f1(SR.len) + ' mm 触針でなぞる。真値は平らな線。誤差ありは算術平均粗さ Ra ' + fx(SR.Ra, 2) + ' µm、最大高さ ' + f1(SR.Rz) + ' µm、山の間隔は平均 ' + fx(SR.sp.mean, 2) + ' mm の細かいギザギザ。';
  ARIA.wave = 'うねり：同じ歯面に、粗さより波長の長い波を乗せる。真値は平らな線。誤差ありは最大高さ ' + f1(SW.Wt) + ' µm、山の間隔は平均 ' + fx(SW.sp.mean, 2) + ' mm のゆるやかな波（想定の値）。';
