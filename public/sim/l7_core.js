/* ══════════════════════════════════════════════════════════════════
   l7_core.js · learn-fde.com 模拟商战 · 共享核心 v1.0
   ──────────────────────────────────────────────────────────────────
   状态层方案 A-δ:静态站 + localStorage 草稿 + 导出/导入 JSON 提交包
   零服务器 · 零账号 · 零外部依赖(本文件为本地文件,不走任何 CDN)

   内容依据(全部既有定稿,不得改动):
     · 数据契约   → 08_D04 §6.1 五个共享对象
     · 算分公式   → 14_D06 §1 / §2.1–2.3 / §2.4 / §3(G/S)
     · 1–5→0–1   → 14_D06 §2.4:(评分−1)÷4
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var VERSION = '1.0';

  /* ───── 存储键 ───── */
  var KEY = {
    CLASS: 'fde.class',      // 讲师侧:开班配置
    ROUND: 'fde.round',      // 讲师侧:回合发布状态(学员端读)
    DRAFT: 'fde.draft',      // 学员侧:交付物草稿
    SUBS:  'fde.subs',       // 讲师侧:已导入的提交包
    SCORES:'fde.scores',     // 讲师侧:人工分
    NPC:   'fde.npc',        // 讲师侧:P8 甲方质询记录(每组 守住/越界/未答)
    RESULT:'fde.result'      // 讲师侧:算分结果(学员端读)
  };

  /* ───── 成果指纹:不是加密,只防「无意识的一改」─────
     依据 C108 §2.3 待决②b:产物带指纹,讲师巡场抽验。 */
  function fp(str) {
    var h = 5381, i;
    for (i = 0; i < str.length; i++) { h = ((h << 5) + h + str.charCodeAt(i)) | 0; }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function fpOf(obj) { return fp(typeof obj === 'string' ? obj : JSON.stringify(obj)); }

  /* ───── 时间戳(本地,不依赖网络)───── */
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function isoDate() { return stamp().slice(0, 10); }

  /* ═══════════ D06 算分 ═══════════ */

  /* 1–5 → 0–1(D06 §2.4,周全 2026-09-26 裁定 A) */
  function norm(x) {
    if (x === null || x === undefined || x === '' || isNaN(Number(x))) { return null; }
    var v = (Number(x) - 1) / 4;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  /* 带 N/A 的加权和:null 的项不计入,权重在剩余项间归一化。
     ⚠️ 原型行为,待周全确认(见 20_状态层A_设计稿 §4) */
  function wsum(pairs) {
    var tw = 0, acc = 0, used = [], i, w, v;
    for (i = 0; i < pairs.length; i++) {
      w = pairs[i][1]; v = pairs[i][0];
      if (v !== null && v !== undefined) { tw += w; acc += w * v; used.push(pairs[i][2] || i); }
    }
    return { v: tw > 0 ? acc / tw : null, used: used, total_w: tw };
  }

  /* 权重表 —— 逐字对应 14_D06 §2.1–2.3 */
  var W = {
    CORE: { value: 0.45, eng: 0.30, judge: 0.25 },   // §1 C = 价值^.45 × 工程^.30 × 判断^.25
    ENG:  { A: 0.35, B: 0.30, C: 0.20, D: 0.15 },    // §2.2 工程分四子项
    JUDGE:{ A: 0.40, B: 0.30, C: 0.20, D: 0.10 }     // §2.3 判断分四子项
  };

  /* 「率」→ 归一化到 0–1;允许超 1(D06 §2.1 超额不加总分,只标注) */
  function rate(x) {
    if (x === null || x === undefined || x === '' || isNaN(Number(x))) { return null; }
    return Number(x);
  }

  /* 硬红线(D06 §3)④ 项 → G = 0 */
  var HARD_RED = [
    '使用未授权/未脱敏数据',
    '方案违反合规（金发〔2026〕8号红线）',
    '用调优样本冒充独立验收集（809 F05 明确禁止）',
    '提交内容是纯 PPT 无任何可运行产物'
  ];
  /* 软门槛(D06 §3)三项 → 每项 ×0.7 */
  var SOFT_GATE = [
    '主价值类型未声明',
    'PoC 范围未写"不做什么"',
    'F07 决定单缺失'
  ];

  /* 软门槛清单。
     ⚠️ 2026-09-26 修复:**目录(l7_rounds.js)才是权威**,下面这份 SOFT_GATE 只作向后兼容兜底
        (目录未加载时,例如单跑 core 测试)。
     为什么必须做并集:讲师端下拉传的是「当前回合目录里的软门槛」,而 score() 原先只认这份
        写死的 R1 清单 —— 两边字符串不同(连引号「」与 "" 都不同)⇒ indexOf < 0
        ⇒ 软门槛**静默不生效**。S3 走查实伤:选了「软门槛 ×0.7」,总分却没打折(35.0 而非 24.5)。
     与 B13(讲师判据写死 R1)、B8(价值分口径写死)同属一类:把单回合的东西当成全回合通用。 */
  function softGateList() {
    var out = SOFT_GATE.slice();
    var RS = (typeof window !== 'undefined') && window.FDE_ROUNDS;
    if (RS && RS.ORDER) {
      RS.ORDER.forEach(function (k) {
        var sp = RS.spec(k);
        (sp && sp.softGates ? sp.softGates : []).forEach(function (g) {
          if (out.indexOf(g) < 0) { out.push(g); }
        });
      });
    }
    return out;
  }

  /* 主算分入口
     d = { value_rate, eng:{A,B,C,D}, judge:{A,B,C,D}, reds:[], gates:[] }
     返回 { G, val, eng, judge, C, S, total, notes[], extra_value } */
  function score(d) {
    var notes = [], extra_value = false;

    /* ── 三项分 ── */
    var val = rate(d.value_rate);
    if (val !== null && val > 1) { extra_value = true; val = 1; notes.push('发现额外价值（超额不加总分，仅标注 —— D06 §2.1）'); }

    var engR = wsum([[norm(d.eng.A), W.ENG.A, 'engA'], [norm(d.eng.B), W.ENG.B, 'engB'],
                     [norm(d.eng.C), W.ENG.C, 'engC'], [norm(d.eng.D), W.ENG.D, 'engD']]);
    var judR = wsum([[norm(d.judge.A), W.JUDGE.A, 'judA'], [norm(d.judge.B), W.JUDGE.B, 'judB'],
                     [norm(d.judge.C), W.JUDGE.C, 'judC'], [norm(d.judge.D), W.JUDGE.D, 'judD']]);

    var eng = engR.v, judge = judR.v;

    /* ⚠️ 归一化告警(D06 v1.3 §2.3.1):子项留空会让剩余项权重悄悄变大,
       与 D06 字面权重 .40/.30/.20/.10 不再一致 —— 必须显式说出来。 */
    [['工程分', engR, W.ENG], ['判断分', judR, W.JUDGE]].forEach(function (pair) {
      var name = pair[0], r = pair[1], Wl = pair[2];
      var keys = Object.keys(Wl);
      if (r.used.length < keys.length) {
        var missing = keys.filter(function (k) { return r.used.indexOf('eng' + k) < 0 && r.used.indexOf('jud' + k) < 0; });
        var eff = missing.length ? keys.filter(function (k) {
          return r.used.some(function (u) { return u.slice(-1) === k; });
        }).map(function (k) { return (Wl[k] / r.total_w).toFixed(3); }).join(' / ') : '';
        notes.push('⚠️ ' + name + '有 ' + missing.length + ' 个子项未评 → 剩余项权重被归一化为 ' + eff +
                   '(D06 字面权重 ' + keys.map(function (k) { return Wl[k].toFixed(2); }).join('/') + ')');
      }
    });

    /* ── C:加权几何平均(D06 §1)──
       ⚠️ 任一因子为 0 → 总分 0;缺失项(老师未打)按"未评"处理并显式告警 */
    var C = null, missing = [];
    if (val === null) { missing.push('价值分（需 EvalRun 跑出 r，脚本算）'); }
    if (eng === null) { missing.push('工程分'); }
    if (judge === null) { missing.push('判断分'); }
    if (missing.length === 0) {
      /* 0 的幂次 = 0;用 Math.pow 天然得到"任一项为 0 则总分归零" */
      C = Math.pow(val, W.CORE.value) * Math.pow(eng, W.CORE.eng) * Math.pow(judge, W.CORE.judge);
      if (val === 0) { notes.push('价值分为 0 → 几何平均归零（设计意图，非 bug）'); }
      if (eng === 0) { notes.push('工程分为 0 → 几何平均归零'); }
      if (judge === 0) { notes.push('判断分为 0 → 几何平均归零'); }
    }

    /* ── G:门槛系数(D06 §3)── */
    var G = 1, redHit = [];
    (d.reds || []).forEach(function (r) { if (HARD_RED.indexOf(r) >= 0) { G = 0; redHit.push(r); } });
    if (G === 0) {
      notes.push('🔴 硬红线命中 → 总分归零：' + redHit.join(' / '));
    } else {
      var softList = softGateList();
      var soft = (d.gates || []).filter(function (g) { return softList.indexOf(g) >= 0; });
      if (soft.length) {
        G = Math.pow(0.7, soft.length);
        notes.push('🟡 软门槛 ' + soft.length + ' 项 → G = 0.7^' + soft.length + ' = ' + G.toFixed(4));
      }
    }

    /* ── S:稳定系数(D06 §3)──
       单回合(R1)时 S = 1.0;完整版 R1–R5 后 3 回合权重是前 2 回合的 2 倍 */
    var S = (d.S === undefined || d.S === null) ? 1.0 : Number(d.S);

    /* ── 总分:乘法,不是加法(D06 §1)── */
    var total = null;
    if (C !== null) { total = G * C * S; }

    return {
      val: val, eng: eng, judge: judge,
      eng_detail: engR, judge_detail: judR,
      C: C, G: G, S: S, total: total,
      extra_value: extra_value, notes: notes,
      missing: missing,
      red_hit: redHit
    };
  }

  /* ═══════════ 存储 ═══════════ */
  function put(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); return true; } catch (e) { return false; } }
  function get(k, dflt) {
    try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : (dflt === undefined ? null : dflt); }
    catch (e) { return dflt === undefined ? null : dflt; }
  }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* ═══════════ 提交包(δ 的核心)═══════════
     一个 .json 文件 = 学员侧的完整产出,讲师侧导入即可算分 */
  function makePackage(sub) {
    var body = {
      schema: 'fde.deliverable/' + VERSION,
      exported_at: stamp(),
      round: sub.round,
      team_id: sub.team_id,
      team_name: sub.team_name || '',
      case_id: sub.case_id,
      items: sub.items || [],
      gates_passed: sub.gates_passed || [],
      eng_self: sub.eng_self || {},     // 学员自评(仅供参考,不作为评分输入)
      judge_self: sub.judge_self || {}, // 同上
      artifacts: sub.artifacts || {},   // EvalRun / CostModel 产物
      /* P8 甲方质询预演应答(2026-09-26 加,可选、向后兼容):
         ⚠️ 为什么不放进 items[] —— D04 定的交付物是 41 项(7+10+9+8+7),质询应答**不是交付物**,
            它是**判断分 B 项(组织/越权识别,权重 .30)的判分证据**。混进 items 会直接污染
            三项分的输入(旧包也仍能验签:不带此字段的 body 原样不变,指纹照旧匹配)。 */
      npc_answers: sub.npc_answers || []
    };
    /* 🧪 演练样本标记（2026-09-27 加）—— ⚠️ **条件化**:不带这个字段时 body 逐字节不变,
       所以**历史包的指纹照旧匹配**（与 npc_answers 同一套向后兼容做法）。
       存在的理由:未开班时 `round` 是空的 ⇒ 提交包无法归档,所以正常导出被锁住(周全裁定:A)。
       但**开班前必须能测通「填表→导出→导入判分」整条链路** ⇒ 需要一个明确标着"这是演练"的包:
       讲师端一眼认得出、且**不计入判分与排名**。 */
    if (sub.dry_run) { body.dry_run = true; }
    body.fingerprint = fpOf(body);
    return body;
  }

  function verifyPackage(pkg) {
    if (!pkg || !pkg.fingerprint) { return { ok: false, why: '缺少指纹字段' }; }
    var copy = JSON.parse(JSON.stringify(pkg));
    delete copy.fingerprint;
    var expect = fpOf(copy);
    if (expect !== pkg.fingerprint) { return { ok: false, why: '指纹不符（期望 ' + expect + '，实为 ' + pkg.fingerprint + '）', expect: expect }; }
    return { ok: true };
  }

  /* ═══════════ 回合时钟(真算,不写死)═══════════
     依据 C112:学员端 P1 的「剩余 02:47:12 / 04:00:00 / 进度 31%」原是**写死的假数**
     (与 B4/B12/B14/B15 同类的「静态度量冒充实际状态」)。
     真实依据其实本来就有:讲师端发布回合时已写 `published_at`;再补一个 `minutes`(回合时限)
     即可算出真剩余。**⚠️ 没有时限配置时返回 null,由界面显示「未设时限」——
     绝不 fallback 到一个"看着像真的"默认值,那正是要修的病。** */
  function parseStamp(s) {
    if (!s || typeof s !== 'string') { return null; }
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (!m) { return null; }
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }
  function roundClock(rnd, now) {
    rnd = rnd || {};
    var mins = Number(rnd.minutes);
    var start = parseStamp(rnd.published_at);
    if (!mins || mins <= 0 || !start) { return null; }
    now = now || new Date();
    var total = mins * 60 * 1000;
    var used = now.getTime() - start.getTime();
    if (used < 0) { used = 0; }
    var left = Math.max(0, total - used);
    var pct = Math.min(100, Math.max(0, Math.round(used / total * 100)));
    var sec = Math.floor(left / 1000), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return {
      left: pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60),
      total: pad(Math.floor(mins / 60)) + ':' + pad(mins % 60) + ':00',
      pct: pct,
      expired: left <= 0,
      closed: rnd.open === false
    };
  }

  /* ═══════════ 收益核算(06 §5 公式,平台算不给手填)═══════════
     ⚠️ 为什么放在 core 而不是界面里(D04 §6.4 的原意):
       价值分 = Δ实际 ÷ Δ上限,而 Δ 由 5 个参数决定。学员若能在界面里
       **直接填 Δ**,就等于能直接填价值分 —— 那正是 §6.4 约束③ 要堵的。
       所以:界面只收**原始参数**(V/A/A′/c/k/M/r),Δ 一律由这里算出来。

     公式逐字取自 `06_收益核算模型_v0.1.md` §5.1–5.3:
       C₀ = V × A × c                                  (现状月成本)
       C₁ = V(1−r)A′c + V·r·k + M                       (上线后月成本)
       Δ  = C₀ − C₁                                     (月收益)
     ⚠️ `r` 不在这里收 —— 它只能来自 EvalRun(D04 §6.2 约束①),
        见 evalRate():从 `sub.artifacts.eval.metrics.r` 读,读不到就是 null。 */
  function computeCost(inp, r) {
    inp = inp || {};
    var V = Number(inp.V), A = Number(inp.A), Ap = Number(inp.Ap),
        c = Number(inp.c), k = Number(inp.k), M = Number(inp.M);
    r = (r === null || r === undefined || r === '') ? null : Number(r);
    var missing = [];
    if (!(V > 0)) { missing.push('V'); }
    if (!(A > 0)) { missing.push('A'); }
    if (!(Ap > 0)) { missing.push('A′'); }
    if (!(c > 0)) { missing.push('c'); }
    if (!(k >= 0)) { missing.push('k'); }
    if (!(M >= 0)) { missing.push('M'); }
    if (r === null || !(r >= 0) || r > 1) { missing.push('r'); }
    /* C₀ 只依赖 V/A/c —— **即使 r 还没来(EvalRun 未产出)也应先算出来给学员看**:
       客户卡 §6 自己就公布了 `C₀ = 2,100,000 × 4.17 × 2.2 ≈ ¥19,265,000`,这一步不需要 r。
       全都不显示会让学员以为「什么都算不了」,实际只是 r 没来。 */
    var C0 = (V > 0 && A > 0 && c > 0) ? V * A * c : null;
    if (missing.length) {
      return { ok: false, missing: missing, C0: C0, C1: null, delta: null, parts: null };
    }
    var C1 = V * (1 - r) * Ap * c + V * r * k + M;
    return {
      ok: true, missing: [],
      C0: C0, C1: C1, delta: C0 - C1,
      /* 拆项,界面要显示「转人工部分 / AI 处理 / 持续成本」三段 */
      parts: { human: V * (1 - r) * Ap * c, ai: V * r * k, upkeep: M }
    };
  }

  /* ── 跨回合有效参数(⭐ 周全裁定①:平台按案例级基线自动带入,开班锁定,学员不可改)──
     为什么必须有这一层(2026-09-26 推演撞出来的洞):
       R3–R5 算 Δ 需要 `A/A′/c/k/M`,可它们**只在 R2 的包里**;而每回合的包是**独立**的
       ⇒ 不补这层,R3–R5 的 `computeCost` 必然返回 `null`,价值分永远空白。
     判据(808 §5 原文「**不能事后改分母掩盖差距**」):
       分母 = **开班时锁定的已批准范围**,不是学员每回合重填的作业 ⇒ 学员**不可改**。
     ⚠️ 「一个数据一个来源」:基线值**只从 `base` 来**;学员端不再出现这些输入框。
       包内若带了同名值,只作**核对用**,不作第二来源。 */
  var BASELINE_KEYS = ['A', 'Ap', 'c', 'k', 'M'];

  /* `locked` = 开班锁定的组级参数(如已批准范围)。真实站点里它来自
     讲师端开班配置 / R2 结束时的范围批准记录(跨回合状态层),**不来自本回合表单**。 */
  function effectiveInputs(roundKey, nums, base, locked) {
    nums = nums || {}; base = base || {}; locked = locked || {};
    var o = {}, src = {};
    /* ① 案例级基线:平台一律带入(A/A′/c/k/M 是所有组相同的案例事实) */
    BASELINE_KEYS.forEach(function (k) {
      var v = (base[k] !== undefined && base[k] !== null) ? _num(base[k]) : null;
      o[k] = v;
      src[k] = (v === null) ? 'missing' : 'baseline（案例级基线，平台带入）';
    });
    /* ② 业务量(分母):R3 起用「开班锁定的已批准范围」;R3 前用学员申报的 V */
    var isScopeRound = (roundKey !== 'R1' && roundKey !== 'R2');
    var v = null, vSrc = 'missing';
    if (isScopeRound) {
      if (_num(locked.V_scope) !== null)      { v = _num(locked.V_scope); vSrc = 'V_scope（开班锁定的已批准范围，学员不可改）'; }
      else if (_num(nums.V_scope) !== null)   { v = _num(nums.V_scope);  vSrc = 'V_scope（本组已批准范围）'; }
      else if (_num(base.V_scope) !== null)   { v = _num(base.V_scope);  vSrc = 'V_scope（案例级已批准范围）'; }
      else if (_num(base.V) !== null)         { v = _num(base.V);        vSrc = 'V（⚠︎ 回落到全量 —— 与 808 §5「分母=已批准范围」不符，应核对）'; }
    } else {
      if (_num(nums.V) !== null)              { v = _num(nums.V);        vSrc = 'V（学员申报）'; }
      else if (_num(base.V) !== null)         { v = _num(base.V);        vSrc = 'V（案例级基线）'; }
    }
    o.V = v; src.V = vSrc;
    o.__src = src;
    o.__scopeRound = isScopeRound;
    return o;
  }

  /* ── 分回合的 r 口径(⭐ 2026-09-26 推演暴露的第二件事,已回源确认)──
     原实现:R3–R5 全部沿用 EvalRun 的 r ⇒ **S2→S5 兑现率完全相同**(T01 恒 54.3%),
     「分回合打分」退化成「R2 打一次就定死」。**这是错的。**
     回源:808 §5 给 R3 的判据表头是「.35 生产化 / .30 Eval v2.0 冻结 / .20 人工接续可核 / .15 回退演练」
       ⇒ 「Eval 冻结」是**单独一条判据**(.30),不是拿它去代替真实运行;
       R3-04 是「F08-B **真实运行证据**」,R4-03 是「F11-B **周期观察**」
       ⇒ 到了 R3 你**已经有真实运行数据了**,Δ实际 就该用**实测的 `r_prod`**。
     口径:
       · R1 无 nums ⇒ 价值分 = 讲师 1–5 打「预估价值的可核验性」(D06 §2.1.1),不走这里;
       · R2 还没有真实运行 ⇒ 用 **EvalRun 的 r**(`artifacts.eval`);
       · R3–R5 有真实运行 ⇒ 用 **`r_prod`**(F08-B 实测),EvalRun 的 r 作**对比基准**
         ⇒ 「Eval 说得好、真跑差」会**直接压低价值分**,不再只是一条告警。
     ⚠️ 「一个数据一个来源」:R2 的来源是 `artifacts.eval`,R3+ 的来源是 `nums` 的实测计数,
        两者**不会同时进 Δ** —— 由回合决定用哪个,不做「取小/取大」这种随手调和。 */
  function effectiveR(roundKey, nums, sub) {
    var isProd = (roundKey !== 'R1' && roundKey !== 'R2');
    if (!isProd) {
      var r = evalRate(sub);
      return { r: r, src: (r === null ? 'evalRun 未产出' : 'EvalRun（R2 尚无真实运行，用评测结论）'),
               isProd: false, baseline: null };
    }
    var rr = deriveRatios(nums || {});
    var rp = rr.r_prod;
    if (rp === null) {
      return { r: null, src: '真实运行计数不全（需 N_ok 与 N_ai）', isProd: true, baseline: evalRate(sub) };
    }
    return { r: rp, src: '真实运行 r_prod（' + (_num(nums.N_ok)) + ' ÷ ' + (_num(nums.N_ai)) +
             '）—— 808 §5 F08-B 实测', isProd: true, baseline: evalRate(sub) };
  }

  /* ── EvalRun 产物登记(③-a,2026-09-26;契约见 D04 §6.1)──────────────
     D04 §6.4 约束③ 的原话是「界面不得允许学员**直接填** `r`」。
     ⚠️ 只放一个数字框 = **换个地方手填**,不算数。要让「填」变成「登记一次可复核的实测」,
        产物就必须**可标识**:`eval_id` / `version` / `dataset_ref` 齐了,`r` 才被采信。
        讲师据此可要求现场重跑 —— 这是 D08 复核 b+c 两条里的 c。
     ⇒ 这三条是**硬门槛**(缺 ⇒ `r` 不予采信),不是提示。 */
  var EVALRUN_ID = ['eval_id', 'version', 'dataset_ref'];

  function _s(x) { return (x === null || x === undefined) ? '' : String(x).trim(); }
  function _num(x) {
    if (x === null || x === undefined || x === '') { return null; }
    var n = Number(x);
    return isNaN(n) ? null : n;
  }

  /* 把界面收上来的原始登记,规整成落盘的 `artifacts.eval` 形态 */
  function makeEvalRun(raw) {
    raw = raw || {};
    var m = raw.metrics || {};
    return {
      eval_id: _s(raw.eval_id),
      version: _s(raw.version),
      dataset_ref: _s(raw.dataset_ref),
      run_at: _s(raw.run_at),
      metrics: { r: _num(m.r), n: _num(m.n), failures: _num(m.failures) }
    };
  }

  /* 产物体检:block = **硬门槛**(缺 ⇒ r 不采信);warn = 提示(不拦,但讲师端要显示)。
     `n` / `failures` 故意放 warn 不放 block —— 它们是**可核对的杠杆**(能反推 r),
       而不是采信的前提;漏了要**显式说**,但不能因此把历史包一刀切死。 */
  function evalRunIssues(ev) {
    if (!ev || typeof ev !== 'object') { return { block: ['未登记 EvalRun 产物'], warn: [] }; }
    var block = [], warn = [];
    EVALRUN_ID.forEach(function (k) { if (!_s(ev[k])) { block.push(k); } });
    var m = ev.metrics || {};
    var r = _num(m.r), n = _num(m.n), f = _num(m.failures);
    if (r === null || r < 0 || r > 1) { block.push('metrics.r'); }
    if (n === null || !(n > 0)) { warn.push('metrics.n（缺样本量 —— 无法核对 r 的分母）'); }
    if (f === null || f < 0) { warn.push('metrics.failures（缺失败样本数 —— 无法核对失败记录）'); }
    if (n !== null && n > 0 && f !== null && f >= 0 && r !== null) {
      var implied = (n - f) / n;
      if (Math.abs(r - implied) > 0.02) {
        warn.push('r 与 n/failures 对不上：按 r = (n − failures) ÷ n 推算应为 ' +
                  implied.toFixed(4) + '，而登记的是 ' + r);
      }
    }
    return { block: block, warn: warn };
  }

  /* 实测解决率 r —— **只从可标识的 EvalRun 产物读**,界面不得手填(D04 §6.4 约束③)。
     ⚠️ 已**废止**旧的裸字段 `artifacts.eval_r`(③-a):它没有任何产物标识,与手填无异,
        不能作为计分来源。现在一律走 `artifacts.eval`,读不到或未标识 ⇒ null,
        **绝不 fallback 编一个**(同 roundClock 的原则)。
     原因串见 evalRateWhy()。 */
  function evalRateWhy(sub) {
    var ev = (sub && sub.artifacts) ? sub.artifacts.eval : null;
    var iss = evalRunIssues(ev);
    if (iss.block.length) { return 'EvalRun 产物未标识（缺 ' + iss.block.join(' / ') + '）—— r 不予采信'; }
    return '';
  }

  function evalRate(sub) {
    var ev = (sub && sub.artifacts) ? sub.artifacts.eval : null;
    if (evalRunIssues(ev).block.length) { return null; }
    var n = _num(ev.metrics.r);
    return (n !== null && n >= 0 && n <= 1) ? n : null;
  }

  /* ⭐⭐ ③-b:回合级「原始计数 → 派生率」的通用口径(2026-09-26)。
     R3/R4 的价值链**不是**靠一个 EvalRun 走完的 —— 808 §5/§6 要求先有**真实运行 / 周期观察**
     的原始计数,再由平台算率。界面只收**计数**,率一律在这里算(同「界面只收原始参数」铁律)。
     口径逐条回源,不发明:
       · `r_prod`   = 正确 ÷ 实际进入 AI 路径   ← 808 §5 F08-B「正确·失败·误放行」
       · `use_rate` = 实际使用 ÷ 适用任务总数   ← 808 §6「实际适用任务分母…持续使用或嵌入行为」
     ⚠️ `use_rate` **不是价值输入** —— 808 §6 原文「**不能将采用率当已兑现收入**」。
        它是**采纳证据**(进判分表证据行),不进价值分。`notValue` 这个标记就是为此存在的,
        免得日后有人把它接进 `valueRate`。 */
  var RATIO_DEF = {
    r_prod: { num: 'N_ok', den: 'N_ai', label: '生产实测解决率 r_prod', notValue: false,
      src: '808 §5 F08-B「正确 ÷ 实际进入 AI 路径」' },
    use_rate: { num: 'N_use', den: 'N_app', label: '周期采纳率 use_rate', notValue: true,
      src: '808 §6「持续使用或嵌入行为 ÷ 实际适用任务分母」—— 采纳证据，不是收入' }
  };

  function deriveRatios(inp) {
    var out = {};
    for (var k in RATIO_DEF) {
      var d = RATIO_DEF[k], a = _num(inp[d.num]), b = _num(inp[d.den]);
      out[k] = (a !== null && b !== null && b > 0) ? (a / b) : null;
    }
    return out;
  }

  /* ── 质量型阈值(⭐ 周全裁定③「加」,2026-09-26)──────────────────
     ⚠️ **这两个数不是 808 里的** —— 808 §5 只要求「正确·失败·误放行」三类分列、
        且「不许拿平均分抵消阻断」,**没给任何阈值**。所以它们是**平台默认值、可由讲师调整**,
        而且**只告警、不扣分** —— 做成扣分就等于凭空发明一条公式。
     为什么必须有(推演实测暴露):T05 的误放行 `N_fp`=28000(占 `N_ai` 14%),
        数字看着漂亮(兑现率 94.3%),但**错放进去的东西没人管** —— 原实现一条告警都不出。
     判据:宁可报一个「偏高」让讲师去问,也不让最危险的情形静默通过。 */
  var QUALITY_THRESHOLDS = {
    fp_rate: {
      warn: 0.05, hard: 0.10,
      label: '误放行率 = 误放行 ÷ 实际进入 AI 路径',
      src: '808 §5「正确·失败·误放行」须分列；阈值 = 平台默认，非 808 原文，可由讲师调整'
    },
    remedy_ratio: {
      warn: 2.0,
      label: '补救人工 ÷ 设计内人工',
      src: '808 §5「设计内人工与补救人工」须分开申报；阈值 = 平台默认'
    }
  };

  /* 计数之间的一致性检查 —— **不用于计分**,只作讲师可核的告警。
     808 §5 原文「不许拿平均分抵消阻断」⇒ 这些告警必须摆到证据行上,不能被平均掉。
     判据:宁可说「有 N 次未归类」,也不默认把它算成正确(那正是 06 §5 的虚高来源)。 */
  function ratioIssues(inp) {
    var warn = [];
    var ap = _num(inp.N_app), ai = _num(inp.N_ai), ok = _num(inp.N_ok),
      fl = _num(inp.N_fail), fp = _num(inp.N_fp), nu = _num(inp.N_use),
      hin = _num(inp.H_in), hrec = _num(inp.H_rec);
    if (ap !== null && ai !== null && ai > ap) {
      warn.push('实际进入 AI 路径 ' + ai + ' > 适用任务总量 ' + ap + ' —— 分母对不上，先核对取数口径');
    }
    if (ai !== null && ok !== null && fl !== null) {
      var s = ok + fl + (fp === null ? 0 : fp);
      if (s > ai) {
        warn.push('正确+失败+误放行 (' + s + ') > 实际进入 AI 路径 ' + ai + ' —— 分类有重叠');
      } else if (s < ai) {
        warn.push('正确+失败+误放行 (' + s + ') < 实际进入 AI 路径 ' + ai +
          ' —— 有 ' + (ai - s) + ' 次未归类，不能默认算成正确');
      }
    }
    if (ap !== null && nu !== null && nu > ap) {
      warn.push('实际使用 ' + nu + ' > 适用任务总数 ' + ap + ' —— 分母对不上');
    }
    /* ⭐ ③ 质量型告警(裁定「加」)—— 只报事实 + 阈值,不扣分 */
    if (ai !== null && ai > 0 && fp !== null) {
      var fr = fp / ai, pct = (fr * 100).toFixed(1);
      if (fr >= QUALITY_THRESHOLDS.fp_rate.hard) {
        warn.push('误放行率 ' + pct + '%（' + fp + '÷' + ai + '）—— 严重：错放进去的 ' + fp +
          ' 件没人管，数字再漂亮也不算可接受。要求现场抽样复核这批误放行。');
      } else if (fr >= QUALITY_THRESHOLDS.fp_rate.warn) {
        warn.push('误放行率 ' + pct + '%（' + fp + '÷' + ai + '）—— 偏高（平台默认警戒线 ' +
          (QUALITY_THRESHOLDS.fp_rate.warn * 100) + '%）。');
      }
    }
    if (hin !== null && hrec !== null && hin > 0 && hrec / hin >= QUALITY_THRESHOLDS.remedy_ratio.warn) {
      warn.push('补救人工 ' + hrec + ' ÷ 设计内人工 ' + hin + ' = ' + (hrec / hin).toFixed(1) +
        ' 倍 —— 说明「设计内」的接续没做成，主要靠救火（808 §5 两类须分清）。');
    }
    return { block: [], warn: warn };
  }

  /* 价值分 = Δ实际 ÷ Δ上限(D21.2「用率不用量」)。
     **分母的定义来自 `06` 第 140 行**:「客户卡需带 V / A(分层) / c / **r 的合理区间** / 峰谷比
       —— 这些就是『理论价值上限』的输入」⇒ 分母 = **r 取区间上界**算出的 Δ。
     ⭐ 比率里的「年化 ×12」自动约掉(06 §5.3 那行写的是年化,而 D21.2 要的是比率),
        所以这里不做 ×12 —— 做了反而会把口径弄歪。
     → 学员实测 r 越接近上界,兑现率越接近 1(「学员方案越接近 C₀,兑现率越高」)。 */
  /* ⭐ 第 4 个参数 `rOverride`(2026-09-26 推演后加):分回合的 r 口径。
     不传 ⇒ 旧行为(用 EvalRun 的 r),**向后兼容**;
     传 ⇒ 用它(R3+ 传真实运行的 `r_prod`,见 `effectiveR`)。
     「一个数据一个来源」:r 要么来自 EvalRun、要么来自实测计数,由**回合**决定,不混用。 */
  function valueRate(sub, inp, rUpper, rOverride) {
    var rReal;
    if (rOverride === undefined) {
      rReal = evalRate(sub);
    } else {
      rReal = (rOverride === null || rOverride === '') ? null : Number(rOverride);
    }
    if (rReal === null) {
      var whyR = evalRateWhy(sub);
      var tail = (rOverride === undefined)
        ? '没有 EvalRun 的实测 r'
        : '本回合无可用实测 r（R3 起须用真实运行计数 N_ok ÷ N_ai）';
      return { ok: false, why: tail + ' —— 兑现率无法计算（D04 §6.4 约束③）'
                 + (whyR ? '｜' + whyR : ''), rate: null };
    }
    var hi = (rUpper === null || rUpper === undefined) ? null : Number(rUpper);
    if (hi === null || !(hi > 0) || hi > 1) { return { ok: false, why: '客户卡未给 r 的合理区间上界 —— 分母无据（06 §4）', rate: null }; }
    var real = computeCost(inp, rReal), top = computeCost(inp, hi);
    if (!real.ok || !top.ok) {
      return { ok: false, why: '参数不全：' + (real.missing.concat(top.missing).filter(function (x, i, s) { return s.indexOf(x) === i; }).join('/')), rate: null };
    }
    if (!(top.delta > 0)) { return { ok: false, why: 'r 上界下的月收益非正 ⇒ 分母无意义', rate: null }; }
    return { ok: true, rate: real.delta / top.delta, r_real: rReal, r_upper: hi,
             delta_real: real.delta, delta_top: top.delta };
  }

  /* ═══════════ 下载/读取文件(零依赖)═══════════ */
  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    return filename;
  }
  function readFiles(files, cb) {
    var out = [], pending = files.length, i;
    if (!pending) { return cb([]); }
    for (i = 0; i < files.length; i++) {
      (function (f) {
        var r = new FileReader();
        r.onload = function () {
          var ok = true, data = null, err = '';
          try { data = JSON.parse(r.result); } catch (e) { ok = false; err = '不是合法 JSON'; }
          out.push({ file: f.name, ok: ok, data: data, err: err });
          if (--pending === 0) { out.sort(function (a, b) { return a.file < b.file ? -1 : 1; }); cb(out); }
        };
        r.readAsText(f);
      })(files[i]);
    }
  }

  /* ═══════════ 排名 ═══════════ */
  function rank(rows, key) {
    key = key || 'total';
    var sorted = rows.slice().sort(function (a, b) {
      var va = (a[key] === null || a[key] === undefined) ? -1 : a[key];
      var vb = (b[key] === null || b[key] === undefined) ? -1 : b[key];
      return vb - va;
    });
    var out = [], prev = null, prevRank = 0;
    sorted.forEach(function (r, i) {
      var v = (r[key] === null || r[key] === undefined) ? null : r[key];
      var rk;
      if (v === null) { rk = '—'; }
      else if (prev !== null && Math.abs(v - prev) < 1e-9) { rk = prevRank; }
      else { rk = i + 1; prevRank = rk; prev = v; }
      if (v !== null) { prev = v; }
      out.push({ row: r, rank: rk, value: v });
    });
    return out;
  }

  /* ═══════════ 导出 ═══════════ */
  root.FDE = {
    VERSION: VERSION, KEY: KEY,
    fp: fp, fpOf: fpOf, stamp: stamp, isoDate: isoDate,
    computeCost: computeCost, evalRate: evalRate, valueRate: valueRate,
    makeEvalRun: makeEvalRun, evalRunIssues: evalRunIssues, evalRateWhy: evalRateWhy,
    RATIO_DEF: RATIO_DEF, deriveRatios: deriveRatios, ratioIssues: ratioIssues,
    effectiveInputs: effectiveInputs, effectiveR: effectiveR, BASELINE_KEYS: BASELINE_KEYS,
    QUALITY_THRESHOLDS: QUALITY_THRESHOLDS,
    norm: norm, wsum: wsum, score: score, rate: rate,
    W: W, HARD_RED: HARD_RED, SOFT_GATE: SOFT_GATE,
    put: put, get: get, del: del,
    makePackage: makePackage, verifyPackage: verifyPackage,
    parseStamp: parseStamp, roundClock: roundClock, softGateList: softGateList,
    download: download, readFiles: readFiles, rank: rank
  };
})(window);
