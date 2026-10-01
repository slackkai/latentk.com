"""Rebuild original teaching figures. Python + Matplotlib; no downloaded artwork.

Counts come from the article's CSV, geometry from its stated correspondences.
All examples are constructed. SVGs are content assets, PNGs are local QA copies.
"""
from pathlib import Path
import csv
import math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Patch

ROOT = Path(__file__).resolve().parents[1]
PAPER, INK, BLUE, ORANGE, GRID = "#fbfaf6", "#263044", "#3b4f9e", "#bc5635", "#dddeda"
plt.rcParams.update({"font.family": "Microsoft YaHei", "font.size": 12,
                     "svg.fonttype": "none", "axes.edgecolor": GRID,
                     "text.color": INK, "axes.labelcolor": INK,
                     "xtick.color": INK, "ytick.color": INK,
                     "figure.facecolor": PAPER, "axes.facecolor": PAPER})

def save(fig, rel):
    target = ROOT / "src/content" / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(target, facecolor=PAPER, bbox_inches="tight", pad_inches=.18,
                metadata={"Date": None, "Creator": "LatentK · original constructed example"})
    qa = ROOT / ".shots/figures" / (target.stem + ".png")
    qa.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(qa, dpi=160, facecolor=PAPER, bbox_inches="tight", pad_inches=.18)
    plt.close(fig)

def clean(ax):
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.tick_params(length=0, pad=8)
    ax.set_axisbelow(True)

data = list(csv.DictReader((ROOT / "src/content/academic/success-rate-is-not-evidence/attachments/results.csv").open(encoding="utf-8")))
counts = {(r["policy"], r["scene"]): (int(r["successes"]), int(r["trials"])) for r in data}
fig, ax = plt.subplots(figsize=(7.5, 2.9))
for y, p in [(1, "A"), (0, "B")]:
    easy, hard = counts[p, "easy"][1], counts[p, "hard"][1]
    ax.barh(y, easy, height=.46, color=BLUE)
    ax.barh(y, hard, left=easy, height=.46, color=ORANGE, hatch="//", edgecolor=PAPER)
    ax.text(easy / 2, y, f"无遮挡 {easy} 次", ha="center", va="center", color="white", fontsize=12)
    if hard >= 20:
        ax.text(easy + hard / 2, y, f"有遮挡 {hard} 次", ha="center", va="center", color="white", fontsize=12)
    else:
        ax.annotate(f"有遮挡 {hard} 次", (easy + hard / 2, y + .24), (85, y + .5),
                    fontsize=11, ha="center", arrowprops={"arrowstyle": "-", "color": ORANGE})
ax.set(yticks=[1, 0], yticklabels=["A 的试卷", "B 的试卷"], xlim=(0, 100), ylim=(-.6, 1.8),
       xticks=[0, 50, 100], xlabel="尝试次数 · 每条长度相同，构成不同")
clean(ax)
fig.tight_layout()
save(fig, "academic/success-rate-is-not-evidence/attachments/test-mix.svg")

fig, ax = plt.subplots(figsize=(7.5, 3.6))
rows = [("A", "easy", "A · 无遮挡"), ("B", "easy", "B · 无遮挡"), ("A", "hard", "A · 有遮挡"), ("B", "hard", "B · 有遮挡")]
z = 1.959963984540054
for y, (p, scene, label) in enumerate(reversed(rows)):
    k, n = counts[p, scene]
    rate = k / n
    den = 1 + z*z/n
    center = (rate + z*z/(2*n))/den
    rad = z*math.sqrt(rate*(1-rate)/n + z*z/(4*n*n))/den
    lo, hi = center-rad, center+rad
    color = BLUE if p == "A" else ORANGE
    ax.plot([100*lo, 100*hi], [y, y], color=color, linewidth=3)
    ax.scatter([100*rate], [y], s=80, color=color, marker="o" if p == "A" else "D", zorder=3)
    ax.text(102, y, f"{k}/{n}", va="center", fontsize=11)
ax.set(yticks=range(4), yticklabels=[r[2] for r in reversed(rows)], xlim=(0, 115),
       xticks=[0, 25, 50, 75, 100], xticklabels=["0%", "25%", "50%", "75%", "100%"],
       xlabel="点：观测成功率　线：各层 95% Wilson 区间")
ax.xaxis.grid(True, color=GRID, linewidth=.6)
clean(ax)
fig.tight_layout()
save(fig, "academic/success-rate-is-not-evidence/attachments/uncertainty.svg")

fig, ax = plt.subplots(figsize=(7.5, 3.5))
w = [i/100 for i in range(101)]
ax.plot(w, [100*(.9*x+.2*(1-x)) for x in w], color=BLUE, linewidth=2.5, label="A")
ax.plot(w, [100*(.95*x+.3*(1-x)) for x in w], color=ORANGE, linewidth=2.5, linestyle="--", label="B")
ax.axvline(.5, color=INK, linewidth=1, linestyle=":")
for val, color, label, offset in [(55, BLUE, "A 55%", -16), (62.5, ORANGE, "B 62.5%", 14)]:
    ax.scatter([.5], [val], color=color, s=55)
    ax.annotate(label, (.5, val), (.55, val+offset), fontsize=12,
                arrowprops={"arrowstyle": "-", "color": color})
ax.set(xlim=(0,1), ylim=(0,105), xlabel="同一张试卷中，无遮挡任务所占比例 w", ylabel="重加权成功率 / %")
ax.grid(color=GRID, linewidth=.6)
ax.legend(frameon=False, loc="upper left")
clean(ax)
fig.tight_layout()
save(fig, "academic/success-rate-is-not-evidence/attachments/common-test.svg")

fig, ax = plt.subplots(figsize=(5.2, 3.8))
origin, expected, wrong = (.4,-.2), (.2,-.1), (.6,-.3)
for endpoint, color, label, offset in [(expected, BLUE, "应到 (0.2, −0.1)", (-25,24)), (wrong, ORANGE, "实际 (0.6, −0.3)", (10,-28))]:
    ax.annotate("", endpoint, origin, arrowprops={"arrowstyle": "->", "color": color, "lw": 2.5})
    ax.scatter(*endpoint, color=color, s=65)
    ax.annotate(label, endpoint, textcoords="offset points", xytext=offset, fontsize=11,
                ha="right" if color==BLUE else "center")
ax.scatter(*origin, color=INK, s=55)
ax.annotate("C 的原点", origin, textcoords="offset points", xytext=(5,12), fontsize=12)
ax.plot([expected[0],wrong[0]], [expected[1],wrong[1]], color=ORANGE, linestyle=":", linewidth=1.5)
ax.set(xlim=(.05,.8), ylim=(-.45,.05), xlabel="B 中的 x / m", ylabel="B 中的 y / m", aspect="equal")
ax.grid(color=GRID, linewidth=.7)
ax.set_title("同一个输入，两个落点 · 仅画 x–y 俯视图", fontsize=12, pad=15)
clean(ax)
fig.tight_layout()
save(fig, "insight/debugging-coordinate-frames/attachments/target-map.svg")

def box(ax, x, y, w, h, text, color=BLUE, fill="white", size=13):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle="round,pad=0.02,rounding_size=0.06",edgecolor=color,facecolor=fill,lw=1.5))
    ax.text(x+w/2,y+h/2,text,ha="center",va="center",fontsize=size,color=INK,linespacing=1.6)

fig, ax = plt.subplots(figsize=(5.5, 4.8))
ax.set(xlim=(0,6),ylim=(0,5.1));ax.axis("off")
ax.text(.2,4.85,"一次注意力的账本",fontsize=20,fontweight="bold")
ax.text(.2,4.47,"三个位置 · 每行都来自同一份构造数据",fontsize=11)
headers=["位置 1","位置 2","位置 3"]
for i, title in enumerate(headers):
    x=1.85+i*1.3
    ax.text(x,3.93,title,ha="center",fontsize=13,color=BLUE)
for y,label,values in [(3.38,"打分",["0","ln 2","ln 3"]),(2.58,"指数",["1","2","3"]),(1.78,"权重",["1/6","2/6","3/6"]),(0.98,"值 × 权重",["0 × 1/6","3 × 2/6","6 × 3/6"])]:
    ax.text(.18,y+.18,label,fontsize=12,va="center")
    for i,val in enumerate(values): box(ax,1.32+i*1.3,y-.1,1.08,.55,val,size=13)
ax.text(3,.1,"0 + 1 + 3 = 4",ha="center",fontsize=20,color=ORANGE,fontweight="bold")
save(fig,"academic/attention-is-all-you-need/attachments/attention-ledger.svg")

fig, ax = plt.subplots(figsize=(6, 5.1))
ax.set(xlim=(0,6),ylim=(0,5.3));ax.axis("off")
ax.text(.18,5,"三张纸，沿同一个任务走",fontsize=19,fontweight="bold")
for y,num,title,desc,color in [(3.5,"01","系统图","信息从哪里来？动作交给谁？",BLUE),(2,"02","数据说明","一个时刻，哪些量真正配在一起？",ORANGE),(.5,"03","评估卡","怎样才算好？拿谁来作比较？",BLUE)]:
    ax.text(.25,y+.45,num,fontsize=24,color=color)
    box(ax,1.1,y,4.5,1.05,title+"\n"+desc,color=color,size=13)
    if num!="03":ax.annotate("",(3.35,y-.4),(3.35,y-.05),arrowprops={"arrowstyle":"->","color":INK})
save(fig,"library/attachments/embodied-three-sheets.svg")
# Compact compositions for a narrow article column: larger labels, shorter axes.
fig, ax = plt.subplots(figsize=(4.1, 3.1))
for y, p in [(1, "A"), (0, "B")]:
    easy, hard = counts[p, "easy"][1], counts[p, "hard"][1]
    ax.barh(y, easy, height=.58, color=BLUE)
    ax.barh(y, hard, left=easy, height=.58, color=ORANGE, hatch="//", edgecolor=PAPER)
    for at, value in [(easy/2, easy), (easy+hard/2, hard)]:
        ax.text(at,y,str(value),ha="center",va="center",color="white",fontsize=14)
ax.set(yticks=[1,0], yticklabels=["A", "B"], xlim=(0,100), ylim=(-.7,1.7), xticks=[0,50,100], xlabel="每种策略 100 次")
ax.legend(handles=[Patch(color=BLUE,label="无遮挡"),Patch(facecolor=ORANGE,hatch="//",edgecolor=PAPER,label="有遮挡")],ncol=2,frameon=False,loc="upper center",bbox_to_anchor=(.5,1.2),fontsize=12)
clean(ax);fig.tight_layout()
save(fig,"academic/success-rate-is-not-evidence/attachments/test-mix-mobile.svg")

fig, ax = plt.subplots(figsize=(4.1, 3.8))
ax.plot(w,[100*(.9*x+.2*(1-x)) for x in w],color=BLUE,lw=2.5,label="A")
ax.plot(w,[100*(.95*x+.3*(1-x)) for x in w],color=ORANGE,lw=2.5,linestyle="--",label="B")
ax.axvline(.5,color=INK,lw=1,linestyle=":")
for val,color,label,dy in [(55,BLUE,"A 55%",-18),(62.5,ORANGE,"B 62.5%",16)]:
    ax.scatter([.5],[val],color=color,s=50)
    ax.annotate(label,(.5,val),(.62,val+dy),ha="center",fontsize=12,arrowprops={"arrowstyle":"-","color":color})
ax.set(xlim=(0,1),ylim=(0,105),xticks=[0,.5,1],xlabel="共同的无遮挡比例 w",ylabel="重加权成功率 / %")
ax.grid(color=GRID,lw=.6);ax.legend(frameon=False,loc="upper left");clean(ax);fig.tight_layout()
save(fig,"academic/success-rate-is-not-evidence/attachments/common-test-mobile.svg")

fig, ax = plt.subplots(figsize=(4.1, 4.1))
for y,(p,scene,label) in enumerate(reversed(rows)):
    k,n=counts[p,scene];rate=k/n;den=1+z*z/n
    center=(rate+z*z/(2*n))/den;rad=z*math.sqrt(rate*(1-rate)/n+z*z/(4*n*n))/den
    color=BLUE if p=="A" else ORANGE
    ax.plot([100*(center-rad),100*(center+rad)],[y,y],color=color,lw=3)
    ax.scatter([100*rate],[y],s=60,color=color,marker="o" if p=="A" else "D",zorder=3)
    ax.text(104,y,f"{k}/{n}",va="center",fontsize=11)
ax.set(yticks=range(4),yticklabels=[f"{p} · {'易' if s=='easy' else '难'}" for p,s,_ in reversed(rows)],xlim=(0,129),xticks=[0,50,100],xticklabels=["0%","50%","100%"],xlabel="成功率 · 95% Wilson 区间")
ax.set_title("易＝无遮挡；难＝有遮挡",fontsize=12,pad=12)
ax.xaxis.grid(True,color=GRID,lw=.6);clean(ax);fig.tight_layout()
save(fig,"academic/success-rate-is-not-evidence/attachments/uncertainty-mobile.svg")
print("Generated 9 original SVG figures and PNG QA copies.")
