  // ---------- 共通 ----------
  var VW = 340, VH = 520;
  var T = {};
  function readTokens() {
    var s = getComputedStyle(document.documentElement);
    ['bg', 'die', 'ink', 'muted', 'line', 'ideal', 'err', 'warn'].forEach(function (k) {
      T[k] = s.getPropertyValue('--' + k).trim();
    });
  }
  function fit(c) {
    var r = c.getBoundingClientRect();
    var dp = Math.min(window.devicePixelRatio || 1, 3);
    var w = Math.max(1, Math.round(r.width * dp)), h = Math.max(1, Math.round(r.height * dp));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    var ctx = c.getContext('2d');
    var s = w / VW;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    return ctx;
  }
  function c01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(p) { p = c01(p); return p * p * (3 - 2 * p); }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function box(ctx, cx, cy, w, h, o) {
    o = o || {};
    rr(ctx, cx - w / 2, cy - h / 2, w, h, o.r == null ? 4 : o.r);
    ctx.globalAlpha = 1;
    ctx.fillStyle = o.fill || T.bg; ctx.fill();
    if (o.glow) { ctx.globalAlpha = o.glow; ctx.fillStyle = o.color; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.lineWidth = o.lw || 1;
    ctx.setLineDash(o.dash || []);
    ctx.strokeStyle = o.stroke || T.line; ctx.stroke();
    ctx.setLineDash([]);
  }
  function txt(ctx, s, x, y, o) {
    o = o || {};
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.font = (o.weight || 700) + ' ' + (o.size || 14) + 'px ' + (o.jp ? '"Zen Kaku Gothic New", sans-serif' : '"M PLUS 1 Code", ui-monospace, monospace');
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = o.color || T.ink;
    ctx.fillText(String(s), x, y);
    ctx.globalAlpha = 1;
  }
  function fx(v, n) { var s = v.toFixed(n); return /^-0\.0+$/.test(s) ? s.slice(1) : s; }
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); }

  // ---------- 歯車の形（helical_gear.py の創成歯形から） ----------
  // 歯の右側歯面（歯底→歯先）。歯は +X 軸が中心。
  var FL = G.flank;
  var Lr = FL.map(function (p) { var r = Math.hypot(p[0], p[1]); return r > G.rb ? Math.sqrt(r * r - G.rb * G.rb) : 0; });
  var FN = FL.map(function (p, i) {           // 歯の外向きの法線
    var a = FL[Math.max(0, i - 1)], b = FL[Math.min(FL.length - 1, i + 1)];
    var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty), nx = ty / l, ny = -tx / l;
    return ny < 0 ? [nx, ny] : [-nx, -ny];
  });
  function rot(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
  function interp(xs, ys, x) {               // xs は単調増加
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    var lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    var f = (x - xs[lo]) / (xs[hi] - xs[lo]); return ys[lo] + f * (ys[hi] - ys[lo]);
  }
  // 歯 1 枚の輪郭（右歯面 → 歯先 → 左歯面 → 次の歯までの歯底）。right は右歯面の点列（省略で理想形）
  function toothPts(right) {
    var R = right || FL, out = R.slice(), i, n = FL.length;
    var e = R[R.length - 1], th = Math.atan2(e[1], e[0]), thL = -Math.atan2(FL[n - 1][1], FL[n - 1][0]);
    for (i = 1; i < 8; i++) { var a = th + (thL - th) * i / 8; out.push([G.ra * Math.cos(a), G.ra * Math.sin(a)]); }
    for (i = n - 1; i >= 0; i--) out.push([FL[i][0], -FL[i][1]]);
    var a0 = Math.atan2(-FL[0][1], FL[0][0]), a1 = 2 * Math.PI / G.z + Math.atan2(FL[0][1], FL[0][0]);
    for (i = 1; i < 6; i++) { var a2 = a0 + (a1 - a0) * i / 6; out.push([G.rf * Math.cos(a2), G.rf * Math.sin(a2)]); }
    return out;
  }
  // 右歯面の点を法線方向に dev(i) [mm] 動かした点列
  function flankWith(dev) { return FL.map(function (p, i) { var d = dev(i); return [p[0] + FN[i][0] * d, p[1] + FN[i][1] * d]; }); }
  // 歯面上の位置（インボリュートの始まりからの長さ s [mm]）→ 点と法線
  var RS = FL.map(function (p) { return Math.hypot(p[0], p[1]); });
  var FLX = FL.map(function (p) { return p[0]; }), FLY = FL.map(function (p) { return p[1]; });
  var FNX = FN.map(function (p) { return p[0]; }), FNY = FN.map(function (p) { return p[1]; });
  function flankAt(s) {
    var L = Math.sqrt(L0 * L0 + 2 * G.rb * s), r = Math.sqrt(L * L + G.rb * G.rb);
    return { p: [interp(RS, FLX, r), interp(RS, FLY, r)], n: [interp(RS, FNX, r), interp(RS, FNY, r)] };
  }
  var TOOTH0 = toothPts(null);
  // 歯車全体。ang(k) = 歯 k の角度のずれ [rad]
  function gearPts(rotA, ang, cx, cy) {
    var out = [];
    for (var k = 0; k < G.z; k++) {
      var a = rotA + 2 * Math.PI * k / G.z + (ang ? ang(k) : 0);
      TOOTH0.forEach(function (p) { var q = rot(p, a); out.push([q[0] + (cx || 0), q[1] + (cy || 0)]); });
    }
    return out;
  }

  // ---------- 進行 ----------
  // 0.2〜1.4 秒：0 µm の歯車がずれた歯車に変わる ／ 1.6〜8.6 秒：測定子でなぞってチャートを描く ／ そのあと止めて見せる
  var T_GROW = 0.2, GROW = 1.2, T_SWEEP = 1.6, SWEEP = 7, END = T_SWEEP + SWEEP, PERIOD = END + 2.6;

  // ---------- 描画部品 ----------
  var YR = 60;                                 // チャートの縦：ページ内の全パネル共通（ページごとのファイルで変えてよい）
  var CHART_TITLE = '測定チャート（µm、実寸）';
  var CX0 = 44, CX1 = 316, CY0 = 296, CY1 = 382;
  function cy(v) { return (CY0 + CY1) / 2 - v / YR * (CY1 - CY0) / 2; }
  function viewFrame(ctx, title, K) {
    box(ctx, 170, 132, 316, 240, { r: 8, dash: [5, 3], stroke: T.muted, fill: T.bg });
    txt(ctx, title, 22, 26, { jp: true, size: 10, weight: 700, color: T.muted, align: 'left' });
    txt(ctx, '※ ずれを ×' + K + ' で表示', 318, 26, { jp: true, size: 10, weight: 700, color: T.warn, align: 'right' });
  }
  function chartFrame(ctx, xl, xr, xmid, effect, t) {
    box(ctx, 170, 334, 316, 128, { r: 8, dash: [5, 3], stroke: T.muted, fill: T.bg });
    txt(ctx, CHART_TITLE, 22, 282, { jp: true, size: 10, color: T.muted, align: 'left' });
    ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(198, 282); ctx.lineTo(212, 282); ctx.stroke();
    txt(ctx, '真値', 215, 282, { jp: true, size: 10, weight: 700, color: T.muted, align: 'left' });
    ctx.strokeStyle = T.err; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(250, 282); ctx.lineTo(264, 282); ctx.stroke();
    txt(ctx, '誤差あり', 267, 282, { jp: true, size: 10, weight: 700, color: T.muted, align: 'left' });
    ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    [-YR / 2, YR / 2].forEach(function (v) { ctx.beginPath(); ctx.moveTo(CX0, cy(v)); ctx.lineTo(CX1, cy(v)); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.strokeStyle = T.muted; ctx.beginPath(); ctx.moveTo(CX0, CY0); ctx.lineTo(CX0, CY1); ctx.stroke();
    [YR, YR / 2, 0, -YR / 2, -YR].forEach(function (v) { txt(ctx, (v > 0 ? '+' : '') + (+v.toFixed(1)), CX0 - 4, cy(v), { size: 9, weight: 600, color: T.muted, align: 'right' }); });
    txt(ctx, xl, CX0, 391, { jp: true, size: 10, weight: 500, color: T.muted, align: 'left' });
    txt(ctx, xmid, 180, 391, { jp: true, size: 10, weight: 500, color: T.muted });
    txt(ctx, xr, CX1, 391, { jp: true, size: 10, weight: 500, color: T.muted, align: 'right' });
    // 0 µm の線（理想の歯車はどこを測っても 0）
    ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(CX0, cy(0)); ctx.lineTo(CX1, cy(0)); ctx.stroke();
    if (t >= END) {                            // 線と重なっても読めるよう地の色を敷く
      ctx.font = '700 13px "Zen Kaku Gothic New", sans-serif';
      var ew = ctx.measureText(effect).width;
      ctx.globalAlpha = 0.88; ctx.fillStyle = T.bg; ctx.fillRect(CX0 + 3, CY0 - 3, ew + 6, 18); ctx.globalAlpha = 1;
      txt(ctx, effect, CX0 + 6, CY0 + 6, { jp: true, size: 13, color: T.err, align: 'left' });
    }
  }
  // 連続な誤差の線（u: 0〜1、e: µm）を cur 番目まで描く。0 との差を赤く塗る
  function chartLine(ctx, u, e, cur) {
    var X = function (i) { return CX0 + u[i] * (CX1 - CX0); }, i;
    ctx.beginPath(); ctx.moveTo(X(0), cy(0));
    for (i = 0; i <= cur; i++) ctx.lineTo(X(i), cy(e[i]));
    ctx.lineTo(X(cur), cy(0)); ctx.closePath();
    ctx.globalAlpha = 0.25; ctx.fillStyle = T.warn; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = T.err; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    ctx.beginPath(); for (i = 0; i <= cur; i++) { if (i) ctx.lineTo(X(i), cy(e[i])); else ctx.moveTo(X(i), cy(e[i])); } ctx.stroke();
    ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(CX0, cy(0)); ctx.lineTo(X(cur), cy(0)); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(cur), cy(e[cur]), 3.2, 0, 2 * Math.PI); ctx.fillStyle = T.err; ctx.fill();
  }
  // 数字の箱：rows = [{ label, val（null なら —）}]、note = 下の一行
  function numbers(ctx, rows, note) {
    box(ctx, 170, 462, 316, 96, { r: 10, stroke: T.err, lw: 1.5, fill: T.die });
    txt(ctx, '真値', 178, 424, { jp: true, size: 10, weight: 700, color: T.muted });
    txt(ctx, '誤差あり', 268, 424, { jp: true, size: 10, weight: 700, color: T.muted });
    rows.forEach(function (r, j) {
      var y = 442 + j * 27;
      txt(ctx, r.label, 22, y, { jp: true, size: 12, color: T.ink, align: 'left' });
      box(ctx, 178, y, 54, 21, { stroke: T.ideal, lw: 1.3 });
      txt(ctx, r.ideal == null ? '0.0' : r.ideal, 178, y + 0.5, { size: r.ideal != null && String(r.ideal).length > 6 ? 10 : 12, color: T.ideal });
      txt(ctx, '→', 223, y, { jp: true, size: 12, color: T.muted });
      box(ctx, 268, y, 84, 21, { stroke: T.err, lw: 1.3 });
      var vs = r.val == null ? '—' : (typeof r.val === 'string' ? r.val : fx(r.val, r.d == null ? 1 : r.d) + ' ' + (r.unit || 'µm'));
      txt(ctx, vs, 268, y + 0.5, { size: vs.length > 10 ? 10 : 12, color: r.val == null ? T.muted : T.warn });
    });
    txt(ctx, note, 22, 500, { jp: true, size: 10, weight: 500, color: T.muted, align: 'left' });
  }
  // 地の色の札つきの文字（線と重なっても読める）
  function tag(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = '700 ' + (o.size || 10) + 'px "M PLUS 1 Code", ui-monospace, monospace';
    var w = ctx.measureText(String(s)).width + 6, al = o.align || 'center';
    var x0 = al === 'left' ? x - 3 : al === 'right' ? x - w + 3 : x - w / 2;
    ctx.globalAlpha = 0.9; ctx.fillStyle = T.bg; ctx.fillRect(x0, y - 7, w, 14); ctx.globalAlpha = 1;
    txt(ctx, s, x, y, o);
  }
  function prog(t) { return c01((t - T_SWEEP) / SWEEP); }
  function grow(t) { return ease((t - T_GROW) / GROW); }
  function maxAbs(a) { return a.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0); }

  // ---------- 歯 1 枚の拡大図（歯形と粗さで共用） ----------
  var TS = 36, TCX = 170, TBASE = 60;          // 1 mm = 36 px。歯先円が y = 60 付近
  function tScreen(p) { return [TCX - p[1] * TS, TBASE + (G.ra - p[0]) * TS + 6]; }
  function drawTooth(ctx, right, probe, probeName) {
    ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
    [-1, 0, 1].forEach(function (k) {         // 隣の歯も少し見せる
      var a = 2 * Math.PI * k / G.z;
      var act = toothPts(k === 0 ? right : null).map(function (p) { return tScreen(rot(p, a)); });
      var ide = TOOTH0.map(function (p) { return tScreen(rot(p, a)); });
      poly(ctx, act); ctx.lineTo(act[act.length - 1][0], 260); ctx.lineTo(act[0][0], 260);
      ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fill(); ctx.globalAlpha = 1;
      poly(ctx, act); ctx.strokeStyle = T.err; ctx.lineWidth = k === 0 && right && right.length > 200 ? 1.6 : 2.4; ctx.stroke();
      poly(ctx, ide); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.3; ctx.stroke();
    });
    if (probe) {                               // probe = [点, 法線]（mm）
      var c = tScreen([probe[0][0] + probe[1][0] * 0.13, probe[0][1] + probe[1][1] * 0.13]);
      ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + 34, c[1] - 22); ctx.stroke();
      ctx.beginPath(); ctx.arc(c[0], c[1], probeName === '触針' ? 2.2 : 0.13 * TS, 0, 2 * Math.PI); ctx.fillStyle = T.ink; ctx.fill();
      txt(ctx, probeName, Math.min(c[0] + 36, 282), Math.max(c[1] - 30, 46), { jp: true, size: 9, color: T.ink, align: 'left' });
    }
    ctx.restore();
  }
  var I_FORM = FL.findIndex(function (p) { return Math.hypot(p[0], p[1]) >= G.r_form - 1e-9; });

