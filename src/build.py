"""説明ページを 1 枚ずつ組み立てる。

使い方:  uv run python build.py g1        → ../01-*.html
ページのファイル  gN.json（題名・パネル）と gN.js（PANELS / ARIA / LEAD / POINTS / ORDER と、そのページの計算）。
共通: _problem.js（歯車と誤差のデータ）、_common.js（描画部品）、_head.html、_tail.js。
node で数字を確かめるとき:  node check.js gN
"""
import html, json, sys
from pathlib import Path

here = Path(__file__).parent
g = sys.argv[1]
meta = json.loads((here / f"{g}.json").read_text())
prob = (here / "_problem.js").read_text()
prob = prob[:prob.index("if (typeof module !== 'undefined') {\n  var f1")] if "var f1 = function (v) { return v.toFixed(1); };\n  console.log('d'" in prob else prob
prob = prob.replace("/*GEAR_JSON*/null", (here / "gear.json").read_text().strip())
chips = "\n".join(
    f'    <div class="chip"><div class="chip-head"><span class="chip-name">{html.escape(p["name"])}</span>'
    f'<span class="chip-tag">{html.escape(p["tag"])}</span></div><canvas id="cv-{p["key"]}" role="img"></canvas></div>'
    for p in meta["panels"])
head = ((here / "_head.html").read_text().replace("{{TITLE}}", meta["title"]).replace("{{H1}}", meta["h1"])
        .replace("{{LAYOUT}}", meta["layout"]).replace("{{CHIPS}}", chips).replace("{{N}}", str(len(meta["panels"]))))
order = "  var ORDER = " + json.dumps([p["key"] for p in meta["panels"]]) + ";\n"
incl = "".join((here / f).read_text() for f in meta.get("include", []))   # 例: ["_mesh.js"]
body = prob + (here / "_common.js").read_text() + incl + "  var PANELS = {}, ARIA = {}, LEAD = '', POINTS = [];\n" + order + \
    (here / f"{g}.js").read_text()
out = here.parent / meta["file"]
out.write_text(head + body + (here / "_tail.js").read_text())
print(out)
