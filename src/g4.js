  // ---------- 計算 ----------
  function inv(a) { return Math.tan(a) - a; }
  // 歯直角歯厚（基準円上）：sn = mn (π/2 + 2 x tanαn)。この歯車は転位なし（x = 0）
  var X_SHIFT = 0;
  var SN = G.mn * (Math.PI / 2 + 2 * X_SHIFT * Math.tan(AN));
  // 誤差あり：歯厚を 80 µm 薄くした歯車を想定（両側の歯面から 40 µm ずつ）。歯ごとに ±5 µm のばらつき（シード固定）
  var DSN = -80;
  var DS = (function () { var r = rng(21), a = []; for (var k = 0; k < G.z; k++) a.push(DSN + 5 * (r() * 2 - 1)); return a; })();
  var DS_MEAN = DS.reduce(function (a, b) { return a + b; }, 0) / G.z;

  // またぎ歯厚（はすば歯車）：
  //   相当歯数 z' = z · invαt / invαn、またぐ歯数 k = round(z' · αn/π + 0.5)
  //   Wk = mn cosαn [ π (k − 0.5) + z invαt ] + 2 x mn sinαn
  //   測れる条件：Wk sinβb < b（βb = 基礎円筒ねじれ角、tanβb = tanβ cosαt）
  //   誤差：ΔWk = Δsn · cosαn（またぐ両端の歯の、外側の歯面のずれの平均）
  var ZEQ = G.z * inv(AT) / inv(AN);
  var KSPAN = Math.round(ZEQ * AN / Math.PI + 0.5);
  var WK = G.mn * Math.cos(AN) * (Math.PI * (KSPAN - 0.5) + G.z * inv(AT)) + 2 * X_SHIFT * G.mn * Math.sin(AN);
  var BETAB = Math.atan(Math.tan(BETA) * Math.cos(AT));
  // 確かめ：正面の基礎円の接線に沿った長さ (k−1)·pbt + sbt を cosβb 倍すると Wk になるはず
  var PBT = Math.PI * G.mt * Math.cos(AT);
  var SBT = G.rb * (Math.PI / G.z + 2 * inv(AT));            // 正面の基礎円上の歯厚（x = 0）
  var WT = (KSPAN - 1) * PBT + SBT;                          // 正面でのまたぎ長さ
  var DWK = DS.map(function (_, i) { return Math.cos(AN) * (DS[i] + DS[(i + KSPAN - 1) % G.z]) / 2; });
  var DWK_MEAN = DWK.reduce(function (a, b) { return a + b; }, 0) / G.z;

  // バックラッシ：真値の相手歯車（同じ諸元、ねじれは逆）と標準中心距離 a = 2·rp でかみ合わせる。
  //   設計のバックラッシは 0（真値どうしならすき間なし）。誤差ありの歯車の歯厚の減り = すき間。
  //   円周方向（正面、基準円上）jt = |Δsn| / cosβ、歯面に垂直 jn = jt · cosαt · cosβb（= |Δsn| cosαn）
  var CDIST = 2 * G.rp;
  var JT = DS.map(function (d) { return Math.abs(d) / Math.cos(BETA); });
  var JN = JT.map(function (j) { return j * Math.cos(AT) * Math.cos(BETAB); });
  // かみ合いのプログラム（_mesh.js：線と線の交点から歯が重ならない位置を求める）でも求める。
  // 歯 k の片側の歯面を、正面の法線方向に (|Δsn_k| / 2cosβ)·cosαt だけ内側へ動かした歯車を作り、
  // 歯 k がかみ合いの真ん中に来た角度で、相手を両側の歯面が当たるまで回して、その角度の差を基準円上の長さにする
  var THIN = DS.map(function (d) { return -d / (2 * Math.cos(BETA)) * Math.cos(AT); });   // [µm]、正で薄い
  var JT_FORMULA = JT.slice();
  var WORK1 = makeGear({ K: 1, thin: THIN }), MASTER4 = makeGear({});
  JT = DS.map(function (_, k) {
    var th = -MP * k, p = { c: [0, 0], th: th }, pn = phiNominal(th);
    return (contactAngle(WORK1, p, MASTER4, [CDIST, 0], pn, 'L') - contactAngle(WORK1, p, MASTER4, [CDIST, 0], pn, 'R')) * G.rp * 1000;
  });
  JN = JT.map(function (j) { return j * Math.cos(AT) * Math.cos(BETAB); });
  var JT_MEAN = JT.reduce(function (a, b) { return a + b; }, 0) / G.z, JN_MEAN = JN.reduce(function (a, b) { return a + b; }, 0) / G.z;

  // チャートの縦：3 つのパネルで共通。いちばん大きい値の 1.25 倍を 20 µm 単位で切り上げ
  function absMax(a) { return a.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0); }
  var YR4 = Math.ceil(Math.max(absMax(DS), absMax(DWK), absMax(JT)) * 1.25 / 20) * 20;
  function CHECK() {
    return { SN: SN, DS_MEAN: DS_MEAN, DS_range: [Math.min.apply(null, DS), Math.max.apply(null, DS)], ZEQ: ZEQ, K: KSPAN, WK: WK,
             WT_cosbb: WT * Math.cos(BETAB), WK_sinbb: WK * Math.sin(BETAB), b: G.b, DWK_MEAN: DWK_MEAN,
             JT_MEAN: JT_MEAN, JT_maxdiff_vs_formula: Math.max.apply(null, JT.map(function (v, k) { return Math.abs(v - JT_FORMULA[k]); })), JN_MEAN: JN_MEAN, JN_check: Math.abs(DS_MEAN) * Math.cos(AN), CDIST: CDIST, YR: YR4 };
  }
  // ---------- 計算ここまで ----------

  YR = YR4;

  // ---------- 両側の歯面を動かした歯（共通部品は右の歯面だけなので、ここで作る） ----------
  // d [mm]：歯面を外向きの法線方向に動かす量（負で薄くなる）。左の歯面は右の鏡写し
  function toothBoth(d) {
    var R = flankWith(function () { return d; }), out = R.slice(), i, n = R.length;
    var thR = Math.atan2(R[n - 1][1], R[n - 1][0]);
    for (i = 1; i < 8; i++) { var a = thR * (1 - 2 * i / 8); out.push([G.ra * Math.cos(a), G.ra * Math.sin(a)]); }
    for (i = n - 1; i >= 0; i--) out.push([R[i][0], -R[i][1]]);
    var p0 = [R[0][0], -R[0][1]], p1 = rot(R[0], 2 * Math.PI / G.z);
    var a0 = Math.atan2(p0[1], p0[0]), a1 = Math.atan2(p1[1], p1[0]), rr0 = Math.hypot(p0[0], p0[1]);
    for (i = 1; i < 6; i++) { var a2 = a0 + (a1 - a0) * i / 6; out.push([rr0 * Math.cos(a2), rr0 * Math.sin(a2)]); }
    return out;
  }
  function gearBoth(d, rotA, cx, cyy) {
    var T1 = toothBoth(d), out = [];
    for (var k = 0; k < G.z; k++) {
      var a = rotA + 2 * Math.PI * k / G.z;
      T1.forEach(function (p) { var q = rot(p, a); out.push([q[0] + (cx || 0), q[1] + (cyy || 0)]); });
    }
    return out;
  }
  function fillStroke(ctx, pts, fill, falpha, stroke, lw, dash) {
    poly(ctx, pts); ctx.closePath();
    if (fill) { ctx.globalAlpha = falpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }
  // 歯ごとの棒グラフ（n 本目まで）
  function chartBars(ctx, vals, n) {
    var X = function (k) { return CX0 + 8 + k / (vals.length - 1) * (CX1 - CX0 - 16); };
    for (var k = 0; k < n; k++) {
      var y0 = cy(0), y1 = cy(vals[k]);
      ctx.globalAlpha = 0.3; ctx.fillStyle = T.warn; ctx.fillRect(X(k) - 4, Math.min(y0, y1), 8, Math.abs(y1 - y0)); ctx.globalAlpha = 1;
      ctx.strokeStyle = T.err; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(X(k) - 4, y1); ctx.lineTo(X(k) + 4, y1); ctx.stroke();
    }
    ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(CX0, cy(0)); ctx.lineTo(CX1, cy(0)); ctx.stroke();
  }
  function measured(t) { if (t < T_SWEEP) return 0; if (t >= END) return G.z; return Math.min(G.z, Math.floor(prog(t) * G.z) + 1); }
  function mean(a, n) { var s = 0; for (var i = 0; i < n; i++) s += a[i]; return s / n; }

  // ----- 1. 歯厚の誤差：歯 1 枚の拡大 -----
  // ×20 だと歯先で両側の歯面が交わってしまう（歯先の歯厚 1.6 mm に対して減りが 2 × 0.8 mm）ので ×10 にする
  PANELS.sn = function (ctx, t) {
    var K = 10, g = grow(t), n = measured(t), k0 = Math.max(0, n - 1);
    var d = K * g * (n ? DS[k0] : DSN) / 2 / 1000;        // 片側の歯面の動き [mm]（負 = 内側）
    viewFrame(ctx, '歯1枚を拡大・両側の歯面が内側へ', K);
    ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
    [-1, 0, 1].forEach(function (k) {
      var a = 2 * Math.PI * k / G.z;
      var act = toothBoth(d).map(function (p) { return tScreen(rot(p, a)); });
      var ide = TOOTH0.map(function (p) { return tScreen(rot(p, a)); });
      poly(ctx, act); ctx.lineTo(act[act.length - 1][0], 260); ctx.lineTo(act[0][0], 260);
      ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fill(); ctx.globalAlpha = 1;
      poly(ctx, act); ctx.strokeStyle = T.err; ctx.lineWidth = 2.4; ctx.stroke();
      poly(ctx, ide); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.3; ctx.stroke();
    });
    // 基準円（破線）と、その上の歯厚の寸法線
    ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath();
    for (var j = 0; j <= 40; j++) { var aa = -0.35 + 0.7 * j / 40, q = tScreen([G.rp * Math.cos(aa), G.rp * Math.sin(aa)]); if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.stroke(); ctx.setLineDash([]);
    var yI = interp(RS, FLY, G.rp), nY = interp(RS, FNY, G.rp), nX = interp(RS, FNX, G.rp), xI = interp(RS, FLX, G.rp);
    var pR = tScreen([xI + nX * d, yI + nY * d]), pL = tScreen([xI + nX * d, -(yI + nY * d)]);
    var iR = tScreen([xI, yI]), iL = tScreen([xI, -yI]);
    ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(iL[0], iL[1] - 14); ctx.lineTo(iR[0], iR[1] - 14); ctx.stroke();
    txt(ctx, '真値の歯厚', (iL[0] + iR[0]) / 2, iL[1] - 22, { jp: true, size: 9, color: T.ideal });
    ctx.strokeStyle = T.err; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pL[0], pL[1] + 12); ctx.lineTo(pR[0], pR[1] + 12); ctx.stroke();
    [pL, pR].forEach(function (p) { ctx.beginPath(); ctx.moveTo(p[0], p[1] + 7); ctx.lineTo(p[0], p[1] + 17); ctx.stroke(); });
    tag(ctx, '誤差あり', (pL[0] + pR[0]) / 2, pL[1] + 24, { size: 9, color: T.err });
    ctx.restore();
    txt(ctx, '基準円', 300, tScreen([G.rp, 0])[1] - 4, { jp: true, size: 9, color: T.muted, align: 'right' });
    chartFrame(ctx, '歯 1', '歯 ' + G.z, '歯ごとの歯厚のずれ', '全部の歯が薄い', t);
    chartBars(ctx, DS, n);
    numbers(ctx, [
      { label: '歯厚 sn [mm]', ideal: fx(SN, 3), val: n ? fx(SN + mean(DS, n) / 1000, 3) + ' mm' : null },
      { label: 'ずれ Δsn', val: n ? mean(DS, n) : null }
    ], '想定  Δsn = ' + DSN + ' µm（両側 40 µm ずつ、歯ごとに ±5 µm）');
  };

  // ----- 2. またぎ歯厚：k 枚の歯をノギスのあごではさむ（正面の断面） -----
  PANELS.wk = function (ctx, t) {
    var K = 20, g = grow(t), n = measured(t), S2 = 10.5, YB = 178;
    var dS = K * g * DSN / 2 / 1000;                           // 片側の歯面の動き（図の上）
    var rotA = Math.PI / 2 - 2 * Math.PI * (KSPAN - 1) / 2 / G.z;
    var scr = function (p) { return [170 + p[0] * S2, YB - (p[1] - G.rb) * S2]; };
    viewFrame(ctx, '正面の断面・' + KSPAN + '枚をまたいで測る', K);
    ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
    fillStroke(ctx, gearBoth(dS, rotA).map(scr), T.err, 0.16, T.err, 2.2);
    fillStroke(ctx, gearBoth(0, rotA).map(scr), null, 0, T.ideal, 1.2);
    // あご：基礎円の接線（y = rb）の上で、外側の歯面に当たる。正面では幅 = Wk / cosβb
    var close = ease((t - T_SWEEP) / 1.0), open = 2.5 * (1 - close);
    var halfI = WT / 2, halfA = WT / 2 + K * g * DWK_MEAN / Math.cos(BETAB) / 2 / 1000;
    [-1, 1].forEach(function (s) {
      var xi = scr([s * halfI, G.rb]), xa = scr([s * (halfA + open), G.rb]);
      ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(xi[0], 44); ctx.lineTo(xi[0], YB + 26); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.85; ctx.fillStyle = T.ink; ctx.fillRect(s > 0 ? xa[0] : xa[0] - 8, 44, 8, YB + 26 - 44); ctx.globalAlpha = 1;
    });
    var l = scr([-(halfA + open), G.rb]), r = scr([halfA + open, G.rb]);
    ctx.fillStyle = T.ink; ctx.fillRect(l[0] - 8, 40, r[0] - l[0] + 16, 6);
    ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(l[0], YB); ctx.lineTo(r[0], YB); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    tag(ctx, 'Wk（' + KSPAN + '枚をまたぐ）', 170, 58, { size: 10, color: T.ink });
    tag(ctx, '基礎円の接線', 170, YB + 12, { size: 9, color: T.muted });
    chartFrame(ctx, '位置 1', '位置 ' + G.z, '測る位置ごとのずれ', '測る値が小さくなる', t);
    chartBars(ctx, DWK, n);
    numbers(ctx, [
      { label: 'またぎ歯厚 Wk [mm]', ideal: fx(WK, 3), val: n ? fx(WK + mean(DWK, n) / 1000, 3) + ' mm' : null },
      { label: 'ずれ ΔWk', val: n ? mean(DWK, n) : null }
    ], 'k = ' + KSPAN + ' 枚をまたぐ　ΔWk = Δsn × cosαn');
  };

  // ----- 3. バックラッシ：真値の相手歯車とかみ合わせた部分の拡大（正面） -----
  // 歯の位置はかみ合いのプログラムで決める。この歯車を回し、歯 1 枚ごとに「押す向き」を前→後ろと切り替える。
  // 前に押すと前側の歯面が当たり、後ろに押すと後ろ側の歯面が当たる。相手はすき間（がた）の分だけ動く
  var KB4 = 10, WORKV = makeGear({ K: KB4, thin: THIN });
  PANELS.bl = function (ctx, t) {
    var g = grow(t), n = measured(t), u = prog(t), S3 = 20;
    var W = g < 1 ? makeGear({ K: KB4 * g, thin: THIN }) : WORKV;
    var pos = t >= T_SWEEP ? (t >= END ? G.z - 0.5 : u * G.z - 0.5) : -0.5;   // 歯 k が真ん中に来るのは pos = k
    var th = -MP * (pos + 0.5), p = { c: [0, 0], th: th }, pn = phiNominal(th);
    var phL = contactAngle(W, p, MASTER4, [CDIST, 0], pn, 'L'), phR = contactAngle(W, p, MASTER4, [CDIST, 0], pn, 'R');
    var f = pos - Math.floor(pos), s = ease((f - 0.35) / 0.3);          // 歯ごとに、前に押す → 後ろに押す
    if (t < T_SWEEP || t >= END) s = 0;
    var ph = phL + (phR - phL) * s;
    // 正面図：この歯車が下、相手が上（画面の上下 = 中心を結ぶ向き）
    var scr = function (q) { return [170 - q[1] * S3, 140 - (q[0] - G.rp) * S3]; };
    viewFrame(ctx, 'かみ合い部を拡大・相手は真値の歯車', KB4);
    ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
    fillStroke(ctx, gearOutline(MASTER4, { c: [CDIST, 0], th: ph }).map(scr), T.muted, 0.18, T.muted, 1.6);
    fillStroke(ctx, gearOutline(W, p).map(scr), T.err, 0.16, T.err, 2.2);
    fillStroke(ctx, gearOutline(MASTER4, { c: [0, 0], th: th }).map(scr), null, 0, T.ideal, 1.2, [3, 3]);
    ctx.restore();
    txt(ctx, '相手（真値）', 24, 48, { jp: true, size: 9, color: T.muted, align: 'left' });
    txt(ctx, 'この歯車', 24, 236, { jp: true, size: 9, color: T.err, align: 'left' });
    tag(ctx, '緑の点線＝真値の歯厚', 316, 236, { size: 9, color: T.muted, align: 'right' });
    if (t >= T_SWEEP && t < END) tag(ctx, s < 0.5 ? '前に押す →' : '← 後ろに押す', 170, 222, { size: 10, color: T.err });
    chartFrame(ctx, '歯 1', '歯 ' + G.z, 'かみ合う歯ごとのすき間', 'がたが出る', t);
    chartBars(ctx, JT, n);
    numbers(ctx, [
      { label: '円周方向 jt', val: n ? mean(JT, n) : null },
      { label: '歯面に垂直 jn', val: n ? mean(JN, n) : null }
    ], '設計のすき間 0　中心距離 a = ' + fx(CDIST, 3) + ' mm');
  };

  var f1 = function (v) { return fx(v, 1); };
  LEAD = '誤差ありは、歯厚を ' + Math.abs(DSN) + ' µm 薄く削った歯車を想定。バックラッシは、歯の輪郭の線と線の交点から「歯が重ならずに当たる位置」を求めるプログラムで計算した（絵の歯車も同じ計算。隣の歯が厚いと、その歯先が先に当たってすき間が少し狭くなる）。';
  POINTS = ['歯を ' + Math.abs(DSN) + ' µm 薄く削ると、工場で測る<em>またぎ歯厚が小さく</em>なる（' + f1(Math.abs(DWK_MEAN)) + ' µm 小さい）',
    'かみ合わせると、<em>すき間（がた）</em>が出る（バックラッシ ' + f1(JT_MEAN) + ' µm）'];
  ARIA.sn = '歯厚の誤差：基準円上の歯直角歯厚は真値 ' + fx(SN, 3) + ' mm。誤差ありは平均 ' + f1(DS_MEAN) + ' µm 薄く、24 枚の歯すべてで −' + f1(Math.abs(Math.max.apply(null, DS))) + '〜−' + f1(Math.abs(Math.min.apply(null, DS))) + ' µm。';
  ARIA.wk = 'またぎ歯厚：' + KSPAN + ' 枚の歯をノギスではさむ。真値 ' + fx(WK, 3) + ' mm に対し、誤差ありは平均 ' + f1(DWK_MEAN) + ' µm 小さい（歯厚のずれ × cosαn）。';
  ARIA.bl = 'バックラッシ：真値の相手歯車と標準中心距離 ' + fx(CDIST, 3) + ' mm でかみ合わせる。真値どうしならすき間 0。誤差ありは円周方向に ' + f1(JT_MEAN) + ' µm、歯面に垂直に ' + f1(JN_MEAN) + ' µm のすき間（がた）ができる。';
