/* ══════════════════════════════════════════════════════════════════
   l7_pool.js · 案例成本池定义（⚠️ **讲师端专用**）
   ──────────────────────────────────────────────────────────────────
   ⚠️⚠️ 这个文件**只加在讲师端 HTML**（`l7_prototype_v0.4_instructor.html`），
        学员端（`l7_prototype_v0.4_student.html`）**不加载**。
        理由:它含 `C₀` / `P_opt` 与逐项金额,而「**过杀与漏检流出的钱必须由学员
        自己问出来,才进得了他的账**」正是 #05 的教学胜负手（`C130` ① / F1 口径）。
        放在共享文件里再靠"界面不渲染"防泄漏**不算隔离** —— 学员端 F12 一敲
        `FDE_POOL` 就全看见了。所以做**物理隔离**:文件不进学员端。
   ──────────────────────────────────────────────────────────────────
   来源:`11_客户卡_05_精工机械_v1.5.md` §6 **逐字**;
        金额由 `_L7_prototype/_test/calc_c05_pool.py` **实算**（不接受手写估计值,同卡 §6 做法）。
   ⚠️ 五项池的**可见性分层**（本案例的核心设计,不是遗漏）:
        · ① 废品返工 / ② 停线罚款  → 卡面**直接可见**（合起来就是 `C₀`）
        · ③ 漏检流出 / ④ 过杀 / ⑤ 质检人力 → **必须访谈或追问才拿得到**（卡里给参数,不给金额）
        ⇒ `Δ上限` 取**「本单元可影响池」**（= ③④⑤,¥4,953.8 万）—— **2026-09-30 B 方案**;
          学员若只算 ①②(卡面可见的 ¥8,920 万),分子分母都错位 ⇔ 卡 §6 记录的 55.5% 虚高对照。
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var POOL = {
    /* C03 是「会话型」（V / A / A′ / c / k / M）——**没有成本池**。
       保留 null 占位,以便前端统一 `FDE_POOL.of(caseId)` 取用时不炸。 */
    C03: null,

    C05: {
      case_id: 'C05', name: '精工机械',
      model: 'pool',              /* 核算形状:件数 × 率 × 价值 */
      /* ⭐ `Δ上限` 的取数口径 —— **2026-09-30 周全重新裁定（B 方案）**:
         取「本单元可影响池」`movable_sum`（候选 A = ③④⑤ = ¥4,953.8 万），**不再取全池 `P_opt`**。
         为什么改（实现 §5.5 时浮出来的后果）:候选 A 的参数只覆盖 ③④⑤;①② 的"能被影响多少"
         卡里**没有依据** ⇒ 若用 `P_opt` 作分母,诚实满分方案的兑现率天花板只有 **35.7%**,
         且与 C03（可达 ~100%）**跨案例不可比**（价值分要按案例归一化才可比）。
         ⇒ 改后满分可达 100%;学员若把 ①② 也声明进 Δ ⇒ 兑现率 >100%,
           由 `l7_core.js` 的 `valueRatePool()` **截断到 100%**;原始值 `raw` 保留在讲师侧,
           用于识别"把不可影响的项也算进来"的虚报。 */
      upperFrom: 'movable_sum',
      items: [
        { key: 'scrap', no: '①', name: '废品与返工年损失', visible: true, val: 62000000,
          how: 'F₀（卡 §6 ①）' },
        { key: 'stop', no: '②', name: '停线罚款', visible: true, val: 27200000,
          how: 'D × p = 340h × ¥8 万（卡 §6 ②）' },
        { key: 'escape', no: '③', name: '漏检流出成本', visible: false, val: 6233976,
          how: 'Q(1−y) × 2.1% × ¥420/件 = 706,800 件 × 2.1% × ¥420（卡 §6 ③）' },
        { key: 'overkill', no: '④', name: '过杀成本', visible: false, val: 39200000,
          how: '合格件 × 1.4% × 满件价值 = 1,169.32 万件 × 1.4% × ¥239.4554/件（卡 §6 ④）' },
        { key: 'labor', no: '⑤', name: '质检人力', visible: false, val: 4104000,
          how: 'N × 250 天 × 8h × 60min × c = 18 人 × 250 × 480 × ¥1.9（卡 §6 ⑤）' }
      ],
      /* 候选 A（焊点/涂装视觉质检 = 卡 §4 胜负手 / `1091` §5 主推）**能影响**哪几项。
         ⚠️ ①② 的"能被影响多少"**卡里没有参数** ⇒ 一律不计入 Δ（宁少不编）。
         这也是「候选 B/C/D 各做一套核算」被否掉的原因:参数只有 A 的。 */
      movable: ['escape', 'overkill', 'labor'],
      C0: 89200000,               /* 卡 §6:①② 合计 = ¥8,920 万/年 */
      P_opt: 138737976,           /* 实算(calc_c05_pool.py):五项合计 = ¥13,873.8 万/年 */
      movable_sum: 49537976,      /* ③④⑤ = ¥4,953.8 万/年 */
      ceiling_note: 'Δ上限 取「本单元可影响池」¥4,953.8 万（③④⑤，2026-09-30 B 方案）'
        + ' ⇒ 满分方案的兑现率可达 **100%**。'
        + '⚠️ ①②（¥8,920 万）**不进 Δ上限** —— 候选 A 的参数覆盖不到它们,卡里也没有'
        + '"AI 能影响多少"的依据（宁少不编）。学员若把 ①② 也算进 Δ,兑现率会超 100%,'
        + '`valueRatePool()` 截断到 100%,**原始值留给讲师侧看虚报**。'
        + '全池 `P_opt`（¥13,873.8 万）仍保留:用于讲师讲解"学员起手能算出多少"与卡 §6 的 55.5% 对照。'
    }
  };

  /* ── 逐项对账 ──────────────────────────────────────────────────────
     把池常量与 `BASE.C05` 的**原始参数**复算一遍,不一致就报出来 ——
     防的是"卡改了、池没跟着改"这类静默漂移（本机 SSD 会突然死机,
     断面重续时要能一眼看出模型与卡是否还同源）。
     返回 `[]` 表示一致。⚠️ 只在讲师端可用（要 FDE_ROUNDS）。 */
  function audit(caseId) {
    var rd = root.FDE_ROUNDS;
    if (!rd) { return ['FDE_ROUNDS 未加载,无法对账']; }
    var b = rd.base(caseId), p = POOL[caseId];
    if (!p || !b) { return []; }
    var good = b.Q * b.yield_rate;
    var want = {
      scrap: b.F0,
      stop: b.D * b.p,
      escape: b.Q * (1 - b.yield_rate) * b.escape_rate * b.escape_cost,
      overkill: good * b.overkill_rate * (b.REV / good),
      labor: b.N * b.workdays * b.hours_per_day * 60 * b.c
    };
    var out = [];
    p.items.forEach(function (it) {
      var v = want[it.key];
      if (v === undefined) { out.push(it.key + ':BASE 缺参数,无法对账'); return; }
      if (Math.abs(v - it.val) > 1) {
        out.push(it.key + ' 不一致:池常量 ' + it.val + ' vs 参数复算 ' + Math.round(v));
      }
    });
    var sum = p.items.reduce(function (s, it) { return s + it.val; }, 0);
    if (Math.abs(sum - p.P_opt) > 1) { out.push('P_opt 与五项合计不符:' + sum + ' vs ' + p.P_opt); }
    return out;
  }

  /* ── 学员逐项声明 vs 池定义:按**金额**对账(±5% 容差)────────────────
     为什么不按名字:学员是自己**拟项名**的("好件误判损失"/"误判报废"),键名对不上 ——
     但"这笔钱有没有被算出来"是客观的 ⇒ **金额**才是可比的那一维。
     ⚠️ 本函数在**讲师侧**运行(池定义只在讲师端加载),学员端拿不到池项名。
     返回:
       · per_row[i]  —— 与传入 rows 一一对应:{row, item|null}(给界面逐行判定用)
       · hit         —— {key: {row, item}} 命中的池项
       · missed      —— 可影响池里**没被列进来**的项(③④⑤)← 教学胜负手
       · outOfScope  —— 学员把**影响不到**的项(①②)也算进来了 ⇒ 虚报信号
       · unknown     —— 金额对不上任何池项:自造口径 / 单位错 / 算错,需人工看 */
  var TOL = 0.05;
  function classify(caseId, rows) {
    var p = POOL[caseId];
    if (!p) { return null; }
    rows = rows || [];
    var m = function (v) {
      if (v === null || v === undefined || v === '' || isNaN(v)) { return null; }
      return p.items.filter(function (it) {
        return it.val > 0 && Math.abs(it.val - Number(v)) / it.val <= TOL;
      })[0] || null;
    };
    var hit = {}, unk = [], perRow = [];
    rows.forEach(function (r) {
      var it = m(r.C0);
      perRow.push({ row: r, item: it });
      if (it) { if (!hit[it.key]) { hit[it.key] = { row: r, item: it }; } }
      else { unk.push(r); }
    });
    return {
      hit: hit, unknown: unk, per_row: perRow, tol: TOL,
      missed: p.items.filter(function (it) { return p.movable.indexOf(it.key) >= 0 && !hit[it.key]; }),
      outOfScope: p.items.filter(function (it) { return p.movable.indexOf(it.key) < 0 && hit[it.key]; })
    };
  }

  root.FDE_POOL = {
    all: POOL,
    of: function (caseId) { return POOL[caseId] || null; },
    itemsOf: function (caseId) { var p = POOL[caseId]; return p ? p.items : []; },
    upper: function (caseId) { var p = POOL[caseId]; return p ? p[p.upperFrom] : null; },
    classify: classify,
    audit: audit
  };
})(window);
