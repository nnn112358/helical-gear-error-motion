  // ---------- 計算 ----------
  var PA = 2 * Math.PI / G.z;                       // 歯 1 枚ぶんの角度
  // 隣り合う歯の間隔 j（歯 j+1 → 歯 j+2、最後は 歯 z → 歯 1）の単一ピッチ誤差
  var FPT = []; for (var jj = 0; jj < G.z; jj++) FPT.push(PITCH.fpt[(jj + 1) % G.z]);
  // 法線ピッチ誤差：歯形が理想（インボリュートどおり）なら、歯の位置のずれは作用線の向きに cos αt 倍で現れる
  // → fpb_j = fpt_j × cos αt と仮定する（歯形誤差・圧力角誤差による法線ピッチのずれは入れていない）
  var FPB = FPT.map(function (v) { return v * Math.cos(AT); });
  var PB = Math.PI * G.mt * Math.cos(AT);           // 法線ピッチ（真値）[mm]

  // 計算部分は node でも回すので、描画部品（FL・I_FORM・rot）に頼らずここで用意する
  var FL2 = G.flank, IF2 = 0;
  while (IF2 < FL2.length && Math.hypot(FL2[IF2][0], FL2[IF2][1]) < G.r_form - 1e-9) IF2++;
  function rot2(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
  function maxAbs2(a) { return a.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0); }
  // 基礎円の接線（作用線）と、歯の右歯面との交点。tooth は歯の角度、th は接点の角度
  function flankHit(toothAng, th, dAng) {
    var T0 = [G.rb * Math.cos(th), G.rb * Math.sin(th)], d = [-Math.sin(th), Math.cos(th)], best = null;
    for (var i = IF2; i < FL2.length - 1; i++) {
      var a = rot2(FL2[i], toothAng + (dAng || 0)), b = rot2(FL2[i + 1], toothAng + (dAng || 0));
      var ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex;
      if (Math.abs(den) < 1e-12) continue;
      var wx = a[0] - T0[0], wy = a[1] - T0[1];
      var s = (wx * ey - wy * ex) / den, q = (wx * d[1] - wy * d[0]) / den;
      if (q >= 0 && q <= 1) { best = { s: s, p: [T0[0] + d[0] * s, T0[1] + d[1] * s] }; break; }
    }
    return best;
  }
  // 歯 A（角度 +PA/2）と歯 B（−PA/2）の両方の右歯面を横切り、交点の平均半径が基準円に近い接線を探す
  var LOA = (function () {
    var best = null;
    for (var th = -0.9; th <= 0.9; th += 0.0005) {
      var hA = flankHit(PA / 2, th), hB = flankHit(-PA / 2, th);
      if (!hA || !hB) continue;
      var rm = (Math.hypot(hA.p[0], hA.p[1]) + Math.hypot(hB.p[0], hB.p[1])) / 2;
      if (!best || Math.abs(rm - G.rp) < best.err) best = { th: th, err: Math.abs(rm - G.rp), dist: Math.abs(hA.s - hB.s) };
    }
    return best;
  })();
  function CHECK() {
    return { fptMax: maxAbs2(FPT), Fp: PITCH.Fp, fpbMax: maxAbs2(FPB), Fr: RUN.Fr, e: RUN.e,
             pb_formula: PB, pb_measured_on_flanks: LOA.dist, loa_theta_deg: LOA.th * 180 / Math.PI, F_last: PITCH.F[G.z - 1], TOL: TOL };
  }
  // ---------- 計算ここまで ----------

  var GS = 3.2, GCX = 160, GCY = 136;
  // 見出し（名前とタグ）をどのパネルも 2 行にそろえ、図の高さをそろえる
  document.head.insertAdjacentHTML('beforeend', '<style>.chip-head{flex-direction:column;align-items:flex-start;gap:2px}</style>');
  function gScreen(p) { return [GCX + p[0] * GS, GCY - p[1] * GS]; }
  var XB = function (j) { return CX0 + 8 + j / (G.z - 1) * (CX1 - CX0 - 16); };
  function bar(ctx, j, v, alpha) {
    var y0 = cy(0), y1 = cy(v);
    ctx.globalAlpha = alpha; ctx.fillStyle = T.err; ctx.fillRect(XB(j) - 3.5, Math.min(y0, y1), 7, Math.max(1, Math.abs(y1 - y0))); ctx.globalAlpha = 1;
  }
  // 歯車全体（誤差あり＝橙、真値＝緑）
  function drawGear(ctx, rotA, ang) {
    var act = gearPts(rotA, ang).map(gScreen), ide = gearPts(rotA, null).map(gScreen);
    poly(ctx, act); ctx.closePath(); ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = T.err; ctx.lineWidth = 2; ctx.stroke();
    poly(ctx, ide); ctx.closePath(); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath(); ctx.arc(GCX, GCY, 3, 0, 2 * Math.PI); ctx.fillStyle = T.ink; ctx.fill();
  }
  function probeRight(ctx) {
    var px = GCX + (G.ra + 1.5) * GS;
    ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 30, GCY); ctx.lineTo(px, GCY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, GCY - 4); ctx.lineTo(px - 8, GCY); ctx.lineTo(px, GCY + 4); ctx.fillStyle = T.ink; ctx.fill();
    txt(ctx, '測定子', px + 4, GCY + 14, { jp: true, size: 9, color: T.ink, align: 'left' });
  }
  // 基準円の外側に、角度 a0 → a1 の円弧
  function arcAt(ctx, r, a0, a1, color, lw) {
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
    ctx.arc(GCX, GCY, r * GS, -a0, -a1, a1 > a0); ctx.stroke();
  }

  // 1. 単一ピッチ誤差：歯車を回し、右の測定子の前を通る隣り合う 2 歯の間隔を測る
  PANELS.fpt = function (ctx, t) {
    var K = 50, g = grow(t), u = prog(t), rotA = -2 * Math.PI * u;
    var nb = t >= END ? G.z : t >= T_SWEEP ? Math.min(G.z, Math.floor(u * G.z)) : 0;   // 測り終えた間隔の数
    viewFrame(ctx, '歯車全体・隣の 2 歯の間隔を測る', K);
    var ang = function (k) { return K * g * PITCH.F[k] / 1000 / G.rp; };
    drawGear(ctx, rotA, ang);
    var m1 = gScreen(rot([G.rf - 2.5, 0], rotA + ang(0)));
    txt(ctx, '1', m1[0], m1[1], { size: 10, color: T.err });
    if (t >= T_SWEEP && t < END) {                // いま測っている間隔（歯 j+1 → 歯 j+2）
      var j = Math.min(G.z - 1, Math.floor(u * G.z)), k1 = j, k2 = (j + 1) % G.z;
      var ia = rotA + k1 * PA, ib = rotA + (k1 + 1) * PA;
      arcAt(ctx, G.ra + 2.6, ia, ib, T.ideal, 2.2);
      arcAt(ctx, G.ra + 4.2, ia + ang(k1), ib + ang(k2), T.err, 2.6);
    }
    probeRight(ctx);
    txt(ctx, '外の弧：緑＝真値の間隔、橙＝誤差ありの間隔', 22, 242, { jp: true, size: 9, color: T.muted, align: 'left' });
    chartFrame(ctx, '歯1→2', '歯' + G.z + '→1', '隣り合う歯の間隔', '間隔が歯ごとにばらつく', t);
    for (var i = 0; i < nb; i++) bar(ctx, i, FPT[i], 0.85);
    numbers(ctx, [
      { label: '単一ピッチ誤差 fpt', val: nb ? maxAbs(FPT.slice(0, nb)) : null }
    ], 'JIS ' + GRADE + '級の目安  fpt ≤ ±' + fx(TOL.fpt, 1) + ' µm（いちばん大きいずれ）');
  };

  // 2. 累積ピッチ誤差：1 番歯を基準にした各歯の位置のずれ。単一ピッチ誤差を順に足すと、この線になる
  PANELS.Fp = function (ctx, t) {
    var K = 50, g = grow(t), u = prog(t), rotA = -2 * Math.PI * u;
    var n = t >= END ? G.z : t >= T_SWEEP ? Math.min(G.z, Math.floor(u * G.z + 1e-9) + 1) : 0;   // 測り終えた歯の数
    viewFrame(ctx, '歯車全体・1 番歯からの位置', K);
    var ang = function (k) { return K * g * PITCH.F[k] / 1000 / G.rp; };
    drawGear(ctx, rotA, ang);
    var m1 = gScreen(rot([G.rf - 2.5, 0], rotA + ang(0)));
    txt(ctx, '1', m1[0], m1[1], { size: 10, color: T.err });
    if (n > 0 && t < END) {                       // いまの歯の、真値の位置からのずれ（×50）
      var k = n - 1, a = rotA + k * PA;
      arcAt(ctx, G.ra + 3.2, a, a + ang(k), T.warn, 3);
    }
    probeRight(ctx);
    txt(ctx, '外の弧：いまの歯の、真値の位置からのずれ', 22, 242, { jp: true, size: 9, color: T.muted, align: 'left' });
    chartFrame(ctx, '歯 1', '歯 ' + G.z, '線：位置のずれ ／ 縦の矢印：単一ピッチ', 'ずれが積み重なる', t);
    // 階段：前の歯の高さから、単一ピッチ誤差のぶんだけ上下して次の歯へ
    var i;
    for (i = 1; i < n; i++) {
      ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(XB(i - 1), cy(PITCH.F[i - 1])); ctx.lineTo(XB(i), cy(PITCH.F[i - 1])); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = T.warn; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(XB(i), cy(PITCH.F[i - 1])); ctx.lineTo(XB(i), cy(PITCH.F[i])); ctx.stroke();
    }
    if (n > 0) {
      ctx.strokeStyle = T.err; ctx.lineWidth = 1.6; ctx.beginPath();
      for (i = 0; i < n; i++) { if (i) ctx.lineTo(XB(i), cy(PITCH.F[i])); else ctx.moveTo(XB(i), cy(PITCH.F[i])); }
      ctx.stroke();
      for (i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(XB(i), cy(PITCH.F[i]), 2.4, 0, 2 * Math.PI); ctx.fillStyle = T.err; ctx.fill(); }
    }
    var fseen = PITCH.fpt.slice(1, n);
    numbers(ctx, [
      { label: '累積ピッチ誤差 Fp', val: n > 1 ? range(PITCH.F.slice(0, n)) : null },
      { label: '（単一ピッチの最大）', val: fseen.length ? maxAbs(fseen) : null }
    ], 'JIS ' + GRADE + '級の目安  Fp ≤ ' + fx(TOL.Fp, 1) + ' µm（位置のずれの山と谷の差）');
  };

  // 3. 法線ピッチ誤差：隣り合う 2 歯の右歯面を、基礎円の接線（作用線）に沿って測る
  PANELS.fpb = function (ctx, t) {
    var K = 50, g = grow(t), u = prog(t);
    var nb = t >= END ? G.z : t >= T_SWEEP ? Math.min(G.z, Math.floor(u * G.z)) : 0;
    var j = t >= T_SWEEP ? Math.min(G.z - 1, Math.floor(u * G.z)) : 0;   // 見せている間隔
    viewFrame(ctx, '隣り合う 2 歯を拡大', K);
    var S = 24, CXV = 170, YT = 52;
    var scr = function (p) { return [CXV - p[1] * S, YT + (G.ra - p[0]) * S]; };
    // 歯 B（下の歯）を、単一ピッチ誤差のぶんだけ回す（×K）。歯面は作用線に沿って fpt·cos αt 動く
    var dB = -K * g * FPT[j] / 1000 / G.rp;
    ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
    // 基礎円
    ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath();
    for (var a = -0.6; a <= 0.6; a += 0.01) { var q = scr([G.rb * Math.cos(a), G.rb * Math.sin(a)]); if (a === -0.6) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); }
    ctx.stroke(); ctx.setLineDash([]);
    // 歯 4 枚を右（角度が小さい側）から順につなぎ、1 つの形として塗る
    var acts = [], ides = [];
    [-1.5, -0.5, 0.5, 1.5].forEach(function (m) {
      var ta = m * PA, isB = Math.abs(m + 0.5) < 1e-9;
      acts.push(TOOTH0.map(function (p) { return scr(rot(p, ta + (isB ? dB : 0))); }));
      ides.push(TOOTH0.map(function (p) { return scr(rot(p, ta)); }));
    });
    var all = [].concat.apply([], acts);
    poly(ctx, all); ctx.lineTo(all[all.length - 1][0], 260); ctx.lineTo(all[0][0], 260); ctx.closePath();
    ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fill(); ctx.globalAlpha = 1;
    acts.forEach(function (a) { poly(ctx, a); ctx.strokeStyle = T.err; ctx.lineWidth = 2.2; ctx.stroke(); });
    ides.forEach(function (a) { poly(ctx, a); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.2; ctx.stroke(); });
    // 作用線（基礎円の接線）
    var th = LOA.th, T0 = [G.rb * Math.cos(th), G.rb * Math.sin(th)], d = [-Math.sin(th), Math.cos(th)];
    var l0 = scr([T0[0] - d[0] * 12, T0[1] - d[1] * 12]), l1 = scr([T0[0] + d[0] * 12, T0[1] + d[1] * 12]);
    ctx.strokeStyle = T.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(l0[0], l0[1]); ctx.lineTo(l1[0], l1[1]); ctx.stroke();
    var tp = scr(T0); ctx.beginPath(); ctx.arc(tp[0], tp[1], 2.5, 0, 2 * Math.PI); ctx.fillStyle = T.ink; ctx.fill();
    var hA = flankHit(PA / 2, th), hBi = flankHit(-PA / 2, th), hBa = flankHit(-PA / 2, th, dB);
    function arrow(p, q, color, off) {
      var P = scr(p), Q = scr(q), nx = -(Q[1] - P[1]), ny = Q[0] - P[0], l = Math.hypot(nx, ny); nx = nx / l * off; ny = ny / l * off;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P[0] + nx, P[1] + ny); ctx.lineTo(Q[0] + nx, Q[1] + ny); ctx.stroke();
      [P, Q].forEach(function (R) { ctx.beginPath(); ctx.arc(R[0], R[1], 2.6, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); });
      return [(P[0] + Q[0]) / 2 + nx, (P[1] + Q[1]) / 2 + ny];
    }
    if (hA && hBi) { var mi = arrow(hA.p, hBi.p, T.ideal, -9); tag(ctx, 'pb ' + fx(PB, 3) + ' mm', mi[0] - 4, mi[1] - 9, { size: 9, color: T.ideal, align: 'right' }); }
    if (hA && hBa && g > 0.01) arrow(hA.p, hBa.p, T.err, 9);
    ctx.restore();
    txt(ctx, '細い線：作用線（基礎円の接線）　点線：基礎円', 22, 242, { jp: true, size: 9, color: T.muted, align: 'left' });
    if (t >= T_SWEEP && t < END) txt(ctx, '歯' + (j + 1) + '→' + ((j + 1) % G.z + 1), 318, 44, { jp: true, size: 10, color: T.err, align: 'right' });
    chartFrame(ctx, '歯1→2', '歯' + G.z + '→1', '隣り合う歯の間隔', '作用線に沿った間隔のずれ', t);
    for (var i = 0; i < nb; i++) bar(ctx, i, FPB[i], 0.85);
    var cur = t >= T_SWEEP ? PB + FPB[j] / 1000 : null;
    numbers(ctx, [
      { label: '法線ピッチ誤差 fpb', val: nb ? maxAbs(FPB.slice(0, nb)) : null },
      { label: '法線ピッチ', ideal: fx(PB, 4), val: cur == null ? null : fx(cur, 4) + ' mm' }
    ], 'JIS ' + GRADE + '級の目安  fpb ≤ ±' + fx(TOL.fpb, 1) + ' µm（fpt × cos αt）');
  };

  // 4. 振れ：歯車の中心が回転軸からずれている。上の歯溝に球を入れ、高さの変化を測る
  PANELS.Fr = function (ctx, t) {
    var K = 50, g = grow(t), u = prog(t), rotA = Math.PI / 2 + Math.PI / G.z - 2 * Math.PI * u;  // 歯溝が真上に来る向き
    var n = t >= END ? G.z : t >= T_SWEEP ? Math.min(G.z, Math.floor(u * G.z + 1e-9) + 1) : 0;
    viewFrame(ctx, '歯車全体・上の歯溝に球を入れる', K);
    var ex = K * g * RUN.e / 1000, ca = Math.PI / 2 - 2 * Math.PI * u;
    var cx = ex * Math.cos(ca), cyy = ex * Math.sin(ca);
    var act = gearPts(rotA, null, cx, cyy).map(gScreen), ide = gearPts(rotA, null).map(gScreen);
    poly(ctx, act); ctx.closePath(); ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = T.err; ctx.lineWidth = 2; ctx.stroke();
    poly(ctx, ide); ctx.closePath(); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.strokeStyle = T.muted; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(GCX, GCY, ex * GS, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(GCX - 6, GCY); ctx.lineTo(GCX + 6, GCY); ctx.moveTo(GCX, GCY - 6); ctx.lineTo(GCX, GCY + 6); ctx.stroke();
    var gc = gScreen([cx, cyy]); ctx.beginPath(); ctx.arc(gc[0], gc[1], 3, 0, 2 * Math.PI); ctx.fillStyle = T.err; ctx.fill();
    txt(ctx, '＋回転軸', GCX + 10, GCY + 16, { jp: true, size: 9, color: T.ink, align: 'left' });
    txt(ctx, '●歯車の中心', GCX + 10, GCY + 29, { jp: true, size: 9, color: T.err, align: 'left' });
    var by = gScreen([0, G.rp + 0.9 + cyy]);
    ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(by[0], by[1]); ctx.lineTo(by[0], 40); ctx.stroke();
    ctx.beginPath(); ctx.arc(by[0], by[1], 1.6 * GS, 0, 2 * Math.PI); ctx.fillStyle = T.ink; ctx.fill();
    txt(ctx, '球', by[0] + 10, 48, { jp: true, size: 9, color: T.ink, align: 'left' });
    chartFrame(ctx, '歯溝 1', '歯溝 ' + G.z, '1 回転', '1回転で1周期の波', t);
    var k;
    if (n > 0) {
      ctx.strokeStyle = T.err; ctx.lineWidth = 2.2; ctx.beginPath();
      for (k = 0; k < n; k++) { if (k) ctx.lineTo(XB(k), cy(RUN.r[k])); else ctx.moveTo(XB(k), cy(RUN.r[k])); }
      ctx.stroke();
      for (k = 0; k < n; k++) { ctx.beginPath(); ctx.arc(XB(k), cy(RUN.r[k]), 2.4, 0, 2 * Math.PI); ctx.fillStyle = T.err; ctx.fill(); }
    }
    numbers(ctx, [
      { label: '振れ Fr', val: n > 1 ? range(RUN.r.slice(0, n)) : null },
      { label: '偏心量 e', val: t >= END ? RUN.e : null }
    ], 'JIS ' + GRADE + '級の目安  Fr ≤ ' + fx(TOL.Fr, 1) + ' µm（振れ ＝ 偏心 × 2）');
  };

  var f1 = function (v) { return fx(v, 1); };
  LEAD = '誤差ありの歯車は、単一ピッチ誤差と振れを JIS ' + GRADE + '級の許容いっぱいにした（JIS B 1702-1:1998 の式に実寸を入れた目安）。' +
    'ピッチの並びは乱数（シード固定）で作った。法線ピッチ誤差は、歯形が理想として fpt × cos αt で求めた。ピッチ誤差と偏心は別々に入れている。';
  POINTS = ['隣どうしの間隔のずれは小さくても（最大 ' + f1(maxAbs(FPT)) + ' µm）、<em>積み重なると大きくなる</em>（' + f1(PITCH.Fp) + ' µm）',
    '中心がずれる（偏心）と、歯の高さが<em>1 回転で 1 周期の波</em>になる（振れ ' + f1(RUN.Fr) + ' µm）'];
  ARIA.fpt = '単一ピッチ誤差：歯車を1回転させ、隣り合う歯の間隔を ' + G.z + ' か所測る。真値はどこも 0。誤差ありはいちばん大きいずれが ' + f1(maxAbs(FPT)) + ' µm。';
  ARIA.Fp = '累積ピッチ誤差：1番歯を基準にした各歯の位置のずれ。単一ピッチ誤差を順に足した線になり、山と谷の差は ' + f1(PITCH.Fp) + ' µm。単一ピッチの最大 ' + f1(maxAbs(FPT)) + ' µm より大きい。真値は 0。';
  ARIA.fpb = '法線ピッチ誤差：隣り合う歯の同じ側の歯面の距離を、基礎円の接線に沿って測る。真値は ' + fx(PB, 3) + ' mm。誤差ありはいちばん大きいずれが ' + f1(maxAbs(FPB)) + ' µm。';
  ARIA.Fr = '振れ：歯車の中心が回転軸から ' + f1(RUN.e) + ' µm ずれていて、歯溝に入れた球の高さが1回転で1周期ゆれる。振れは ' + f1(RUN.Fr) + ' µm。真値は 0。';
