  // ---------- 計算 ----------
  // 平均線（最小二乗の直線）で、全体の誤差を「傾き」と「うねり（平均線からの残り）」に分ける
  function split(D) {
    var L = lsq(D.u, D.e), line = D.u.map(function (s) { return L[0] * s + L[1]; });
    var res = D.e.map(function (v, i) { return v - line[i]; });
    return { u: D.u, e: D.e, line: line, res: res, k: L[0], c: L[1], total: range(D.e), form: range(res), slope: L[0],
             rmax: Math.max.apply(null, res), rmin: Math.min.apply(null, res) };
  }
  var SA = split(PROF), SB = split(HELIX);
  function CHECK() { return { Fa: SA.total, ffa: SA.form, fHa: SA.slope, Fb: SB.total, ffb: SB.form, fHb: SB.slope, TOL: TOL }; }
  // ---------- 計算ここまで ----------

  // 図に乗せるずれ：mode = total（そのまま）/ form（うねりだけ）/ slope（傾きだけ）
  function devOf(S, mode) { return mode === 'form' ? S.res : mode === 'slope' ? S.line : S.e; }

  // チャート：全体の線。form では平均線と、それに平行な上下の線（幅 = ffα）。slope では平均線と両端の差（= fHα）
  function chartSplit(ctx, S, mode, cur, t) {
    var X = function (s) { return CX0 + s * (CX1 - CX0); }, i;
    if (mode === 'total') { chartLine(ctx, S.u, S.e, cur); return; }
    // 全体の線は薄く
    ctx.globalAlpha = 0.45; chartLine(ctx, S.u, S.e, cur); ctx.globalAlpha = 1;
    if (t < END) return;
    var Lf = function (s, off) { return cy(S.k * s + S.c + off); };
    ctx.strokeStyle = T.err; ctx.lineWidth = 2.4; ctx.setLineDash(mode === 'form' ? [5, 3] : []);
    ctx.beginPath(); ctx.moveTo(X(0), Lf(0, 0)); ctx.lineTo(X(1), Lf(1, 0)); ctx.stroke(); ctx.setLineDash([]);
    if (mode === 'form') {
      ctx.strokeStyle = T.warn; ctx.lineWidth = 1.4;
      [S.rmax, S.rmin].forEach(function (o) { ctx.beginPath(); ctx.moveTo(X(0), Lf(0, o)); ctx.lineTo(X(1), Lf(1, o)); ctx.stroke(); });
      var xb = X(0.5), y1 = Lf(0.5, S.rmax), y2 = Lf(0.5, S.rmin);
      ctx.beginPath(); ctx.moveTo(xb, y1); ctx.lineTo(xb, y2); ctx.stroke();
      tag(ctx, '幅 ' + fx(S.form, 1), xb + 4, (y1 + y2) / 2, { size: 10, color: T.warn, align: 'left' });
    } else {
      ctx.strokeStyle = T.warn; ctx.lineWidth = 1.4; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(X(0), Lf(0, 0)); ctx.lineTo(X(1), Lf(0, 0)); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(X(1) - 6, Lf(0, 0)); ctx.lineTo(X(1) - 6, Lf(1, 0)); ctx.stroke();
      tag(ctx, '差 ' + fx(S.slope, 1), X(1) - 10, (Lf(0, 0) + Lf(1, 0)) / 2, { size: 10, color: T.warn, align: 'right' });
    }
  }

  // ----- 歯形（歯 1 枚の拡大図） -----
  function profPanel(mode) {
    return function (ctx, t) {
      var K = 20, g = grow(t), u = prog(t), cur = Math.round(u * (SA.u.length - 1)), D = devOf(SA, mode);
      var ev = function (s) { return K * g * interp(SA.u, D, s) / 1000; };
      var right = flankWith(function (i) { return i < I_FORM ? ev(0) * i / I_FORM : ev((Lr[i] - L0) / (L1 - L0)); });
      viewFrame(ctx, mode === 'total' ? '歯1枚を拡大・右の歯面' : mode === 'form' ? '傾きを除いた形（うねりだけ）' : 'うねりを除いた形（傾きだけ）', K);
      var probe = null;
      if (t >= T_SWEEP) {
        var fa = flankAt((Math.pow(L0 + u * (L1 - L0), 2) - L0 * L0) / (2 * G.rb)), dv = ev(u);
        probe = [[fa.p[0] + fa.n[0] * dv, fa.p[1] + fa.n[1] * dv], fa.n];
      }
      drawTooth(ctx, right, probe, '測定子');
      txt(ctx, '歯先', 24, 64, { jp: true, size: 9, color: T.muted, align: 'left' });
      txt(ctx, '歯元', 24, 200, { jp: true, size: 9, color: T.muted, align: 'left' });
      chartFrame(ctx, '歯元', '歯先', '転がり長さ ' + fx(L1 - L0, 1) + ' mm',
        mode === 'total' ? '山と谷の差' : mode === 'form' ? '平均線のまわりの幅' : '平均線の傾き', t);
      if (t >= T_SWEEP) chartSplit(ctx, SA, mode, cur, t);
      var row = mode === 'total' ? { label: '全歯形誤差 Fα', val: t >= T_SWEEP ? range(SA.e.slice(0, cur + 1)) : null }
        : mode === 'form' ? { label: '歯形形状誤差 ffα', val: t >= END ? SA.form : null }
        : { label: '歯形勾配誤差 fHα', val: t >= END ? SA.slope : null };
      var tol = mode === 'total' ? 'Fα ≤ ' + fx(TOL.Fa, 1) : mode === 'form' ? 'ffα ≤ ' + fx(TOL.ffa, 1) : 'fHα ≤ ±' + fx(TOL.fHa, 1);
      numbers(ctx, [row], 'JIS ' + GRADE + '級の目安  ' + tol + ' µm');
    };
  }

  // ----- 歯すじ（ピッチ円筒を切り開いた図） -----
  function helixPanel(mode) {
    return function (ctx, t) {
      var K = 50, g = grow(t), u = prog(t), cur = Math.round(u * (SB.u.length - 1)), D = devOf(SB, mode);
      viewFrame(ctx, mode === 'total' ? 'ピッチ円筒を切り開いた図' : mode === 'form' ? '傾きを除いた形（うねりだけ）' : 'うねりを除いた形（傾きだけ）', K);
      var S = 14.5, X0 = 54, YC = 150, tb = Math.tan(BETA), pt = Math.PI * G.mt, half = pt / 4, cb = Math.cos(BETA);
      var P = function (zz, s) { return [X0 + zz * S, YC - s * S]; };
      var sc = function (zz) { return (zz - G.b / 2) * tb; };
      ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
      for (var k = -2; k <= 2; k++) {
        var off = k * pt, N = 60, top = [], bot = [], ide = [], j;
        for (j = 0; j <= N; j++) {
          var zz = G.b * j / N, dv = k === 0 ? K * g * interp(SB.u, D, j / N) / 1000 / cb : 0;
          top.push(P(zz, sc(zz) + off + half + dv)); bot.push(P(zz, sc(zz) + off - half)); ide.push(P(zz, sc(zz) + off + half));
        }
        poly(ctx, top.concat(bot.slice().reverse())); ctx.closePath();
        ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = T.err; ctx.lineWidth = 2.4; poly(ctx, top); ctx.stroke(); poly(ctx, bot); ctx.stroke();
        ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.3; poly(ctx, ide); ctx.stroke(); poly(ctx, bot); ctx.stroke();
      }
      if (t >= T_SWEEP) {
        var zc = G.b * u, dvc = K * g * interp(SB.u, D, u) / 1000 / cb, c = P(zc, sc(zc) + half + dvc + 0.16);
        ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + 8, c[1] - 40); ctx.stroke();
        ctx.beginPath(); ctx.arc(c[0], c[1], 4, 0, 2 * Math.PI); ctx.fillStyle = T.ink; ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      [0, G.b].forEach(function (zz) { ctx.beginPath(); ctx.moveTo(X0 + zz * S, 36); ctx.lineTo(X0 + zz * S, 236); ctx.stroke(); });
      ctx.setLineDash([]);
      txt(ctx, '端面', X0, 243, { jp: true, size: 9, color: T.muted });
      txt(ctx, '端面', X0 + G.b * S, 243, { jp: true, size: 9, color: T.muted });
      txt(ctx, '← 歯幅 ' + G.b + ' mm →', X0 + G.b * S / 2, 243, { jp: true, size: 9, color: T.muted });
      chartFrame(ctx, '0', G.b + ' mm', '歯幅方向',
        mode === 'total' ? '山と谷の差' : mode === 'form' ? '平均線のまわりの幅' : '平均線の傾き', t);
      if (t >= T_SWEEP) chartSplit(ctx, SB, mode, cur, t);
      var row = mode === 'total' ? { label: '全歯すじ誤差 Fβ', val: t >= T_SWEEP ? range(SB.e.slice(0, cur + 1)) : null }
        : mode === 'form' ? { label: '歯すじ形状誤差 ffβ', val: t >= END ? SB.form : null }
        : { label: '歯すじ勾配誤差 fHβ', val: t >= END ? SB.slope : null };
      var tol = mode === 'total' ? 'Fβ ≤ ' + fx(TOL.Fb, 1) : mode === 'form' ? 'ffβ ≤ ' + fx(TOL.ffb, 1) : 'fHβ ≤ ±' + fx(TOL.ffb, 1);
      numbers(ctx, [row], 'JIS ' + GRADE + '級の目安  ' + tol + ' µm');
    };
  }

  PANELS.Fa = profPanel('total'); PANELS.ffa = profPanel('form'); PANELS.fHa = profPanel('slope');
  PANELS.Fb = helixPanel('total'); PANELS.ffb = helixPanel('form'); PANELS.fHb = helixPanel('slope');

  var f1 = function (v) { return fx(v, 1); };
  LEAD = '誤差ありの歯車は、JIS ' + GRADE + '級の許容いっぱい（JIS B 1702-1:1998 の式に実寸を入れた目安）。全体の誤差を、平均線の「傾き」と、平均線のまわりの「うねり」に分けて見せる。';
  POINTS = ['歯形は歯元→歯先、歯すじは歯幅の端→端に、歯面を<em>1 本の線</em>でなぞって測る',
    '全体の誤差（Fα ' + f1(SA.total) + ' µm）＝ 平均線の<em>傾き</em> ＋ 平均線のまわりの<em>うねり</em>',
    '誤差ありは JIS ' + GRADE + ' 級の許容いっぱい'];
  ARIA.Fa = '全歯形誤差：歯面を歯元から歯先へなぞる。真値は平らな線。誤差ありは山と谷の差が ' + f1(SA.total) + ' µm。';
  ARIA.ffa = '歯形形状誤差：全体の線から傾きを除いたうねり。平均線に平行な 2 本の線ではさんだ幅が ' + f1(SA.form) + ' µm。真値は 0。';
  ARIA.fHa = '歯形勾配誤差：平均線の傾き。歯元と歯先での平均線の差が ' + f1(SA.slope) + ' µm。真値は 0。';
  ARIA.Fb = '全歯すじ誤差：歯面を歯幅方向になぞる。真値は平らな線。誤差ありは山と谷の差が ' + f1(SB.total) + ' µm。';
  ARIA.ffb = '歯すじ形状誤差：傾きを除いたうねりの幅が ' + f1(SB.form) + ' µm。真値は 0。';
  ARIA.fHb = '歯すじ勾配誤差：歯幅の両端での平均線の差が ' + f1(SB.slope) + ' µm。真値は 0。';
