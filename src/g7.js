  // ---------- 計算 ----------
  // 同じ歯車 2 枚（諸元 G、設計のバックラッシ 0）をかみ合わせる
  var A0 = 2 * G.rp;                         // 真値の中心距離 [mm]
  var DA = 0.050;                            // 中心距離の誤差：+50 µm を想定
  var PBT = Math.PI * G.mt * Math.cos(AT);   // 正面の法線ピッチ
  function epsA(a) {                         // かみ合い率（同じ歯車どうし）
    var aw = Math.sqrt(a * a - 4 * G.rb * G.rb);   // a·sin αw
    return (2 * Math.sqrt(G.ra * G.ra - G.rb * G.rb) - aw) / PBT;
  }
  var AWT = Math.acos(A0 * Math.cos(AT) / (A0 + DA));        // 離したときのかみ合い圧力角
  var JT = 2 * DA * Math.tan(AWT) * 1000;                     // 円周方向のバックラッシ [µm]
  var BB = Math.atan(Math.tan(BETA) * Math.cos(AT));          // 基礎円筒ねじれ角
  var JN = JT * Math.cos(AWT) * Math.cos(BB);                 // 法線方向のバックラッシ [µm]
  var EA0 = epsA(A0), EA1 = epsA(A0 + DA);
  // バックラッシをかみ合いのプログラム（_mesh.js：線と線の交点から歯が重ならない位置を求める）で求める。
  // 歯車1 を回し、歯車2 を駆動側の歯面が当たる角度と反対側が当たる角度まで回して、その差を基準円上の長さにする
  var IG = makeGear({}), NB = 60, BL = [];
  for (var ib = 0; ib <= NB; ib++) {
    var thb = (2 * Math.PI / 6) * ib / NB, pb = { c: [0, 0], th: thb }, pnb = phiNominal(thb);
    BL.push((contactAngle(IG, pb, IG, [A0 + DA, 0], pnb, 'L') - contactAngle(IG, pb, IG, [A0 + DA, 0], pnb, 'R')) * G.rp * 1000);
  }
  var JT_FORMULA = JT;                                        // 近似式 2Δa·tanαwt（確かめ用）
  JT = BL.reduce(function (p, q) { return p + q; }, 0) / BL.length;
  JN = JT * Math.cos(AWT) * Math.cos(BB);
  // 軸の平行度：ISO/TR 10064-3 の推奨値（目安）。L = 軸受スパン 60 mm を想定
  var LSPAN = 60;
  var FSB = 0.5 * (LSPAN / G.b) * TOL.Fb;    // ねじれ方向 fΣβ [µm]（軸受スパン L あたり）
  var FSD = 2 * FSB;                          // 同一平面内 fΣδ [µm]
  // 歯幅方向の歯面のすき間（作用面内）。同一平面内の傾きは中心距離の変化 → sin αwt 倍、
  // ねじれの傾きは円周方向のずれ → cos αwt 倍で作用面に効く
  var KD = FSD / LSPAN * Math.sin(AT), KB = FSB / LSPAN * Math.cos(AT);   // [µm/mm]
  var ELASTIC = 5;                            // 荷重で歯が縮んで埋まるすき間：5 µm を想定
  function gapLine(k) { var u = [], e = [], n = 200; for (var i = 0; i <= n; i++) { u.push(i / n); e.push(k * G.b * i / n); } return { u: u, e: e }; }
  var GD = gapLine(KD), GB = gapLine(KB);
  var CD = Math.min(G.b, ELASTIC / KD), CB = Math.min(G.b, ELASTIC / KB);  // 当たり幅 [mm]
  YR = Math.ceil(Math.max(DA * 1000, KD * G.b, KB * G.b) * 1.15 / 10) * 10;
  function CHECK() {
    return { A0: A0, JT: JT, JT_range: range(BL), JT_formula: JT_FORMULA, JN: JN, EA0: EA0, EA1: EA1, FSB: FSB, FSD: FSD,
             gapD: KD * G.b, gapB: KB * G.b, contactD: CD, contactB: CB, YR: YR };
  }
  // ---------- 計算ここまで ----------

  var f1 = function (v) { return fx(v, 1); };

  // ----- 1. 中心距離の誤差：かみ合い部分を拡大。右の歯車が離れて、歯の両側にすき間が開く -----
  PANELS.ca = function (ctx, t) {
    var K = 50, g = grow(t), u = prog(t), S = 9, MX = 170, MY = 140;
    var th = 2 * Math.PI * u / 6;                       // 1/6 回転ぶん回して見せる
    var aV = A0 + K * g * DA;                           // 絵の中心距離（ずれ ×50）
    var scr = function (p) { return [MX + (p[0] - A0 / 2) * S, MY - p[1] * S]; };
    viewFrame(ctx, 'かみ合い部分を拡大・左が駆動側', K);
    ctx.save(); rr(ctx, 13, 33, 314, 218, 6); ctx.clip();
    var p1 = { c: [0, 0], th: th }, pn = phiNominal(th);
    // 歯車2 の角度：駆動側の歯面（歯車1 が押す側）がちょうど当たる角度をプログラムで求める
    var ph2 = contactAngle(IG, p1, IG, [aV, 0], pn, 'L');
    var g1 = gearOutline(IG, p1).map(scr), g2a = gearOutline(IG, { c: [aV, 0], th: ph2 }).map(scr), g2i = gearOutline(IG, { c: [A0, 0], th: pn }).map(scr);
    // 歯車1（駆動、位置は変わらない）は灰色、離れた歯車2 は橙
    poly(ctx, g1); ctx.closePath(); ctx.globalAlpha = 0.18; ctx.fillStyle = T.muted; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = T.muted; ctx.lineWidth = 1.8; ctx.stroke();
    poly(ctx, g2a); ctx.closePath(); ctx.globalAlpha = 0.16; ctx.fillStyle = T.err; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = T.err; ctx.lineWidth = 2.2; ctx.stroke();
    poly(ctx, g2i); ctx.closePath(); ctx.setLineDash([3, 3]); ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    txt(ctx, '← 歯車1（駆動・灰）の中心へ', 22, 236, { jp: true, size: 9, color: T.muted, align: 'left' });
    txt(ctx, '歯車2（橙）の中心へ →', 318, 236, { jp: true, size: 9, color: T.err, align: 'right' });
    tag(ctx, '緑の点線＝設計の中心距離のときの歯車2', 170, 46, { size: 9, color: T.muted });
    tag(ctx, 'a ' + fx(A0, 3) + ' → ' + fx(A0 + DA * g, 3) + ' mm', 170, 222, { size: 10, color: g > 0.01 ? T.err : T.ink });
    CHART_TITLE = 'バックラッシ jt（µm、実寸）';
    chartFrame(ctx, '0°', '60°', '回転角', '', t);
    CHART_TITLE = '測定チャート（µm、実寸）';
    var cur = Math.round(u * NB), us = BL.map(function (_, k) { return k / NB; });
    if (t >= T_SWEEP) chartLine(ctx, us, BL, cur);
    if (t >= END) tag(ctx, '回っても一定', CX0 + 8, cy(JT / 2), { size: 12, color: T.err, align: 'left' });
    numbers(ctx, [
      { label: 'バックラッシ jt', val: t >= T_SWEEP ? BL[cur] : null },
      { label: 'かみ合い率 εα', ideal: fx(EA0, 3), val: t >= END ? fx(EA1, 3) : null }
    ], '想定 Δa = +' + f1(DA * 1000) + ' µm   法線方向 jn = ' + f1(JN) + ' µm');
  };

  // ----- 2・3. 軸の平行度：上に軸と歯車の模式図、下に歯幅方向の歯面のすき間 -----
  function misPanel(kind) {
    var F = kind === 'd' ? FSD : FSB, D = kind === 'd' ? GD : GB, KK = kind === 'd' ? KD : KB, CL = kind === 'd' ? CD : CB;
    return function (ctx, t) {
      var K = 100, g = grow(t), u = prog(t), cur = Math.round(u * (D.u.length - 1));
      viewFrame(ctx, kind === 'd' ? '2本の軸を含む面を見る（模式図）' : '中心を結ぶ向きから見る（模式図）', K);
      // 軸：軸受スパン L = 60 mm を横 260 px に。右の軸受を K 倍ずらす
      var BX0 = 40, BX1 = 300, PXMM = (BX1 - BX0) / LSPAN;
      var ang = Math.atan(K * g * F / 1000 * PXMM / (BX1 - BX0));
      var y1 = kind === 'd' ? 60 : 92, y2 = kind === 'd' ? 108 : 92;
      var gx0 = BX0 + (LSPAN - G.b) / 2 * PXMM, gw = G.b * PXMM;
      function shaft(y, a, col, lw, h0, h1, fillA) {
        var mx = (BX0 + BX1) / 2, hw = (BX1 - BX0) / 2;
        ctx.save(); ctx.translate(mx, y); ctx.rotate(-a);
        ctx.fillStyle = col; ctx.globalAlpha = fillA; ctx.fillRect(-gw / 2, -h0, gw, h0 + h1); ctx.globalAlpha = 1;
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.strokeRect(-gw / 2, -h0, gw, h0 + h1);
        ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(hw, 0); ctx.stroke();
        ctx.fillStyle = col; ctx.fillRect(-hw - 4, -5, 8, 10); ctx.fillRect(hw - 4, -5, 8, 10);
        ctx.restore();
      }
      if (kind === 'd') {
        shaft(y1, 0, T.ink, 1.5, 10, 24, 0.08);
        shaft(y2, ang, T.err, 2.2, 24, 10, 0.16);
        shaft(y2, 0, T.ideal, 1.2, 24, 10, 0);
        txt(ctx, '歯車1', 24, y1 - 12, { jp: true, size: 9, color: T.muted, align: 'left' });
        txt(ctx, '歯車2', 24, y2 + 14, { jp: true, size: 9, color: T.muted, align: 'left' });
      } else {
        shaft(y1, 0, T.ink, 1.5, 26, 26, 0.08);
        shaft(y2, ang, T.err, 2.2, 22, 22, 0.16);
        shaft(y2, 0, T.ideal, 1.2, 22, 22, 0);
        txt(ctx, '奥：歯車1 ／ 手前：歯車2', 24, 136, { jp: true, size: 9, color: T.muted, align: 'left' });
      }
      txt(ctx, '軸受', BX1, 46, { jp: true, size: 9, color: T.muted });
      // 下：歯面のすき間（作用面内、歯幅方向）
      var WX0 = 60, WX1 = 280, WY = 196, PXUM = 1.2;
      txt(ctx, '歯面のすき間（歯幅方向）', 22, 154, { jp: true, size: 10, color: T.muted, align: 'left' });
      txt(ctx, '※ すき間 1 µm = ' + PXUM + ' px', 318, 154, { jp: true, size: 9, color: T.warn, align: 'right' });
      var top = [], i, N = 60;
      for (i = 0; i <= N; i++) top.push([WX0 + (WX1 - WX0) * i / N, WY - g * KK * G.b * i / N * PXUM]);
      poly(ctx, top.concat([[WX1, WY], [WX0, WY]])); ctx.closePath(); ctx.globalAlpha = 0.25; ctx.fillStyle = T.warn; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = T.err; ctx.lineWidth = 2.2; poly(ctx, top); ctx.stroke();
      ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(WX0, WY); ctx.lineTo(WX1, WY); ctx.stroke();
      ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(WX0, WY - 1.5); ctx.lineTo(WX1, WY - 1.5); ctx.stroke();
      txt(ctx, '歯車1の歯面', WX0 - 4, WY + 9, { jp: true, size: 8, color: T.muted, align: 'left' });
      tag(ctx, '歯車2の歯面', WX0 + (WX1 - WX0) * 0.45, WY - g * KK * G.b * 0.45 * PXUM - 9, { size: 8, color: T.err, align: 'right' });
      // 当たりの帯：すき間が ELASTIC 以下のところ
      var cw = (WX1 - WX0) * (1 - g * (1 - CL / G.b));
      txt(ctx, '当たり', 22, 232, { jp: true, size: 9, color: T.muted, align: 'left' });
      ctx.strokeStyle = T.ideal; ctx.lineWidth = 1.3; ctx.strokeRect(WX0, 226, WX1 - WX0, 12);
      ctx.fillStyle = T.err; ctx.globalAlpha = 0.75; ctx.fillRect(WX0, 227, cw, 10); ctx.globalAlpha = 1;
      tag(ctx, fx(G.b * cw / (WX1 - WX0), 1) + ' mm', WX0 + cw + 4, 232, { size: 9, color: T.err, align: 'left' });
      CHART_TITLE = '歯面のすき間（µm、実寸）';
      chartFrame(ctx, '0', G.b + ' mm', '歯幅方向', kind === 'd' ? '当たりが端に寄る' : '当たりが端に寄る（片当たり）', t);
      if (t >= T_SWEEP) {
        ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(CX0, cy(ELASTIC)); ctx.lineTo(CX1, cy(ELASTIC)); ctx.stroke(); ctx.setLineDash([]);
        chartLine(ctx, D.u, D.e, cur);
        tag(ctx, '荷重で埋まる ' + ELASTIC + 'µm（想定）', CX1, cy(ELASTIC) + 9, { size: 8, color: T.muted, align: 'right' });
      }
      numbers(ctx, [
        { label: 'すき間の差（両端）', val: t >= T_SWEEP ? D.e[cur] : null },
        { label: '当たり幅', ideal: fx(G.b, 1) + ' mm', val: t >= END ? fx(CL, 1) + ' mm' : null }
      ], 'ISO/TR 10064-3 の目安 ' + (kind === 'd' ? 'fΣδ = ' + f1(FSD) : 'fΣβ = ' + f1(FSB)) + ' µm（L = ' + LSPAN + ' mm）');
    };
  }
  PANELS.pd = misPanel('d'); PANELS.pb = misPanel('b');

  LEAD = '同じ歯車 2 枚をかみ合わせる。歯の位置は、歯の輪郭の線と線の交点から「歯が重ならずに当たる位置」を求めるプログラムで決めた。中心距離の誤差は +' + f1(DA * 1000) + ' µm を想定。軸の平行度は ISO/TR 10064-3 の推奨値（軸受スパン ' + LSPAN + ' mm を想定した目安）。' +
    '同一平面内の傾きは許される大きさが 2 倍だが、歯面のすき間への効き方は sin αwt 倍と小さい（ねじれは cos αwt 倍）。';
  POINTS = ['軸の間が ' + f1(DA * 1000) + ' µm 広がると、片側の歯面に<em>すき間</em>（バックラッシ ' + f1(JT) + ' µm）が開く。回っても一定',
    '軸が傾くと、歯面のすき間が<em>くさび形</em>になり、<em>当たりが端に寄る</em>',
    '同じ面内の傾きより、<em>ねじれの傾き</em>のほうが当たりを狭くする（' + f1(CD) + ' mm → ' + f1(CB) + ' mm）'];
  ARIA.ca = '中心距離の誤差：中心距離が ' + fx(A0, 3) + ' mm から ' + f1(DA * 1000) + ' µm 離れても、駆動側の歯面は当たったまま回り、反対側の歯面にすき間が開く。円周方向のバックラッシは 0 から ' + f1(JT) + ' µm、法線方向は ' + f1(JN) + ' µm。かみ合い率は ' + fx(EA0, 3) + ' から ' + fx(EA1, 3) + ' に減る。回っても一定。';
  ARIA.pd = '軸の平行度（同一平面内）：軸受スパン ' + LSPAN + ' mm で ' + f1(FSD) + ' µm 傾くと、歯幅 ' + G.b + ' mm の両端で歯面のすき間に ' + f1(KD * G.b) + ' µm の差ができる。荷重で 5 µm 埋まると仮定すると、当たり幅は 16 mm から ' + f1(CD) + ' mm に減る。';
  ARIA.pb = '軸の平行度（ねじれ）：軸受スパン ' + LSPAN + ' mm で ' + f1(FSB) + ' µm 傾くと、歯面のすき間の差は ' + f1(KB * G.b) + ' µm。傾きは同一平面内の半分だが、すき間の差は大きく、当たり幅は ' + f1(CB) + ' mm に減る（片当たり）。';
