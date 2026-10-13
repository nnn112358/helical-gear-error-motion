// ---------- 問題 ----------（node でも検算できるよう、ここだけで完結させる）
var G = /*GEAR_JSON*/null;
if (typeof module !== 'undefined' && !G) G = require('./gear.json');
var AT = G.at * Math.PI / 180, AN = G.an * Math.PI / 180, BETA = G.beta * Math.PI / 180;

// 誤差の大きさ：JIS B 1702-1:1998（= ISO 1328-1:1995）の 5 級の式に、この歯車の実寸
// （d = 基準円直径, mn, b）をそのまま入れ、10 級に換算（×√2^(10-5)）した「目安」。
// 規格は寸法区分の幾何平均と丸めを使うので、表の値とは少し違う。
var GRADE = 10, QF = Math.pow(2, (GRADE - 5) / 2);
var d = 2 * G.rp, sd = Math.sqrt(d), sm = Math.sqrt(G.mn), sb = Math.sqrt(G.b);
var TOL = {
  fpt: (0.3 * (G.mn + 0.4 * sd) + 4) * QF,       // 単一ピッチ誤差
  Fp: (0.3 * G.mn + 1.25 * sd + 7) * QF,         // 累積ピッチ誤差
  Fa: (3.2 * sm + 0.22 * sd + 0.7) * QF,         // 全歯形誤差
  ffa: (2.5 * sm + 0.17 * sd + 0.5) * QF,        // 歯形形状誤差
  fHa: (2 * sm + 0.14 * sd + 0.5) * QF,          // 歯形勾配誤差
  Fb: (0.1 * sd + 0.63 * sb + 4.2) * QF,         // 全歯すじ誤差
  ffb: (0.07 * sd + 0.45 * sb + 3) * QF,         // 歯すじ形状誤差（= 勾配誤差の式）
  Fr: 0.8 * (0.3 * G.mn + 1.25 * sd + 7) * QF    // 歯溝の振れ
};
TOL.fpb = TOL.fpt * Math.cos(G.at * Math.PI / 180);   // 法線ピッチ誤差（単一ピッチ × cos αt を目安にする）
var RA = 3.2;                                    // 歯面粗さ：Ra 3.2 µm を想定（歯切りのまま程度）

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function range(a) { return Math.max.apply(null, a) - Math.min.apply(null, a); }
function lsq(x, y) {                              // 最小二乗の直線 → [傾き, 切片]
  var n = x.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (var i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; }
  var k = (n * sxy - sx * sy) / (n * sxx - sx * sx); return [k, (sy - k * sx) / n];
}
// 傾き（勾配）＋ うねり（形状）。傾きと形状の大きさを許容値いっぱいにする
function slopeWave(n, H, F, Ftot, cycles, phase) {
  var u = [], e = [], i;
  for (i = 0; i <= n; i++) { u.push(i / n); e.push(F / 2 * Math.sin(2 * Math.PI * cycles * u[i] + phase)); }
  var k0 = lsq(u, e)[0];                          // うねりが持ち込む傾きを差し引き、測った傾きを H にする
  e = e.map(function (v, i) { return v + (H - k0) * (u[i] - 0.5); });
  var sc = Math.min(1, Ftot / range(e));          // 全体（山と谷の差）が全体の許容値を超えないよう縮める
  e = e.map(function (v) { return v * sc; });
  var L = lsq(u, e), res = e.map(function (v, i) { return v - (L[0] * u[i] + L[1]); });
  return { u: u, e: e, total: range(e), slope: L[0], form: range(res) };
}

// 1. 歯形：歯元（インボリュートの始まり）→ 歯先 を転がり長さで測る
var L0 = Math.sqrt(G.r_form * G.r_form - G.rb * G.rb), L1 = Math.sqrt(G.ra * G.ra - G.rb * G.rb);
var PROF = slopeWave(200, TOL.fHa, TOL.ffa, TOL.Fa, 1.3, 0.5);
// 2. 歯すじ：歯幅 0 → b
var HELIX = slopeWave(200, TOL.ffb, TOL.ffb, TOL.Fb, 1.0, -0.6);
// 3. ピッチ：歯ごとの位置ずれ。乱数（シード固定）で作り、単一ピッチの最大を許容値いっぱいにする
var PITCH = (function () {
  var r = rng(7), f = [], i, m = 0;
  for (i = 0; i < G.z; i++) f.push(r() * 2 - 1);
  var mean = f.reduce(function (a, b) { return a + b; }, 0) / G.z;
  f = f.map(function (v) { return v - mean; });               // 1 周すると元に戻る（合計 0）
  f.forEach(function (v) { m = Math.max(m, Math.abs(v)); });
  f = f.map(function (v) { return v / m * TOL.fpt; });
  var F = [0]; for (i = 1; i < G.z; i++) F.push(F[i - 1] + f[i]); // 1 番歯を基準にした位置ずれ（累積）
  return { fpt: f, F: F, fptMax: TOL.fpt, Fp: range(F) };
})();
// 4. 偏心：歯車の中心が回転軸から e ずれる。歯溝に入れた球の高さが 1 回転で 1 周期ゆれる
var RUN = (function () {
  var e = TOL.Fr / 2, r = [];
  for (var k = 0; k < G.z; k++) r.push(e * Math.cos(2 * Math.PI * k / G.z));
  return { e: e, r: r, Fr: range(r) };
})();
// 5. 粗さ：歯面に沿って 4 mm なぞる。工具の送り目（周期 0.25 mm）＋細かい乱れ。Ra を 3.2 µm に合わせる
var ROUGH = (function () {
  // なぞる長さ = インボリュート歯面の長さ（= (L1² − L0²) / 2rb）
  var n = 800, len = (L1 * L1 - L0 * L0) / (2 * G.rb), r = rng(11), y = [], i, noise = 0;
  for (i = 0; i <= n; i++) {
    var s = i / n * len; noise = 0.75 * noise + 0.25 * (r() * 2 - 1);
    y.push(Math.abs(Math.sin(Math.PI * s / 0.25)) * 2 - 1.27 + 1.6 * noise);
  }
  var mean = y.reduce(function (a, b) { return a + b; }, 0) / y.length;
  y = y.map(function (v) { return v - mean; });
  var ra = y.reduce(function (a, b) { return a + Math.abs(b); }, 0) / y.length;
  y = y.map(function (v) { return v / ra * RA; });
  return { y: y, len: len, Ra: y.reduce(function (a, b) { return a + Math.abs(b); }, 0) / y.length, Rz: range(y) };
})();


// 6. うねり：歯面に沿った、粗さより波長の長い波（波長 0.6〜1.2 mm）。規格の許容値は無いので、最大高さ 6 µm を想定
var WAVE = (function () {
  var n = 800, len = ROUGH.len, y = [], i;
  for (i = 0; i <= n; i++) { var s = i / n * len; y.push(Math.sin(2 * Math.PI * s / 1.15 + 0.4) + 0.45 * Math.sin(2 * Math.PI * s / 0.62 + 1.3)); }
  var sc = 6 / range(y); y = y.map(function (v) { return v * sc; });
  return { y: y, len: len, Wt: range(y) };
})();
