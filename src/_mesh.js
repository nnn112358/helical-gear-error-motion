  // ---------- かみ合いの計算（線と線の交点から、歯が重ならない位置を求める） ----------
  // 歯車は歯ごとの折れ線（歯面＋歯先）で表す。歯車 B を中心のまわりに回すと、B の各頂点は円弧を描く。
  // その円弧と A の線分の交点（と、A の頂点が B に対して描く円弧と B の線分の交点）のうち、
  // 一番近いものが「当たるまでの回転角」。これを使って
  //   片歯面：駆動側の歯面が当たる角度（＝マスタの回転のおくれ・すすみ）
  //   両歯面：両側の歯面が同時に当たるまで中心距離を縮めた位置
  //   バックラッシ：駆動側が当たる角度と反対側が当たる角度の差
  // を求める。描く歯車もこの計算と同じ折れ線なので、絵の上でも重ならない。
  var MZ = G.z, MP = 2 * Math.PI / G.z;
  // 右歯面（歯底→歯先、y<0）。すみ肉は helical_gear.py の創成歯形、インボリュートの部分は式から 240 点で細かく作る
  // （折れ線の弦の誤差を 0.01 µm 程度に抑えるため）
  var MFL = (function () {
    var inv = function (x) { return Math.tan(x) - x; }, at = G.at * Math.PI / 180, out = [], i;
    var psi0 = Math.PI / (2 * G.z) + inv(at);
    G.flank.forEach(function (p) { if (Math.hypot(p[0], p[1]) < G.r_form - 1e-9) out.push(p); });
    for (i = 0; i <= 240; i++) {
      var r = G.r_form + (G.ra - G.r_form) * i / 240, ps = psi0 - inv(Math.acos(G.rb / r));
      out.push([r * Math.cos(-ps), r * Math.sin(-ps)]);
    }
    return out;
  })();
  var MFN = MFL.map(function (p, i) {                    // 外向きの法線
    var a = MFL[Math.max(0, i - 1)], b = MFL[Math.min(MFL.length - 1, i + 1)];
    var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty), nx = ty / l, ny = -tx / l;
    return ny < 0 ? [nx, ny] : [-nx, -ny];
  });
  var MLR = MFL.map(function (p) { var r = Math.hypot(p[0], p[1]); return r > G.rb ? Math.sqrt(r * r - G.rb * G.rb) : 0; });
  var M_IFORM = MFL.findIndex(function (p) { return Math.hypot(p[0], p[1]) >= G.r_form - 1e-9; });
  var M_L0 = Math.sqrt(G.r_form * G.r_form - G.rb * G.rb), M_L1 = Math.sqrt(G.ra * G.ra - G.rb * G.rb);

  // 歯車を作る。o.K：ずれの倍率、o.prof：歯形のずれ [µm]（u 0〜1 → 関数、両歯面・全歯）、
  // o.pitch：歯 k の位置のずれ [µm]（配列）、o.thin：歯 k の片側の歯面を内側へ動かす量 [µm]（配列、正で薄く）
  function makeGear(o) {
    o = o || {};
    var K = o.K || 0, teeth = [], k, i;
    var dev = function (i) {
      if (!o.prof) return 0;
      var e0 = o.prof(0);
      if (i < M_IFORM) return K * e0 * i / M_IFORM / 1000;
      return K * o.prof((MLR[i] - M_L0) / (M_L1 - M_L0)) / 1000;
    };
    var base = MFL.map(function (p, i) { return dev(i); });
    for (k = 0; k < MZ; k++) {
      var th = o.thin ? K * o.thin[k] / 1000 : 0;
      // 薄くする量は、すみ肉の部分では歯底へ向かって 0 に戻す（歯底円とつながるように）
      var R = MFL.map(function (p, i) { var d = base[i] - th * Math.min(1, i / M_IFORM); return [p[0] + MFN[i][0] * d, p[1] + MFN[i][1] * d]; });
      var L = R.map(function (p) { return [p[0], -p[1]]; });
      // 歯先の円弧を少し足す（歯先の角で当たるときのため）
      var eR = R[R.length - 1], aR = Math.atan2(eR[1], eR[0]), tipR = [], tipL = [];
      for (i = 1; i <= 4; i++) { var a = aR * (1 - i / 4); tipR.push([G.ra * Math.cos(a), G.ra * Math.sin(a)]); }
      tipR.forEach(function (p) { tipL.push([p[0], -p[1]]); });
      teeth.push({ R: R.concat(tipR), L: L.concat(tipL), off: o.pitch ? K * o.pitch[k] / 1000 / G.rp : 0, Rf: R, Lf: L });
    }
    return { teeth: teeth };
  }
  // 描く用の輪郭（歯面＋歯先＋歯底）。gear の姿勢 pose = { c:[x,y], th }
  function gearOutline(gear, pose) {
    var out = [], c = pose.c;
    gear.teeth.forEach(function (tk, k) {
      var a = pose.th + MP * k + tk.off, ca = Math.cos(a), sa = Math.sin(a), i, pts = [];
      tk.Rf.forEach(function (p) { pts.push(p); });
      var eR = tk.Rf[tk.Rf.length - 1], eL = tk.Lf[tk.Lf.length - 1], a0 = Math.atan2(eR[1], eR[0]), a1 = Math.atan2(eL[1], eL[0]);
      for (i = 1; i < 8; i++) { var b = a0 + (a1 - a0) * i / 8; pts.push([G.ra * Math.cos(b), G.ra * Math.sin(b)]); }
      for (i = tk.Lf.length - 1; i >= 0; i--) pts.push(tk.Lf[i]);
      // 次の歯の右歯面の始まりまで歯底円（次の歯のずれも考える）
      var nx = gear.teeth[(k + 1) % MZ], dOff = MP + nx.off - tk.off, s0 = tk.Lf[0], s1 = nx.Rf[0];
      var b0 = Math.atan2(s0[1], s0[0]), b1 = dOff + Math.atan2(s1[1], s1[0]);
      var q0 = Math.hypot(s0[0], s0[1]), q1 = Math.hypot(s1[0], s1[1]);
      for (i = 1; i < 6; i++) { var b2 = b0 + (b1 - b0) * i / 6, rq = q0 + (q1 - q0) * i / 6; pts.push([rq * Math.cos(b2), rq * Math.sin(b2)]); }
      pts.forEach(function (p) { out.push([c[0] + p[0] * ca - p[1] * sa, c[1] + p[0] * sa + p[1] * ca]); });
    });
    return out;
  }
  // かみ合い部分の近くの歯の、片側の歯面（世界座標の折れ線の配列）
  function sideLines(gear, pose, side, toward) {
    var c = pose.c, lines = [];
    for (var k = 0; k < MZ; k++) {
      var tk = gear.teeth[k], a = pose.th + MP * k + tk.off;
      var d = Math.atan2(Math.sin(a - toward), Math.cos(a - toward));
      if (Math.abs(d) > 1.7 * MP) continue;
      var ca = Math.cos(a), sa = Math.sin(a);
      lines.push(tk[side].map(function (p) { return [c[0] + p[0] * ca - p[1] * sa, c[1] + p[0] * sa + p[1] * ca]; }));
    }
    return lines;
  }
  // 中心 cB のまわりに B を dir 向きに回したとき、A に当たるまでの角度（phiMax まで。当たらなければ Infinity）
  function hitAngle(Alines, Blines, cB, dir, phiMax) {
    var best = Infinity;
    function segs(lines) {
      var s = [];
      lines.forEach(function (ln) {
        for (var i = 0; i + 1 < ln.length; i++) {
          var P = ln[i], Q = ln[i + 1], px = P[0] - cB[0], py = P[1] - cB[1], qx = Q[0] - cB[0], qy = Q[1] - cB[1];
          var dx = qx - px, dy = qy - py, l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, -(px * dx + py * dy) / l2)) : 0;
          var rmin = Math.hypot(px + t * dx, py + t * dy), rmax = Math.max(Math.hypot(px, py), Math.hypot(qx, qy));
          s.push([px, py, dx, dy, rmin, rmax]);
        }
      });
      return s;
    }
    // 頂点は 1 つおき（頂点の間で当たる取りこぼしは 0.03 µm 以下。線分は全部使う）
    function verts(lines) { var v = []; lines.forEach(function (ln) { ln.forEach(function (p, i) { if (i % 2 === 0 || i === ln.length - 1) v.push([p[0] - cB[0], p[1] - cB[1]]); }); }); return v; }
    // 半径で分けた入れ物（0.1 mm ごと）で、交わりうる線分だけを調べる
    function binned(s) {
      var bins = [];
      s.forEach(function (g) { for (var b = Math.floor(g[4] * 10); b <= Math.floor(g[5] * 10); b++) (bins[b] || (bins[b] = [])).push(g); });
      return bins;
    }
    function sweep(vs, bins, sgn) {          // 頂点が sgn 向きに回ったとき最初に交わる角度
      vs.forEach(function (v) {
        var r = Math.hypot(v[0], v[1]), list = bins[Math.floor(r * 10)];
        if (!list) return;
        var a0 = Math.atan2(v[1], v[0]);
        for (var j = 0; j < list.length; j++) {
          var g = list[j];
          if (r < g[4] - 1e-12 || r > g[5] + 1e-12) continue;
          var A = g[2] * g[2] + g[3] * g[3], B = 2 * (g[0] * g[2] + g[1] * g[3]), C = g[0] * g[0] + g[1] * g[1] - r * r;
          var D = B * B - 4 * A * C; if (D < 0) continue;
          var sq = Math.sqrt(D);
          [(-B - sq) / (2 * A), (-B + sq) / (2 * A)].forEach(function (t) {
            if (t < -1e-12 || t > 1 + 1e-12) return;
            var x = g[0] + t * g[2], y = g[1] + t * g[3];
            var ph = sgn * (Math.atan2(y, x) - a0);
            ph = ((ph % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            if (ph <= phiMax && ph < best) best = ph;
          });
        }
      });
    }
    var sA = segs(Alines), sB = segs(Blines);
    sweep(verts(Blines), binned(sA), dir);   // B の頂点が回って A の線分に当たる
    sweep(verts(Alines), binned(sB), -dir);  // B から見ると A の頂点は逆向きに回る
    return best;
  }
  // A（姿勢 pA）に対して、中心 cB の B が side 側の歯面で当たる回転角。
  // side 'L'：A が回る向き（反時計回り）に押す側。B は反時計回りに回すとすき間が閉じる。'R' はその逆。
  // phiNom は B の設計どおりの角度。そこから半ピッチ弱ずらした所から回して当てる
  function contactAngle(A, pA, B, cB, phiNom, side) {
    var dir = side === 'L' ? 1 : -1, start = phiNom - dir * 0.45 * MP;
    var towardA = Math.atan2(pA.c[1] - cB[1], pA.c[0] - cB[0]), towardB = Math.atan2(cB[1] - pA.c[1], cB[0] - pA.c[0]);
    var Al = sideLines(A, pA, side, towardB), Bl = sideLines(B, { c: cB, th: start }, side, towardA);
    var h = Math.min(hitAngle(Al, Bl, cB, dir, 0.95 * MP), 0.95 * MP);   // 当たらなければ探す範囲の端
    return start + dir * h;
  }
  // B の設計どおりの角度（A が th 回ったとき。同じ歯数どうし）
  function phiNominal(th) { return Math.PI + MP / 2 - th; }
  // 両側の歯面が同時に当たる中心距離（ばねで押し付けたとき）。
  // gap(a)（左右の当たり角の差、正ならすき間）は a とともに増える。a0 の近くで符号の変わる区間をはさみ、
  // 割線と二分を組み合わせた方法（イリノイ法）で gap = 0 の a を求める
  function tightCenter(A, pA, B, th, a0) {
    function gap(a) {
      var cB = [a, 0], pn = phiNominal(th);
      return contactAngle(A, pA, B, cB, pn, 'L') - contactAngle(A, pA, B, cB, pn, 'R');
    }
    var step = 0.02, lo = a0, flo = gap(lo), hi, fhi, n = 0;
    if (flo > 0) { hi = lo; fhi = flo; do { lo = hi - step; flo = gap(lo); if (flo > 0) { hi = lo; fhi = flo; } step *= 2; } while (flo > 0 && ++n < 20); }
    else { do { hi = lo + step; fhi = gap(hi); if (fhi < 0) { lo = hi; flo = fhi; } step *= 2; } while (fhi < 0 && ++n < 20); }
    var side = 0, x = lo;
    for (var it = 0; it < 60; it++) {
      x = (lo * fhi - hi * flo) / (fhi - flo);
      var fx_ = gap(x);
      if (Math.abs(fx_) < 1e-10 || hi - lo < 1e-7) break;
      if (fx_ > 0) { hi = x; fhi = fx_; if (side === 1) flo /= 2; side = 1; }
      else { lo = x; flo = fx_; if (side === -1) fhi /= 2; side = -1; }
    }
    return x;
  }
