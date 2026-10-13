  // ---------- 計算 ----------
  // 誤差ありの歯車（歯形誤差 PROF を全歯・両歯面に同じだけ、累積ピッチ誤差 PITCH.F、偏心 RUN.e を同時に持つ）を、
  // 同じ諸元の真値のマスタ歯車とかみ合わせて回す。歯の位置は _mesh.js（線と線の交点から、歯が重ならない
  // 位置を求めるプログラム）で決める：
  //   片歯面：マスタを回して、駆動側の歯面が最初に当たる角度 → 設計どおりの角度との差が伝達誤差
  //   両歯面：中心距離を縮めていき、両側の歯面が同時に当たる中心距離 → その変化
  // 簡略化：正面断面（平歯車と同じ）のモデル。はすば歯車の重なりかみ合い（歯幅方向に歯形のずれが平均される効果）と、
  // 歯のたわみは扱わない。
  var A0 = 2 * G.rp;                                          // 設計の中心距離
  var PBT = 2 * Math.PI * G.rb / G.z;
  var LA = Math.sqrt(G.ra * G.ra - G.rb * G.rb);
  var EPS_A = (2 * LA - A0 * Math.sin(AT)) / PBT;             // 正面かみ合い率（同じ歯車どうし）
  function lin5(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    var lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    return ys[lo] + (x - xs[lo]) / (xs[hi] - xs[lo]) * (ys[hi] - ys[lo]);
  }
  var profFn = function (s) { return lin5(PROF.u, PROF.e, s); };
  function workGear(K) { return makeGear({ K: K, prof: profFn, pitch: PITCH.F }); }
  var MASTER = makeGear({});
  function workPose(th, K) { var e = K * RUN.e / 1000; return { c: [e * Math.cos(th), e * Math.sin(th)], th: th }; }
  // 1 回転ぶんを計算：両歯面（ばねで押し付けた中心距離）と片歯面（伝達誤差）
  function solveRev(K, N) {
    var W = workGear(K), aD = [], i, a = A0, th;
    for (i = 0; i <= N; i++) { th = 2 * Math.PI * i / N; a = tightCenter(W, workPose(th, K), MASTER, th, a); aD.push(a); }
    // 片歯面は、反対側の歯面がどこでも当たらない中心距離で回す（両歯面の最大 ＋ 0.5 µm）
    var aS = Math.max.apply(null, aD) + 0.0005, te = [];
    for (i = 0; i <= N; i++) {
      th = 2 * Math.PI * i / N;
      te.push((contactAngle(W, workPose(th, K), MASTER, [aS, 0], phiNominal(th), 'L') - phiNominal(th)) * G.rb * 1000);
    }
    return { aD: aD, aS: aS, te: te };
  }
  var NS = G.z * 16;                                          // 1 回転を 384 点で（1 歯 16 点）
  var REAL = solveRev(1, NS);
  var MESH = (function () {
    var u = [], i;
    for (i = 0; i <= NS; i++) u.push(i / NS);
    var da = REAL.aD.map(function (a) { return (a - A0) * 1000; }), te = REAL.te.slice();
    var mt = te.reduce(function (p, q) { return p + q; }, 0) / te.length, md = da.reduce(function (p, q) { return p + q; }, 0) / da.length;
    te = te.map(function (v) { return v - mt; });   // 片歯面は変化だけを見る（平均を 0 に）。両歯面は設計の中心距離からのずれのまま
    function perPitch(y) {
      var best = 0, at = 0, n = NS / G.z;
      for (var j = 0; j < G.z; j++) { var r = range(y.slice(j * n, j * n + n + 1)); if (r > best) { best = r; at = j; } }
      return { v: best, at: at };
    }
    function harm1(y) {
      var c = 0, s = 0; for (var i = 0; i < NS; i++) { var a = 2 * Math.PI * i / NS; c += y[i] * Math.cos(a); s += y[i] * Math.sin(a); }
      return 2 * Math.hypot(c, s) / NS;
    }
    var fT = perPitch(te), fD = perPitch(da);
    return { u: u, te: te, da: da, daMean: md, aS: REAL.aS, Fi1: range(te), fi1: fT.v, fi1At: fT.at, Fi2: range(da), fi2: fD.v, fi2At: fD.at,
             h1te: harm1(te), h1da: harm1(da) };
  })();
  // 目安：ISO 1328-1:1995 附属書（片歯面）と ISO 1328-2:1997（両歯面）の 5 級の式を 10 級に換算。
  var EPS_B = G.b * Math.sin(BETA) / (Math.PI * G.mn), EPS_G = EPS_A + EPS_B;
  var KF = EPS_G < 4 ? 0.2 * (EPS_G + 4) / EPS_G : 0.4;
  var TOL5 = {
    fi1: KF * (9 + 0.3 * G.mn + 3.2 * sm + 0.34 * sd) * QF,
    Fi2: (3.2 * G.mn + 1.01 * sd + 6.4) * QF,
    fi2: (2.96 * G.mn + 0.01 * sd + 0.8) * QF
  };
  TOL5.Fi1 = TOL.Fp + TOL5.fi1;
  YR = Math.ceil(Math.max(Math.max.apply(null, MESH.te.map(Math.abs)), Math.max.apply(null, MESH.da.map(Math.abs))) / 20) * 20;
  function CHECK() {
    // 確かめ：真値どうし（マスタとマスタ）なら、片歯面も両歯面も 0 になるはず
    var ideal = { te: [], da: [] };
    for (var i = 0; i < 24; i++) {
      var th = 2 * Math.PI * i / 96, p = { c: [0, 0], th: th };
      ideal.da.push((tightCenter(MASTER, p, MASTER, th, A0) - A0) * 1000);
      ideal.te.push((contactAngle(MASTER, p, MASTER, [A0, 0], phiNominal(th), 'L') - phiNominal(th)) * G.rb * 1000);
    }
    return { epsA: EPS_A, Fi1: MESH.Fi1, fi1: MESH.fi1, Fi2: MESH.Fi2, fi2: MESH.fi2, daMean: MESH.daMean, aS_um: (MESH.aS - A0) * 1000,
             harm1_te: MESH.h1te, harm1_da: MESH.h1da, e: RUN.e, YR: YR, TOL5: TOL5,
             ideal_te_range: range(ideal.te), ideal_da_maxabs: Math.max.apply(null, ideal.da.map(Math.abs)) };
  }
  // ---------- 計算ここまで ----------

  // ---------- 描画：かみ合い部分を拡大 ----------
  // 絵のずれは ×KV。絵の歯車も同じプログラムで位置を決めるので、歯は重ならない
  var KV = 8, VS = 7.2, VX = 170, VY = 132;
  var VIS = solveRev(KV, G.z * 6);                           // 絵の中心距離の目安（片歯面で反対側が当たらない距離）
  function vscr(p, a) { return [VX + (p[0] - (a - A0 / 2)) * VS, VY - p[1] * VS]; }   // マスタの中心を画面に固定
  function drawOut(ctx, pts, a, col, alpha, lw, dash) {
    var s = pts.map(function (p) { return vscr(p, a); });
    poly(ctx, s); ctx.closePath();
    if (alpha) { ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.setLineDash(dash || []); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]);
  }
  function idxAt(u) { return Math.min(NS, Math.max(0, Math.round(u * NS))); }
  // チャート：誤差の線と、1 ピッチごとの目盛り。描き終わったら 1 歯ぶんの区間を示す
  function chartMesh(ctx, y, cur, fiv, fiAt, label, t) {
    var X = function (s) { return CX0 + s * (CX1 - CX0); }, j;
    ctx.strokeStyle = T.line; ctx.lineWidth = 1;
    for (j = 1; j < G.z; j++) { ctx.beginPath(); ctx.moveTo(X(j / G.z), CY1 - 3); ctx.lineTo(X(j / G.z), CY1); ctx.stroke(); }
    if (t >= T_SWEEP) chartLine(ctx, MESH.u, y, cur);
    if (t >= END) {
      var x0 = X(fiAt / G.z), x1 = X((fiAt + 1) / G.z);
      var yt = CY0 + 16;                                          // 上の説明文にかからないよう少し下から
      ctx.globalAlpha = 0.18; ctx.fillStyle = T.warn; ctx.fillRect(x0, yt, x1 - x0, CY1 - yt); ctx.globalAlpha = 1;
      ctx.strokeStyle = T.warn; ctx.lineWidth = 1.2; ctx.strokeRect(x0, yt, x1 - x0, CY1 - yt);
      var right = x1 < CX1 - 70;                                   // 右に余白が無ければ左に書く
      tag(ctx, label + ' ' + fx(fiv, 1), right ? x1 + 3 : x0 - 3, CY1 - 10, { size: 10, color: T.warn, align: right ? 'left' : 'right' });
    }
  }


  // 1. 片歯面かみ合い誤差（伝達誤差）
  PANELS.single = function (ctx, t) {
    var g = grow(t), K = KV * g, u = prog(t), th = 2 * Math.PI * u, i = idxAt(u), cur = t >= T_SWEEP ? i : 0;
    viewFrame(ctx, 'かみ合い部を拡大・左が測る歯車', KV);
    var W = workGear(K), pA = workPose(th, K), aS = A0 + g * (VIS.aS - A0) + 0.0005;
    var pn = phiNominal(th), ph = contactAngle(W, pA, MASTER, [aS, 0], pn, 'L');
    ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
    drawOut(ctx, gearOutline(MASTER, { c: [aS, 0], th: ph }), aS, T.ideal, 0.16, 1.8);
    drawOut(ctx, gearOutline(MASTER, { c: [aS, 0], th: pn }), aS, T.ideal, 0, 1.1, [3, 3]);
    drawOut(ctx, gearOutline(W, pA), aS, T.err, 0.16, 2);
    ctx.restore();
    txt(ctx, '測る歯車（誤差あり）', 22, 44, { jp: true, size: 9, color: T.err, align: 'left' });
    txt(ctx, 'マスタ（真値）', 318, 44, { jp: true, size: 9, color: T.ideal, align: 'right' });
    tag(ctx, '緑の点線＝マスタの設計どおりの位置', 170, 232, { size: 9, color: T.muted });
    tag(ctx, '回転のずれ（実寸）' + fx(t >= T_SWEEP ? MESH.te[i] : 0, 1) + ' µm', 170, 214, { size: 10, color: T.err });
    chartFrame(ctx, '0', '1 回転', '歯車の回転（目盛り＝1 歯）', '1回転の波＋歯ごとの波', t);
    chartMesh(ctx, MESH.te, cur, MESH.fi1, MESH.fi1At, "fi′", t);
    numbers(ctx, [
      { label: "全体 Fi′（1回転）", val: t >= T_SWEEP ? range(MESH.te.slice(0, cur + 1)) : null },
      { label: "1歯ぶん fi′", val: t >= END ? MESH.fi1 : null }
    ], 'JIS ' + GRADE + "級の目安  Fi′ ≤ " + fx(TOL5.Fi1, 1) + "  fi′ ≤ " + fx(TOL5.fi1, 1) + ' µm');
  };

  // 2. 両歯面かみ合い誤差（中心距離の変化）
  PANELS.double = function (ctx, t) {
    var g = grow(t), K = KV * g, u = prog(t), th = 2 * Math.PI * u, i = idxAt(u), cur = t >= T_SWEEP ? i : 0;
    viewFrame(ctx, 'かみ合い部を拡大・左をばねで押し付ける', KV);
    var W = workGear(K), pA = workPose(th, K);
    var a = tightCenter(W, pA, MASTER, th, A0), ph = contactAngle(W, pA, MASTER, [a, 0], phiNominal(th), 'L');
    ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
    drawOut(ctx, gearOutline(MASTER, { c: [a, 0], th: ph }), a, T.ideal, 0.16, 1.8);
    drawOut(ctx, gearOutline(W, pA), a, T.err, 0.16, 2);
    // 設計どおりの中心距離なら、測る歯車の基準円はここ（緑の点線）
    ctx.setLineDash([3, 3]); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.1;
    var c0 = vscr([a - A0, 0], a); ctx.beginPath(); ctx.arc(c0[0], c0[1], G.rp * VS, -0.5, 0.5); ctx.stroke(); ctx.setLineDash([]);
    var c1 = vscr(pA.c, a); ctx.strokeStyle = T.err; ctx.beginPath(); ctx.arc(c1[0], c1[1], G.rp * VS, -0.5, 0.5); ctx.stroke();
    ctx.restore();
    // 中心距離のゲージ（下）：設計どおりの位置からのずれ ×KV
    var gy = 222, x0 = 170, dx = -(a - A0) * VS;
    ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(60, gy); ctx.lineTo(280, gy); ctx.stroke();
    ctx.fillStyle = T.ideal; ctx.beginPath(); ctx.moveTo(x0, gy - 2); ctx.lineTo(x0 - 5, gy - 10); ctx.lineTo(x0 + 5, gy - 10); ctx.fill();
    ctx.fillStyle = T.err; ctx.beginPath(); ctx.moveTo(x0 + dx, gy + 2); ctx.lineTo(x0 + dx - 5, gy + 10); ctx.lineTo(x0 + dx + 5, gy + 10); ctx.fill();
    txt(ctx, '← 押すばね', 22, gy, { jp: true, size: 9, color: T.muted, align: 'left' });
    var dR = t >= T_SWEEP ? MESH.da[i] : 0;
    tag(ctx, '中心距離（実寸）' + (dR >= 0 ? '+' : '') + fx(dR, 1) + ' µm', 316, gy - 14, { size: 9, color: T.err, align: 'right' });
    txt(ctx, '測る歯車（誤差あり）', 22, 44, { jp: true, size: 9, color: T.err, align: 'left' });
    txt(ctx, 'マスタ（真値・固定）', 318, 44, { jp: true, size: 9, color: T.ideal, align: 'right' });
    CHART_TITLE = '設計の中心距離からのずれ（µm）';
    chartFrame(ctx, '0', '1 回転', '歯車の回転（目盛り＝1 歯）', '1回転の波＋歯ごとの波', t);
    CHART_TITLE = '測定チャート（µm、実寸）';
    chartMesh(ctx, MESH.da, cur, MESH.fi2, MESH.fi2At, "fi″", t);
    numbers(ctx, [
      { label: "全体 Fi″（1回転）", val: t >= T_SWEEP ? range(MESH.da.slice(0, cur + 1)) : null },
      { label: "1歯ぶん fi″", val: t >= END ? MESH.fi2 : null }
    ], 'JIS ' + GRADE + "級の目安  Fi″ ≤ " + fx(TOL5.Fi2, 1) + "  fi″ ≤ " + fx(TOL5.fi2, 1) + ' µm');
  };

  var f1 = function (v) { return fx(v, 1); };
  LEAD = '誤差ありの歯車には、歯形誤差（全歯・両歯面に同じ）と、累積ピッチ誤差・偏心（' + f1(RUN.e) + ' µm）を同時に持たせ、真値のマスタ歯車とかみ合わせた。' +
    '歯の位置は、歯の輪郭の線と線の交点から「重ならずに当たる位置」を求めるプログラムで決めている（絵の歯車も同じ計算）。' +
    '片歯面は反対側の歯面が当たらないよう、中心距離を ' + f1((MESH.aS - A0) * 1000) + ' µm 広げて回す。' +
    '簡略化：正面断面（平歯車と同じ）のモデルで、はすば歯車の重なりかみ合いと歯のたわみは扱っていない。そのため歯ごとの波（fi′・fi″）は実際より大きめに出る。片歯面のチャートは平均を 0 にそろえ、両歯面のチャートは設計の中心距離からのずれ（平均 ' + f1(MESH.daMean) + ' µm 広い）を描いた。';
  POINTS = ['歯形・ピッチ・偏心の誤差が、かみ合わせると<em>まとめて 1 本の線</em>に出る',
    '大きな<em>1 回転の波</em>は偏心から、<em>細かい波</em>は歯 1 枚ごとの誤差から',
    '片歯面は回転のずれ（Fi′ ' + f1(MESH.Fi1) + ' µm）、両歯面は中心距離の変化（Fi″ ' + f1(MESH.Fi2) + ' µm）で測る'];
  ARIA.single = '片歯面かみ合い誤差：片側の歯面だけを当ててマスタと回し、マスタの回転のおくれ・すすみを作用線方向の µm で測る。真値どうしなら 0。誤差ありは 1 回転の山と谷の差 Fi′ が ' + f1(MESH.Fi1) + ' µm、1 歯ぶんの最大 fi′ が ' + f1(MESH.fi1) + ' µm。1 回転 1 周期の成分の振幅は ' + f1(MESH.h1te) + ' µm。';
  ARIA.double = '両歯面かみ合い誤差：ばねで押し付け、両側の歯面が同時に当たる中心距離を測る。真値どうしなら変化なし。誤差ありは Fi″ が ' + f1(MESH.Fi2) + ' µm、1 歯ぶんの最大 fi″ が ' + f1(MESH.fi2) + ' µm。';
