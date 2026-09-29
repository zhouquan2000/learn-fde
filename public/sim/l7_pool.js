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
   来源:`11_客户卡_05_精工机械_v1.4.md` §6 **逐字**;
        金额由 `_L7_prototype/_test/calc_c05_pool.py` **实算**（不接受手写估计值,同卡 §6 做法）。
   ⚠️ 五项池的**可见性分层**（本案例的核心设计,不是遗漏）:
        · ① 废品返工 / ② 停线罚款  → 卡面**直接可见**（合起来就是 `C₀`）
        · ③ 漏检流出 / ④ 过杀 / ⑤ 质检人力 → **必须访谈或追问才拿得到**（卡里给参数,不给金额）
        ⇒ `Δ上限` 取 `P_opt`（含 ③④⑤）:学员若只算 ①②,比值**虚高 55.5%**。
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
      upperFrom: 'P_opt',         /* ⭐ `Δ上限` 的取数口径（`C130` ①,2026-09-28 裁定） */
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
      ceiling_note: 'Δ上限 取 P_opt(¥13,873.8 万) ⇒ 即便学员把 ③④⑤ 全问出来且做到完美，'
        + '兑现率天花板也只有 **35.7%**(4,953.8 ÷ 13,873.8)。这是**设计特征**:它逼学员看见'
        + '「你的方案只动了池子的三分之一」,而不是宣称整池收益。'
        + '若改成「A 可影响池」作分母,天花板 = 100% —— ⚠️ **属待周全拍板的口径项**,'
        + '改与不改都能自圆其说,但必须显式选一个。'
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

  root.FDE_POOL = {
    all: POOL,
    of: function (caseId) { return POOL[caseId] || null; },
    itemsOf: function (caseId) { var p = POOL[caseId]; return p ? p.items : []; },
    upper: function (caseId) { var p = POOL[caseId]; return p ? p[p.upperFrom] : null; },
    audit: audit
  };
})(window);
