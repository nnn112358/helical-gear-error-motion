  // ---------- 計算 ----------
  // 穴径 10 mm（helical_gear.py の bore）。規格値の無いものは「想定」の値。
  var BORE = 10.0, N6 = 360;
  var ANG = []; for (var ia = 0; ia <= N6; ia++) ANG.push(ia / N6);      // 0〜1 = 0〜360°
  // 1. 穴の寸法：φ10 H7 は 0〜+15 µm。誤差ありは +30 µm（範囲外）を想定。軸は φ10.000 ちょうどとする
  var H7_UP = 15, DBORE = 30;
  var BOREC = { d: ANG.map(function () { return DBORE; }), gap: DBORE };
  // 2. 穴の真円度：3 山のおむすび形（3 次の波）。真円度（半径の山と谷の差）8 µm を想定
  var RND = 8;
  var ROUND = { r: ANG.map(function (s) { return RND / 2 * Math.cos(3 * 2 * Math.PI * s); }) };
  ROUND.val = range(ROUND.r);
  // 3. 端面の振れ：端面が回転軸に対して傾いている。ダイヤルゲージは歯底円の少し内側の半径 RF で当てる
  var RF = Math.floor(G.rf) - 2, FACE_RUN = 20;
  var TILT = FACE_RUN / 2 / 1000 / RF;                              // 傾き [rad]（振れ = 2·R·tanφ）
  var FACE = { a: ANG.map(function (s) { return RF * TILT * 1000 * Math.cos(2 * Math.PI * s); }) };
  FACE.val = range(FACE.a);
  FACE.helix = G.b * TILT * 1000;                                   // 歯幅の両端で歯すじがずれる量（最大）
  // 4. 穴と歯の同軸度：穴の中心と歯（ピッチ円）の中心が 30 µm ずれる想定。穴を基準に回すと歯溝の振れになる
  var OFF = 30;
  var COAX = { r: [] }; for (var kk = 0; kk < G.z; kk++) COAX.r.push(OFF * Math.cos(2 * Math.PI * kk / G.z));
  COAX.Fr = range(COAX.r);
  // チャートの縦：4 枚とも同じ。いちばん大きい値に 10 µm の余白
  YR = Math.ceil((Math.max(DBORE, maxAbsN(ROUND.r), maxAbsN(FACE.a), maxAbsN(COAX.r)) + 10) / 10) * 10;
  function maxAbsN(a) { return a.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0); }
  function CHECK() { return { YR: YR, bore: DBORE, gap: BOREC.gap, round: ROUND.val, RF: RF, tilt_urad: TILT * 1e6, face: FACE.val, helix: FACE.helix, coaxOff: OFF, coaxFr: COAX.Fr }; }
  // ---------- 計算ここまで ----------

  // 穴の拡大図の座標：1 mm = BS px、中心 (170, 140)
  var BS = 17, BCX = 170, BCY = 140;
  function bScreen(p) { return [BCX + p[0] * BS, BCY - p[1] * BS]; }
  // 穴の輪郭（キー溝つき）。rdev(θ) = 半径のずれ [mm]（拡大後）
  function borePts(rdev) {
    var out = [], n = 240, rk = BORE / 2, kw = 1.5, i;
    var a0 = Math.asin(kw / rk);
    for (i = 0; i <= n; i++) {
      var a = a0 + (2 * Math.PI - 2 * a0) * i / n, r = rk + rdev(a);
      out.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    var re = rk + rdev(-a0), xe = Math.sqrt(Math.max(re * re - kw * kw, 0));
    out.push([rk + 1.5 + rdev(0), -kw]); out.push([rk + 1.5 + rdev(0), kw]);
    return out;
  }
  // 歯車の地（穴のまわり）と穴を描く
  function drawBore(ctx, rdevAct, shaft) {
    ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
    ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fillRect(13, 33, 314, 218); ctx.globalAlpha = 1;
    var act = borePts(rdevAct).map(bScreen), ide = borePts(function () { return 0; }).map(bScreen);
    poly(ctx, act); ctx.closePath(); ctx.fillStyle = T.bg; ctx.fill();
    if (shaft) {                               // 軸 φ10.000（ちょうど）。軸と穴のすき間を赤く
      ctx.beginPath(); ctx.arc(BCX, BCY, BORE / 2 * BS, 0, 2 * Math.PI);
      ctx.globalAlpha = 0.25; ctx.fillStyle = T.warn; poly(ctx, act); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(BCX, BCY, BORE / 2 * BS, 0, 2 * Math.PI); ctx.fillStyle = T.die; ctx.fill();
      ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.stroke();
      txt(ctx, '軸 φ10.000', BCX, BCY + 30, { jp: true, size: 9, color: T.muted });
    }
    poly(ctx, act); ctx.closePath(); ctx.strokeStyle = T.err; ctx.lineWidth = 2.4; ctx.stroke();
    poly(ctx, ide); ctx.closePath(); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
  }
  function cross(ctx, x, y) {
    ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke();
  }
  function curIdx(t) { return Math.round(prog(t) * N6); }

  // 1. 穴の寸法
  PANELS.bore = function (ctx, t) {
    var K = 50, g = grow(t), u = prog(t), cur = curIdx(t);
    viewFrame(ctx, '穴を拡大・軸を通したところ', K);
    var dr = K * g * DBORE / 2 / 1000;
    drawBore(ctx, function () { return dr; }, true);
    if (t >= T_SWEEP) {                        // 内径の測定子：向かい合う 2 点で直径を測りながら 1 周
      var a = 2 * Math.PI * u, r = BORE / 2 + dr;
      var p1 = bScreen([r * Math.cos(a), r * Math.sin(a)]), p2 = bScreen([-r * Math.cos(a), -r * Math.sin(a)]);
      ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); ctx.setLineDash([]);
      [p1, p2].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, 2 * Math.PI); ctx.fillStyle = T.ink; ctx.fill(); });
    }
    txt(ctx, 'すき間', BCX - 2, BCY - BORE / 2 * BS - 8, { jp: true, size: 9, color: T.warn });
    chartFrame(ctx, '0°', '360°', '穴の内側を 1 周', '', t);
    if (t >= T_SWEEP) chartLine(ctx, ANG, BOREC.d, cur);
    if (t >= END) txt(ctx, '1周どこでも大きい', CX0 + 6, cy(-YR / 2) + 8, { jp: true, size: 12, color: T.err, align: 'left' });
    numbers(ctx, [
      { label: '穴径', ideal: '10.000', val: t >= T_SWEEP ? fx(BORE + DBORE / 1000, 3) + ' mm' : null },
      { label: '軸とのすき間', val: t >= END ? BOREC.gap : null }
    ], '想定  φ10 H7 は +0〜+' + H7_UP + ' µm。+' + DBORE + ' µm は範囲外');
  };

  // 2. 穴の真円度
  PANELS.round = function (ctx, t) {
    var K = 200, g = grow(t), u = prog(t), cur = curIdx(t);
    viewFrame(ctx, '穴を拡大・中心から半径を測る', K);
    var rdev = function (a) { return K * g * RND / 2 * Math.cos(3 * a) / 1000; };
    drawBore(ctx, rdev, false);
    cross(ctx, BCX, BCY);
    if (t >= T_SWEEP) {
      var a = 2 * Math.PI * u, r = BORE / 2 + rdev(a), p = bScreen([r * Math.cos(a), r * Math.sin(a)]);
      ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(BCX, BCY); ctx.lineTo(p[0], p[1]); ctx.stroke();
      ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, 2 * Math.PI); ctx.fillStyle = T.ink; ctx.fill();
    }
    chartFrame(ctx, '0°', '360°', '穴の内側を 1 周', '1周に3つの山', t);
    if (t >= T_SWEEP) chartLine(ctx, ANG, ROUND.r, cur);
    numbers(ctx, [
      { label: '真円度', val: t >= T_SWEEP ? range(ROUND.r.slice(0, cur + 1)) : null },
      { label: '山の数', ideal: '—', val: t >= END ? '3 つ' : null }
    ], '想定  3 山のおむすび形、真円度 ' + RND + ' µm');
  };

  // 3. 端面の振れ（横から見た図。軸は左右、歯車は縦の板）
  PANELS.face = function (ctx, t) {
    var K = 50, g = grow(t), u = prog(t), cur = curIdx(t), a = 2 * Math.PI * u;
    viewFrame(ctx, '横から見る・端面にダイヤルゲージ', K);
    var S = 3.2, CX = 150, CY = 142;
    var phi = K * g * TILT * Math.cos(a);       // 図の面での見かけの傾き（傾きの向きが歯車と一緒に回る）
    var P = function (x, y) { return [CX + (x * Math.cos(phi) - y * Math.sin(phi)) * S, CY - (x * Math.sin(phi) + y * Math.cos(phi)) * S]; };
    // 軸
    ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.setLineDash([6, 3]);
    ctx.beginPath(); ctx.moveTo(20, CY); ctx.lineTo(320, CY); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, '回転軸', 24, CY - 8, { jp: true, size: 9, color: T.muted, align: 'left' });
    var hb = G.b / 2, ra = G.ra;
    var act = [P(-hb, -ra), P(hb, -ra), P(hb, ra), P(-hb, ra)];
    var ide = [[CX - hb * S, CY + ra * S], [CX + hb * S, CY + ra * S], [CX + hb * S, CY - ra * S], [CX - hb * S, CY - ra * S]];
    poly(ctx, act); ctx.closePath(); ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = T.err; ctx.lineWidth = 2.4; ctx.stroke();
    poly(ctx, ide); ctx.closePath(); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.3; ctx.stroke();
    // 右の端面、半径 RF の点にゲージ
    var c = P(hb, RF);
    var gx = CX + hb * S + K * g * FACE.a[cur] / 1000 * S;
    ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c[0] + 1, c[1]); ctx.lineTo(c[0] + 50, c[1]); ctx.stroke();
    ctx.beginPath(); ctx.arc(c[0] + 2, c[1], 3, 0, 2 * Math.PI); ctx.fillStyle = T.ink; ctx.fill();
    box(ctx, c[0] + 62, c[1], 24, 18, { stroke: T.ink, lw: 1.2 });
    txt(ctx, 'ゲージ', c[0] + 62, c[1] - 18, { jp: true, size: 9, color: T.ink });
    txt(ctx, '半径 ' + RF + ' mm', c[0] + 62, c[1] + 20, { jp: true, size: 9, color: T.muted });
    void gx;
    txt(ctx, '歯幅 ' + G.b + ' mm', CX, CY + ra * S + 12, { jp: true, size: 9, color: T.muted });
    chartFrame(ctx, '0°', '360°', '1 回転', '1回転で1周期の波', t);
    if (t >= T_SWEEP) chartLine(ctx, ANG, FACE.a, cur);
    numbers(ctx, [
      { label: '端面の振れ', val: t >= T_SWEEP ? range(FACE.a.slice(0, cur + 1)) : null },
      { label: '歯すじのずれ', val: t >= END ? FACE.helix : null }
    ], '想定  半径 ' + RF + ' mm で ' + FACE_RUN + ' µm 振れる');
  };

  // 4. 穴と歯の同軸度（穴を回転軸にして回す）
  var GS6 = 3.4, GCX6 = 160, GCY6 = 146;
  function g6Screen(p) { return [GCX6 + p[0] * GS6, GCY6 - p[1] * GS6]; }
  PANELS.coax = function (ctx, t) {
    var K = 50, g = grow(t), u = prog(t), rotA = Math.PI / 2 + Math.PI / G.z - 2 * Math.PI * u;
    var n = t >= T_SWEEP ? Math.min(G.z, Math.floor(u * G.z + 1e-9) + 1) : 0;
    if (t >= END) n = G.z;
    viewFrame(ctx, '穴を軸にして回す・上の歯溝に球', K);
    var ex = K * g * OFF / 1000, ca = Math.PI / 2 - 2 * Math.PI * u, cx = ex * Math.cos(ca), cyy = ex * Math.sin(ca);
    var act = gearPts(rotA, null, cx, cyy).map(g6Screen), ide = gearPts(rotA, null).map(g6Screen);
    poly(ctx, act); ctx.closePath(); ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = T.err; ctx.lineWidth = 2; ctx.stroke();
    poly(ctx, ide); ctx.closePath(); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.1; ctx.stroke();
    // 穴（回転軸と同じ中心）
    ctx.beginPath(); ctx.arc(GCX6, GCY6, BORE / 2 * GS6, 0, 2 * Math.PI); ctx.fillStyle = T.bg; ctx.fill();
    ctx.strokeStyle = T.ink; ctx.lineWidth = 1.2; ctx.stroke();
    cross(ctx, GCX6, GCY6);
    var gc = g6Screen([cx, cyy]); ctx.beginPath(); ctx.arc(gc[0], gc[1], 3, 0, 2 * Math.PI); ctx.fillStyle = T.err; ctx.fill();
    txt(ctx, '＋穴の中心＝回転軸', GCX6, GCY6 + 30, { jp: true, size: 9, color: T.ink });
    txt(ctx, '●歯の中心', GCX6, GCY6 + 43, { jp: true, size: 9, color: T.err });
    var by = g6Screen([0, G.rp + 0.9 + cyy]);
    ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(by[0], by[1]); ctx.lineTo(by[0], 40); ctx.stroke();
    ctx.beginPath(); ctx.arc(by[0], by[1], 1.6 * GS6, 0, 2 * Math.PI); ctx.fillStyle = T.ink; ctx.fill();
    txt(ctx, '球', by[0] + 10, 48, { jp: true, size: 9, color: T.ink, align: 'left' });
    chartFrame(ctx, '歯溝 1', '歯溝 ' + G.z, '1 回転', '1回転で1周期の波', t);
    var X = function (k) { return CX0 + 6 + k / (G.z - 1) * (CX1 - CX0 - 12); }, k;
    if (n > 0) {
      ctx.strokeStyle = T.err; ctx.lineWidth = 2.2; ctx.beginPath();
      for (k = 0; k < n; k++) { if (k) ctx.lineTo(X(k), cy(COAX.r[k])); else ctx.moveTo(X(k), cy(COAX.r[k])); }
      ctx.stroke();
      for (k = 0; k < n; k++) { ctx.beginPath(); ctx.arc(X(k), cy(COAX.r[k]), 2.4, 0, 2 * Math.PI); ctx.fillStyle = T.err; ctx.fill(); }
    }
    numbers(ctx, [
      { label: '中心のずれ', val: t >= END ? OFF : null },
      { label: '歯の振れ', val: n > 1 ? range(COAX.r.slice(0, n)) : null }
    ], '想定  穴と歯の中心が ' + OFF + ' µm ずれる。振れ ＝ ずれ × 2');
  };

  var f1 = function (v) { return fx(v, 1); };
  LEAD = '歯そのものではなく、穴や端面の誤差。規格に許容値が無いものは値を想定した（各パネルの下に記載）。';
  POINTS = ['歯ではなく、<em>穴や取付け面</em>の誤差',
    '穴を基準に回すので、本体の誤差は<em>歯の振れ</em>（' + f1(COAX.Fr) + ' µm）や<em>歯すじのずれ</em>（' + f1(FACE.helix) + ' µm）として出る'];
  ARIA.bore = '穴の寸法：真値は直径 10.000 mm。誤差ありは ' + fx(BORE + DBORE / 1000, 3) + ' mm で、1 周どこで測っても ' + DBORE + ' µm 大きい。φ10 H7 の上限 +' + H7_UP + ' µm を超え、φ10.000 の軸との間に ' + DBORE + ' µm のすき間ができる。';
  ARIA.round = '穴の真円度：真値は真円。誤差ありは 1 周に 3 つの山があるおむすび形で、半径の山と谷の差（真円度）は ' + f1(ROUND.val) + ' µm。';
  ARIA.face = '端面の振れ：取付け端面が回転軸に対して傾いている。半径 ' + RF + ' mm にダイヤルゲージを当てて 1 回転させると、軸方向に ' + f1(FACE.val) + ' µm ゆれる。真値は 0。この傾きで、歯幅の両端で歯すじが最大 ' + f1(FACE.helix) + ' µm ずれる。';
  ARIA.coax = '穴と歯の同軸度：穴の中心と歯の中心が ' + OFF + ' µm ずれている。穴を軸にして回すと、歯溝に入れた球の高さが 1 回転で 1 周期ゆれ、歯の振れは ' + f1(COAX.Fr) + ' µm（ずれの 2 倍）。真値は 0。';
