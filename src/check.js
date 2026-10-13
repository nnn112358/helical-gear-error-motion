// node check.js gN : 共通データ＋ページの計算を node で回し、ページの CHECK() が返す数字を出す
var fs = require('fs'), path = require('path'), g = process.argv[2];
var src = fs.readFileSync(path.join(__dirname, '_problem.js'), 'utf8').replace('/*GEAR_JSON*/null', fs.readFileSync(path.join(__dirname, 'gear.json'), 'utf8'));
var meta = JSON.parse(fs.readFileSync(path.join(__dirname, g + '.json'), 'utf8'));
src += (meta.include || []).map(function (f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); }).join('');
var gsrc = fs.readFileSync(path.join(__dirname, g + '.js'), 'utf8');
var calc = gsrc.indexOf('// ---------- 計算 ----------') >= 0 ? gsrc.slice(gsrc.indexOf('// ---------- 計算 ----------'), gsrc.indexOf('// ---------- 計算ここまで ----------')) : '';
var stub = 'var PANELS = {}, ARIA = {}, LEAD = "";';
new Function('module', 'require', 'console', src + stub + calc + '; if (typeof CHECK === "function") console.log(JSON.stringify(CHECK(), null, 1));')(undefined, require, console);
