/* ══════════════════════════════════════════════════════════════════
   l7_student_app.js · 学员端交互层 v1.0
   依赖 l7_core.js · 不改动 v0.3 原型的设计与样式,只挂功能
   依据:20_状态层A_设计稿(方案 A-δ)· 08_D04 §6.1/§6.4 · 14_D06
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var F = window.FDE;
  if (!F) { console.error('[fde] l7_core.js 未加载'); return; }
  var RD = window.FDE_ROUNDS || null;   /* 回合内容目录(可选依赖:缺失时退化为 R1 文案) */

  /* ⭐ 当前案例号 —— **唯一来源**是讲师端下发的开班配置（`F.KEY.CLASS.case_id`）。
     ⚠️ 缺陷来源（2026-09-29 接入 #05 时撞出）：原先 4 处 `RD.base(…'C03')` 把案例写死，
        讲师端就算把案例切成别的卡，学员端仍按「优选生活」的 V/A/c 算 —— 这与
        `submitState()` 记的那笔账同类：**显示值（顶栏案例）≠ 计算值（基线参数）**，
        而且学员看不出来。凡「界面声明过的状态，代码必须遵守它」。 */
  function curCase() {
    var cls = F.get(F.KEY.CLASS, {}) || {};
    return cls.case_id || 'C03';   /* 未开班时回落到首期卡，与讲师端默认一致 */
  }

  /* 当前站号('S1'..'S5')。注意 fde.round 存的是**对象**,不是字符串(曾致 B11)。 */
  function currentRound() {
    var r = F.get(F.KEY.ROUND, null);
    if (!r) { return 'S1'; }
    return (typeof r === 'string') ? r : (r.round || 'S1');
  }

  /* ⭐ 「提交是否开放」的**唯一判断源** —— 状态条与导出按钮必须共用它。
     ⚠️ 缺陷来源(2026-09-26 真实浏览器走查撞出):状态条用它显示「🔴 提交未开放」,
        而**导出按钮根本不看这个状态** ⇒ 界面写着"未开放"却真能导出,
        且包内 `round` 写成了 `null`(文件名 `fde_null_T02_xxxx.json`),
        讲师拿到不知道是哪一回合的提交、归档不进去。
     判据:**凡是界面声明过的状态,代码必须遵守它** —— 否则就是"显示值 ≠ 实际行为",
        与「显示值 ≠ 计算值」是同一类事故。
     ⚠️ 这里**故意不回落到 'S1'**:那个回落是给**显示**用的,
        写进提交包就是"替讲师决定回合" ⇒ 未开班时宁可导不出去(见导出按钮的提示)。 */
  function submitState() {
    var r = F.get(F.KEY.ROUND, null);
    var round = (typeof r === 'string') ? r : ((r && r.round) || null);
    var open = !!(r && r.open !== false && round);
    return { open: open, round: round };
  }
  /* 把回合文案刷到页面骨架(顶部旗标/各屏标题)。
     ⚠️ 存在的理由:这些文案原先写死在 HTML 里(记 B14),发布 S2–S5 后界面仍显示 S1。 */
  function syncChrome() { if (RD && RD.applyChrome) { RD.applyChrome(currentRound()); } }

  /* ─────────── 回合时钟(C112)───────────
     ⚠️ 原先这里显示的是**写死的**「剩余 02:47:12 / 04:00:00 / 进度 31%」——
       学员会当成真时间,是 B4/B12/B14/B15 同类的「静态度量冒充实际状态」。
     现在改成**真算**:`published_at`(讲师端发布时写入)+ `minutes`(开班配置里的回合时限)。
     **没有时限配置时不编数字** —— 显示「讲师未设本回合时限」,并清掉百分比。 */
  function syncClock() {
    var rnd = F.get(F.KEY.ROUND, null) || {};
    if (typeof rnd === 'string') { rnd = { round: rnd }; }
    var c = F.roundClock(rnd);
    var chip = document.querySelector('[data-fde-clock-chip]');
    var left = document.querySelector('[data-fde-clock-left]');
    var total = document.querySelector('[data-fde-clock-total]');
    var fill = document.querySelector('[data-fde-clock-fill]');
    var pct = document.querySelector('[data-fde-clock-pct]');
    var note = document.querySelector('[data-fde-clock-note]');
    if (!c) {                                   /* 未设时限:不编数字 */
      if (chip) { chip.textContent = '未设时限'; }
      if (left) { left.textContent = '—'; }
      if (total) { total.textContent = ''; }
      if (fill) { fill.style.width = '0%'; }
      if (pct) { pct.textContent = '—'; }
      if (note) { note.textContent = '讲师未设本回合时限 —— 不显示倒计时。'; }
      return;
    }
    var msg = c.closed ? '已收卷' : (c.expired ? '已到时' : '剩余 ' + c.left);
    if (chip) { chip.textContent = msg; }
    if (left) { left.textContent = c.left; }
    if (total) { total.textContent = ' / ' + c.total; }
    if (fill) { fill.style.width = c.pct + '%'; }
    if (pct) { pct.textContent = c.pct + '%'; }
    if (note) {
      note.textContent = c.closed ? '讲师已关闭提交 —— 本回合收卷。'
        : (c.expired ? '本回合时限已到，请等待讲师发下一回合。' : '进度按「已用时间 ÷ 回合时限」实时计算。');
    }
  }
  /* 每秒对齐一次(只在真有倒计时时跑,未设时限则完全不启定时器)。
     ⚠️ 这不是「持续动效」(15_L7 §5 铁律针对的是背景装饰动画),
        倒计时**必须走字**才不是假的,所以让它按真实秒数刷新。 */
  function startClock() {
    syncClock();
    if (F.roundClock(F.get(F.KEY.ROUND, null) || {})) {
      setInterval(syncClock, 1000);
    }
  }

  /* ─────────── 工具 ─────────── */
  function el(tag, css, txt) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  /* 需要标签时**显式**用这个(只喂我们自己写的固定模板,绝不喂用户内容)。
     ⚠️ 存在的理由(2026-09-27 真机走查抓到):`el()` 走 textContent ⇒ 字符串里的 `<b>` 会
        **原样显示成 `<b>` 这几个字符**。演练说明那段就是这么写坏的(学员端与讲师端各一处)。
        与讲师端的同名函数保持同一语义,避免两端各修一次。 */
  function elHTML(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function card(t) { return el('div', 'background:#fff;border:1px solid #e3e6ea;border-radius:10px;padding:14px 16px;', t); }
  function h3(t) { var e = el('h3', 'margin:0 0 10px;font-size:14px;font-weight:700;', t); return e; }
  function cl(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (txt !== undefined) { e.textContent = txt; }
    return e;
  }

  /* ─────────── 0. 回合驱动:清单与表单都按目录建 ───────────
     ⚠️ 存在的理由:交付物清单 7 行与表单 7 个 fieldset 原先全部按 R1 写死在 HTML
        (记 B16)。发布 S2–S5 后清单/表单仍是 R1 的,与目录里的项数自相矛盾 ——
        和 B4/B12/B14 同属「静态度量冒充实际状态」。 */
  function roundKey() { return RD ? RD.keyOf(currentRound()) : null; }
  function roundSpec() { return RD ? RD.spec(roundKey()) : null; }

  /* 交付物清单:整体按目录重建 */
  function renderItemList() {
    var sp = roundSpec(), box = document.querySelector('.dlist');
    if (!sp || !box || !RD) { return false; }
    box.innerHTML = '';
    sp.items.forEach(function (it) {
      var row = cl('div', 'drow'); row.setAttribute('data-item', it.id);
      row.appendChild(cl('div', 'tick'));
      row.appendChild(cl('div', 'dnum', it.no));
      var body = cl('div', 'dbody');
      body.appendChild(cl('div', 'dtitle', it.title));
      body.appendChild(cl('div', 'dmeta', it.hint || ''));
      var tags = cl('div', 'dtags');
      (it.tags || []).forEach(function (k) {
        var tg = RD.TAG[k];
        if (tg) { tags.appendChild(cl('span', 'badge ' + tg.cls, tg.label)); }
      });
      body.appendChild(tags);
      row.appendChild(body);
      box.appendChild(row);
    });
    return true;
  }

  /* 交付物表单:非 R1 回合按目录生成。
     R1 保留 HTML 里的专用控件 —— 4 个排序下拉与主价值三分轨是调过并验过的,
     通用文本框表达不了「全排 + 严禁加总」这类判据。 */
  /* ═══════════ ③ 结构化数值项(2026-09-26) ═══════════
     为什么要有这一块:
       价值分 = Δ实际 ÷ Δ上限,而 Δ 由 V/A/A′/c/k/M/r 决定。原先这些只是自由文本里的
       一句话 —— **讲师没法核对分母是怎么来的**,学员也可以直接写一个好看的 Δ。
       现在:界面只收**原始参数**,Δ / 上限 / 兑现率一律由 F.computeCost() / F.valueRate() 算。
     ⚠️ `r` 字段**只读**:它只能来自 EvalRun(D04 §6.4 约束③),给输入框就等于允许手填。 */
  var SRC_LABEL = { card: '卡给定', argue: '需论证', evalrun: 'EvalRun', self: '自估' };
  var SRC_CLS = { card: 'b-card', argue: 'b-hot', evalrun: 'b-eng', self: 'b-val' };
  var DERIVE_LABEL = { C0: '现状月成本 C₀', C1: '上线后月成本 C₁', delta: '月收益 Δ',
                       delta_top: '理论价值上限 Δ上限', rate: '价值兑现率' };

  function money(n) {
    if (n === null || n === undefined || isNaN(n)) { return '—'; }
    var neg = n < 0, s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−¥' : '¥') + s;
  }

  /* 草稿里的 EvalRun 产物 —— `r` 的唯一合法来源。读不到就 null(不编数)。 */
  function draftSub() { return F.get(F.KEY.DRAFT, null) || {}; }

  function numsOf(fs) {
    var o = {};
    fs.querySelectorAll('.fde-numin').forEach(function (i) {
      var v = String(i.value || '').trim();
      if (v !== '' && !isNaN(Number(v))) { o[i.getAttribute('data-k')] = Number(v); }
    });
    return o;
  }

  /* ⭐ 读数用**全表单**取参,而不是只看本 fieldset ——
     因为 08 项(兑现率)自己没有输入框:参数在 02 项(V/A/A′/c)和 07 项(k/M)里。
     只看本 fieldset 的话 08 永远显示「参数不全」(2026-09-26 走查抓到)。 */
  function numsAll() {
    var o = {};
    document.querySelectorAll('.fde-numin').forEach(function (i) {
      var v = String(i.value || '').trim();
      if (v !== '' && !isNaN(Number(v))) { o[i.getAttribute('data-k')] = Number(v); }
    });
    /* ⭐ 裁定①:平台带入的**开班锁定值**(`V_scope`)—— 界面上没有输入框,学员改不了;
       但包内要留一条记录(讲师据此核对分母用的是哪个数)。
       ⚠️ 值**只从平台侧来**:优先级 = 开班锁定 > 案例级已批准范围。 */
    var _lk = F.get('fde.lock') || {};
    var _rk = (typeof roundKey === 'function') ? roundKey() : null;
    if (_rk) {
      var _B = (RD && RD.base) ? RD.base(curCase()) : {};
      var _ei = F.effectiveInputs(_rk, o, _B, { V_scope: _lk.V_scope });
      if (_ei.__scopeRound && _ei.V !== null && _ei.V !== undefined) { o.V_scope = _ei.V; }
    }
    return o;
  }

  /* 实时重算读数。`derive` 决定这一项显示哪些派生量(取自目录声明,不写死)。 */
  function refreshNums(fs) {
    var out = fs.querySelector('.fde-numout');
    if (!out) { return; }
    /* ⭐ ③-c 池型案例（#05）**必须在最前面分流** —— 否则会走到下面的会话型分支，
       而 C05 根本没有 `V/A/A′/c` 这些参数，界面会显示「待补参数：A / A′ / c / k / M」，
       等于用一个不存在的模型去要求学员（2026-09-30 分流）。
       规则：① 带 `delta` 的项 → 显示**学员自己列的池项加出来的 Δ**；
             ② 带 `delta_top` / `rate` 的项 → **只说由讲师侧核定，不给分母、不给率**
                （学员端显示分母 = 把"你还漏了什么"直接送出去）。 */
    if (F.costModel(curCase()) === 'pool') {
      var _d = String(out.getAttribute('data-derive') || '');
      var _rows = collectPoolRows();
      var _pr = F.computeCostPool(_rows);
      out.innerHTML = '';
      if (/(^|,)delta(,|$)/.test(_d)) {
        if (!_rows.length) {
          out.appendChild(cl('div', 'faint',
            '本案例是**成本池型**核算：请先在表单末尾『📊 成本池逐项表』里逐条列出成本项 —— '
            + 'Δ 由那些项加出来（**平台算，不给手填**）。'));
        } else {
          var _v0 = cl('div', 'fde-numv');
          _v0.appendChild(cl('span', 'faint', 'Δ（年，按你自己列的 ' + _pr.used_n + ' 项加）= '));
          _v0.appendChild(el('b', '', money(_pr.delta)));
          out.appendChild(_v0);
          out.appendChild(cl('div', 'faint', '取自表单末尾『📊 成本池逐项表』；改那一张表，这里跟着变。'));
        }
      } else {
        out.appendChild(cl('div', 'faint',
          '本案例是**成本池型**核算：分子来自『📊 成本池逐项表』里你自己列的项。'
          + '**价值兑现率由讲师侧按本案例口径核定 —— 学员端不显示分母。**'));
      }
      return;
    }
    /* ⭐ ③-a 只读框(实测 r)随 EvalRun 登记变化回填 —— 否则学员登记完,
       06 项那格还写着「待 EvalRun 产出」,看起来像没生效。 */
    var ro = fs.querySelector('.fde-numro-val');
    if (ro) {
      /* ⭐ 裁定②:这格要显示的是**进 Δ 的那个 r**,不是 EvalRun 的 r ——
         R2 用 EvalRun;R3 起用真实运行 `r_prod`;R4/R5 沿用 R3 冻结值。
         显示错这一个数,学员会以为自己的分是另一个数算的。 */
      var _k2 = roundKey() || 'R2';
      var _n2 = numsAll();
      var _e2 = F.effectiveR(_k2, _n2, draftSub());
      var rr = _e2.r;
      if (_e2.isProd && rr === null) { var _lr2 = F.get('fde.lockR'); if (_lr2 !== undefined) { rr = _lr2; } }
      ro.textContent = rr === null
        ? (_e2.isProd
            ? '待填真实运行计数 —— 本项要 `N_ok` 与 `N_ai`，平台算出 r_prod 后自动带出'
            : '待 EvalRun 产出 —— 在表单末尾『📎 EvalRun 产物登记』里登记后自动带出')
        : String(rr);
      if (_e2.isProd && _e2.baseline !== null && rr !== null && Math.abs(rr - _e2.baseline) > 0.10) {
        ro.textContent = rr + '　⚠︎ 与 EvalRun 的 ' + _e2.baseline.toFixed(2) +
          ' 相差 ' + (Math.abs(rr - _e2.baseline) * 100).toFixed(0) + 'pt —— 讲师会问为什么';
      }
    }
    var derive = String(out.getAttribute('data-derive') || '').split(',').filter(Boolean);
    var RDw = window.FDE_ROUNDS, B = (RDw && RDw.base) ? RDw.base(curCase()) : {};
    var n = numsAll();
    /* ⭐ ③-b/裁定①:参数一律走 `F.effectiveInputs` —— 案例级基线平台带入、
       分母取**开班锁定的已批准范围**,学员端不再出现这些输入框。
       ⚠️ 「已批准范围」在学员这边来源有二:①本回合填了 `V_scope`(R3) ②上一回合锁定的值(本地记住,R4/R5 沿用)。
          两者都没有时由 core 回落到**案例级已批准范围**,并在来源里写明 —— 不静默用一个错的分母。 */
    var _key = roundKey() || 'R2';
    if (n.V_scope !== undefined && n.V_scope !== null) { F.put('fde.lock', { V_scope: n.V_scope }); }
    var _lk = F.get('fde.lock') || {};
    var inp = F.effectiveInputs(_key, n, B, { V_scope: _lk.V_scope });
    var nField = Number(out.getAttribute('data-nfield') || '0');
    var sub = draftSub();
    /* ⭐ 裁定②:r 逐回合不同 —— R2 用 EvalRun 的 r;R3 用真实运行 `r_prod`;
       R4/R5 沿用 R3 冻结的实测值(本地记住)。**两端同源**,否则学员与讲师看到的分数会不一致。 */
    var _er = F.effectiveR(_key, n, sub);
    var r = _er.r;
    if (_er.isProd && r !== null) { F.put('fde.lockR', r); }
    if (_er.isProd && r === null) { var _lr = F.get('fde.lockR'); if (_lr !== undefined) { r = _lr; } }
    var cost = F.computeCost(inp, r);
    out.innerHTML = '';
    if (!cost.ok) {
      /* r 还没来时 C₀ 仍可算(V·A·c 不需要 r)—— 先摆出来,再说缺什么。
         否则学员会以为「全算不了」,实际只是 r 还没从 EvalRun 出来。 */
      if (cost.C0 !== null && nField > 0) {
        var r0 = cl('div', 'fde-numv');
        r0.appendChild(cl('span', 'faint', '现状月成本 C₀（= V×A×c，不需要 r）：'));
        r0.appendChild(el('b', '', money(cost.C0)));
        out.appendChild(r0);
      }
      out.appendChild(cl('div', 'faint', nField === 0
        ? '本项没有要填的数值 —— 参数取自 02 项（V/A/A′/c）与 07 项（k/M）；r 取自 EvalRun。当前缺：' + cost.missing.join(' / ')
        : '待补参数：' + cost.missing.join(' / ') + ' —— 缺一项就不算，不用 0 顶替'));
      return;
    }
    /* 核算链:先把已填的原始参数摆出来,再显示这一段算出来的量 */
    var line = cl('div', 'fde-numl');
    /* ⭐ ③-b:参数回显**由 `data-params`(目录声明)驱动** —— 不再写死 V/A/A′/c。
       千分位也由数值本身决定,不靠一张写死的键名表(那种表迟早漏掉新参数)。 */
    var pdef = [];
    try { pdef = JSON.parse(out.getAttribute('data-params') || '[]'); } catch (e) { pdef = []; }
    var shown = [];
    pdef.forEach(function (f) {
      var v = n[f.k];
      if (v === undefined || v === null) { return; }
      var num = Number(v);
      shown.push(f.k + '=' + (isFinite(num) && Math.abs(num) >= 1000
        ? num.toLocaleString('zh-CN') : v));
    });
    line.textContent = shown.join('  ') + (r === null ? '' : '  r=' + r);
    out.appendChild(line);
    derive.forEach(function (dk) {
      var v, lb = DERIVE_LABEL[dk] || (F.RATIO_DEF[dk] ? F.RATIO_DEF[dk].label : dk);
      if (dk === 'rate' || dk === 'delta_top') {
        var vr = F.valueRate(sub, inp, B.r_range ? B.r_range[1] : null, r);
        if (!vr.ok) { out.appendChild(cl('div', 'fde-numv warn', '⚠︎ ' + vr.why)); return; }
        v = (dk === 'rate') ? (vr.rate * 100).toFixed(1) + '%' : money(vr.delta_top);
      } else if (F.RATIO_DEF[dk]) {
        /* ⭐ ③-b 比率型派生(计数 ÷ 计数)—— 率一律平台算,界面只收计数 */
        var rv = F.deriveRatios(n)[dk];
        if (rv === null) {
          var miss = [F.RATIO_DEF[dk].num, F.RATIO_DEF[dk].den].filter(function (kk) {
            return n[kk] === undefined || n[kk] === null;
          });
          out.appendChild(cl('div', 'fde-numv warn',
            '⚠︎ ' + lb + ' 算不出 —— 缺 ' + miss.join(' / ')));
          return;
        }
        v = (rv * 100).toFixed(1) + '%（' + F.RATIO_DEF[dk].num + ' ÷ ' + F.RATIO_DEF[dk].den + '）';
        /* 采纳率**不是**收入 —— 808 §6 原文,写在界面上而不是只写进文档 */
        if (F.RATIO_DEF[dk].notValue) { v += '　⚠︎ 采纳证据，不计入价值分（808 §6）'; }
      } else if (cost[dk] !== undefined && cost[dk] !== null) {
        v = money(cost[dk]);
        if (dk === 'delta') { v += cost.delta > 0 ? '（为正 = 方案可辩护）' : '（非正 = 方案不成立）'; }
      } else {
        /* ⭐ ③-b:未知派生键**大声报错**。原来会 money(undefined) 静默渲染成「—」,
           于是「目录写错键名」看起来只是「没数据」—— 又是一颗静默炸弹。 */
        v = '⚠︎ 目录声明了派生量 `' + dk + '`，但平台不认识它 —— 目录与平台的契约不同步';
      }
      var row = cl('div', 'fde-numv');
      row.appendChild(el('span', 'faint', lb + '：'));
      row.appendChild(el('b', '', v));
      out.appendChild(row);
    });
    /* ⭐ ③-b:计数之间的一致性告警 —— 不用于计分,但**必须摆到学员眼前**。
       808 §5 原文「不许拿平均分抵消阻断」;「有 N 次未归类」绝不能被默认算成正确。 */
    F.ratioIssues(n).warn.forEach(function (w) {
      out.appendChild(cl('div', 'fde-numv warn', '⚠︎ ' + w));
    });
  }

  function buildNums(it) {
    var wrap = cl('div', 'fde-nums');
    wrap.setAttribute('data-derive', (it.nums.derive || []).join(','));
    var grid = cl('div', 'fde-numgrid');
    (it.nums.fields || []).forEach(function (fd) {
      var cell = cl('div', 'fde-numcell');
      var top = cl('div', 'fde-numcap');
      top.appendChild(cl('span', 'fde-numlb', fd.label + '（' + fd.unit + '）'));
      top.appendChild(cl('span', 'badge ' + (SRC_CLS[fd.src] || 'b-val'), SRC_LABEL[fd.src] || fd.src));
      cell.appendChild(top);
      if (fd.locked) {
        /* ⭐ 裁定①:平台带入的**开班锁定值**（已批准范围）——
           **界面上没有输入框,学员改不了**(808 §5「不能事后改分母掩盖差距」)。
           显示当前生效值 + 来源,让学员知道分母是多少、谁定的。 */
        var _kb = roundKey() || 'R3';
        var _nb = numsAll();
        var _lk2 = F.get('fde.lock') || {};
        var _bh = (window.FDE_ROUNDS && window.FDE_ROUNDS.base) ? window.FDE_ROUNDS.base(curCase()) : {};
        var _ei2 = F.effectiveInputs(_kb, _nb, _bh, { V_scope: _lk2.V_scope });
        cell.appendChild(cl('div', 'fde-numro fde-numro-val',
          (_ei2[fd.k] === null || _ei2[fd.k] === undefined)
            ? '待开班锁定 —— 由讲师按组设定已批准范围后自动带入'
            : Number(_ei2[fd.k]).toLocaleString('zh-CN')));
        cell.appendChild(cl('div', 'faint', '🔒 开班锁定，学员不可改（' + (_ei2.__src ? _ei2.__src.V : '') + '）'));
      } else if (fd.readonly) {
        /* 只读:显示实测值或诚实说「还没有」。
           ⚠️ 值来自 EvalRun 产物登记 —— 界面上**没有**让学员填 r 的地方(D04 §6.4 约束③)。
           加 `fde-numro-val` 供 refreshNums 在登记变化时回填。 */
        var r = F.evalRate(draftSub());
        cell.appendChild(cl('div', 'fde-numro fde-numro-val',
          r === null ? '待 EvalRun 产出 —— 在表单末尾『📎 EvalRun 产物登记』里登记后自动带出'
                     : String(r)));
      } else {
        var inp = document.createElement('input');
        inp.type = 'number'; inp.step = 'any';
        inp.className = 'fde-numin'; inp.setAttribute('data-k', fd.k);
        inp.placeholder = fd.conv || '';
        cell.appendChild(inp);
      }
      if (fd.conv) { cell.appendChild(cl('div', 'faint', fd.conv)); }
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    /* 口径守卫:A′ 必须 > A(卡里没给 A′,是 R2 考点) */
    if (it.nums.guard) {
      wrap.appendChild(cl('div', 'fde-numg faint', '⚠︎ ' + it.nums.guard.msg));
    }
    var out = cl('div', 'fde-numout');
    out.setAttribute('data-derive', (it.nums.derive || []).join(','));
    /* ⭐ ③-b:顶行的参数回显必须**由声明驱动**,不能写死 V/A/A′/c。
       (写死清单家族第 5 例:B13/B15/B17/tab 之后,读数的参数行也写死了 —— R3-04 的
        N_app/N_ai/… 与 R4-03 的 N_use 因此一个字都显示不出来。) */
    out.setAttribute('data-params', JSON.stringify((it.nums.fields || [])
      .map(function (f) { return { k: f.k, label: f.label, unit: f.unit }; })));
    /* 有几个**可填的**数字框 —— 决定「参数不全」时该说哪句话
       (08 项没有输入框,得告诉他去哪填;06 项只有只读框,同理) */
    out.setAttribute('data-nfield', String(wrap.querySelectorAll('.fde-numin').length));
    wrap.appendChild(out);
    ['input', 'change'].forEach(function (ev) {
      /* ⚠️ 刷新**全页**读数:08 项的兑现率依赖 02/07 项的参数 ——
         只刷自己那一块,学员填完 02 会看到 08 仍是「参数不全」,像坏了。 */
      wrap.addEventListener(ev, function () {
        document.querySelectorAll('.fieldset').forEach(function (f) { refreshNums(f); });
        save();
      });
    });
    setTimeout(function () {
      document.querySelectorAll('.fieldset').forEach(function (f) { refreshNums(f); });
    }, 0);
    return wrap;
  }

  /* ⭐ ③-a EvalRun 产物登记(2026-09-26)───────────────────────────
     D04 §6.4 约束③ 的原话是「界面不得允许学员**直接填** `r`」。
     ⚠️ 所以这里**不是一个 r 输入框**,而是一张**产物登记表**:
       · `eval_id` / `dataset_ref` 学员必须填 —— 讲师据此核对,并可要求现场重跑;
       · `version` 由目录声明(**只读**)—— 学员不能自称交了 v2.0;
       · `n` / `failures` 是**能反推 r** 的杠杆(对不上就告警)。
     ⭐ 关键机制:`r` 只有在这张表**标识齐全**时才被采信(FDE.evalRunIssues 的 block)。
        只填一个 r = 未标识 ⇒ 平台不认 ⇒ 兑现率算不出来。
        **这就是「不许手填」的落地方式** —— 不是不给填,是**填了也不算**。 */
  var EVRUN_FIELDS = [
    { k: 'eval_id',     label: '产物编号',     ph: '如 EV-T01-S2-01', note: '你自己的跑批编号' },
    { k: 'dataset_ref', label: '验收集标识',   ph: '如 holdout-200（与开发集隔离）',
      note: '⚠️ 必须与 CostModel 指向同一批数据（R2 软门槛）' },
    { k: 'run_at',      label: '跑批时间',     ph: '如 2026-09-26 15:00', note: '可留空' },
    { k: 'r',           label: '实测解决率 r', ph: '0–1',  note: '这个数会被平台拿去算兑现率' },
    { k: 'n',           label: '样本量 n',     ph: '如 200', note: '缺了就核不了 r 的分母' },
    { k: 'failures',    label: '失败样本数',   ph: '如 96',  note: '缺了就核不了失败记录' }
  ];

  /* ⭐ ③-c 成本池逐项表（2026-09-30）—— **池型案例专用**（#05 精工机械）
     与 ③-a 的分工：
       · ③-a「EvalRun 产物登记」→ 给**会话型**案例算 `r`（技术层 → 价值层的桥）；
       · ③-c「成本池逐项表」→ 给**池型**案例收 Δ 的**分子**：学员必须**自己列出**成本项。
     ⚠️ 为什么是"学员自己列"，而不是"平台给一张表让他填数"：
        平台给表 = 把「这个业务单元还有哪些成本在漏」直接告诉学员 ——
        而「**过杀与漏检流出的钱必须由学员自己问出来，才进得了他的账**」正是本案例的教学胜负手（`C130` ①）。
        ⇒ 界面**只给空行**（项名由学员自己拟），平台只负责**加法**（Δ = Σ(C₀−C₁)）与形态校验。
     ⚠️ 学员端**不显示 Δ上限、不显示兑现率** —— 那等于把池子的大小（也就是"你还漏了什么"）送出去。
        兑现率一律由讲师侧按案例口径核定（`F.valueRatePool()` 在讲师端调用）。
     ⚠️ **故意不挂 `fieldset` 类**（同 ③-a 的教训）：挂了会被 `refreshNums`/`collectForm` 当成交付物项，
        读数区被覆盖成「本项没有要填的数值」，扫描也会多看它一眼。 */
  function collectPoolRows() {
    var box = document.getElementById('fde-pool-input');
    if (!box) { return []; }
    var rows = [];
    box.querySelectorAll('.fde-poolrow').forEach(function (r) {
      var g = function (attr) {
        var e = r.querySelector('[data-p="' + attr + '"]');
        return e ? String(e.value === undefined ? '' : e.value).trim() : '';
      };
      var name = g('name'), c0s = g('c0'), c1s = g('c1'), basis = g('basis');
      if (!name && !c0s && !c1s && !basis) { return; }   /* 整行全空 = 没填，不进包 */
      rows.push({
        name: name,
        C0: (c0s !== '' && !isNaN(Number(c0s))) ? Number(c0s) : null,
        C1: (c1s !== '' && !isNaN(Number(c1s))) ? Number(c1s) : null,
        basis: basis
      });
    });
    return rows;
  }

  function poolRowEl(r) {
    r = r || {};
    var row = cl('div', 'fde-poolrow');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;';
    function mk(attr, ph, css, type, val) {
      var i = document.createElement('input');
      i.type = type || 'text';
      if (i.type === 'number') { i.step = 'any'; }
      i.setAttribute('data-p', attr);
      i.placeholder = ph;
      i.style.cssText = css;
      if (val !== undefined && val !== null) { i.value = val; }
      return i;
    }
    row.appendChild(mk('name', '成本项名称（自己定）', 'flex:1 1 170px;min-width:130px;padding:5px 7px;', 'text', r.name));
    row.appendChild(mk('c0', '现状年成本 C₀（元）', 'flex:0 1 140px;width:140px;padding:5px 7px;', 'number', r.C0));
    row.appendChild(mk('c1', '上线后年成本 C₁（元）', 'flex:0 1 140px;width:140px;padding:5px 7px;', 'number', r.C1));
    row.appendChild(mk('basis', '依据（向谁问的 / 哪份材料）', 'flex:1 1 150px;min-width:110px;padding:5px 7px;', 'text', r.basis));
    var del = document.createElement('button');
    del.type = 'button'; del.textContent = '✕'; del.title = '删掉这一行';
    del.style.cssText = 'flex:none;padding:5px 9px;border:1px solid #d1d5db;background:#fff;'
      + 'border-radius:6px;cursor:pointer;font-size:12px;';
    del.addEventListener('click', function () {
      row.remove(); save(); refreshPool();
      document.querySelectorAll('.fieldset').forEach(function (f) { refreshNums(f); });
    });
    row.appendChild(del);
    return row;
  }

  function buildPoolTable() {
    var box = cl('div', 'fde-pooltb');
    box.id = 'fde-pool-input';

    var lbl = cl('label', 'f');
    lbl.textContent = '📊 成本池逐项表 ';
    lbl.appendChild(cl('span', 'badge b-val', '收益核算输入'));
    lbl.appendChild(cl('span', 'badge b-ghost', '非交付物 · 判分证据'));
    box.appendChild(lbl);
    box.appendChild(cl('div', 'hint',
      '把**你自己认定**的、这个业务单元能影响的成本项**逐条列出来**（项名自己定）；'
      + '每项填**现状年成本 C₀** 与**上线后年成本 C₁**，并写明依据（向谁问的 / 从哪份材料看到的）。'));
    box.appendChild(cl('div', 'fde-numg faint',
      '平台只做加法：Δ（年）= Σ(C₀ − C₁)，**没列的项不进 Δ** —— 列多少、列哪些，取决于你问到了多少。'));

    var body = cl('div', 'fde-poolbody');
    box.appendChild(body);

    var add = document.createElement('button');
    add.type = 'button'; add.textContent = '＋ 添加一项';
    add.style.cssText = 'margin-top:4px;padding:5px 11px;border:1px solid #d1d5db;background:#fff;'
      + 'border-radius:6px;cursor:pointer;font-size:12.5px;';
    add.addEventListener('click', function () {
      body.appendChild(poolRowEl({})); refreshPool();
      document.querySelectorAll('.fieldset').forEach(function (f) { refreshNums(f); });
    });
    box.appendChild(add);

    var out = cl('div', 'fde-numout fde-poolout');
    box.appendChild(out);

    ['input', 'change'].forEach(function (ev) {
      /* ⚠️ 必须**同时刷全页读数**（与 ③-a EvalRun 登记同款）：
         池项一变，07 项（Δ）与 08 项（兑现率口径说明）的读数就得跟着变 ——
         否则学员填完池表，07 项还写着「请先在…逐条列出成本项」，看起来像没生效
         （2026-09-30 走查实测撞到：只刷自己那块 ⇒ 显示值 ≠ 计算值）。 */
      box.addEventListener(ev, function () {
        save(); refreshPool();
        document.querySelectorAll('.fieldset').forEach(function (f) { refreshNums(f); });
      });
    });
    setTimeout(refreshPool, 0);
    return box;
  }

  /* 池型读数：只显示**由学员自己列的项**加出来的 Δ。**不给分母、不给率。** */
  function refreshPool() {
    var box = document.getElementById('fde-pool-input');
    if (!box) { return; }
    var out = box.querySelector('.fde-poolout');
    if (!out) { return; }
    var rows = collectPoolRows();
    var r = F.computeCostPool(rows);
    out.innerHTML = '';
    if (!rows.length) {
      out.appendChild(cl('div', 'faint',
        '还没有列出任何成本项 —— Δ 现在**算不出来**（不是 0）。空表不会自动给你项名：要列哪些，得你自己问到。'));
      return;
    }
    var l = cl('div', 'fde-numl');
    l.appendChild(cl('span', 'faint', '已列出 ' + r.used_n + ' 项的 C₀ 与 C₁'));
    out.appendChild(l);
    var v = cl('div', 'fde-numv');
    v.appendChild(cl('span', 'faint', 'Δ（年）= Σ(C₀ − C₁) = '));
    v.appendChild(el('b', '', money(r.delta)));
    out.appendChild(v);
    if (r.gaps.length) {
      out.appendChild(cl('div', 'fde-numg',
        '⚠︎ 有 ' + r.gaps.length + ' 项还没把 C₀ / C₁ 填齐，已经**不算进 Δ**（不拿 0 顶替）。'));
    }
    out.appendChild(cl('div', 'faint',
      '⚠️ 这只是**你自己列出的项**加出来的数。价值兑现率由讲师侧按本案例的口径核定 —— 这里不显示分母。'));
  }

  function buildEvalRun(decl) {
    /* ⚠️ **故意不挂 `fieldset` 类**(2026-09-26 走查抓到)——
       一旦挂了,`refreshNums` 遍历 `.fieldset` 时会把这个块也当成数值项,
       `fs.querySelector('.fde-numout')` 命中它的读数区,把登记读数**覆盖**成
       「本项没有要填的数值」;`collectForm`/`bindForm` 的扫描也会多看它一眼。
       独立类 ⇒ 三处扫描天然绕过,只靠 id 接线。 */
    var box = cl('div', 'fde-evrun');
    box.id = 'fde-evalrun';

    var lbl = cl('label', 'f', '📎 EvalRun 产物登记 ');
    lbl.appendChild(cl('span', 'badge b-eng', decl.kind + ' ' + decl.version));
    lbl.appendChild(cl('span', 'badge b-ghost', '非交付物 · 判分证据'));
    box.appendChild(lbl);
    box.appendChild(cl('div', 'hint', decl.hint || ''));

    var note = cl('div', 'fde-evnote');
    note.textContent = '为什么不是「填个 r」：D04 §6.4 约束③ 要求 r 必须来自可标识的实测产物。'
      + '编号与验收集填齐了，平台才采信这个 r，并据此算 Δ / Δ上限 / 兑现率；'
      + '只写一个 r 数字，平台一律不认。讲师可据此要求现场重跑（D08 复核）。';
    box.appendChild(note);

    var grid = cl('div', 'fde-evgrid');
    EVRUN_FIELDS.forEach(function (fd) {
      var cell = cl('div', 'fde-numcell');
      cell.appendChild(cl('div', 'fde-numcap', fd.label));
      var i = document.createElement('input');
      i.type = (fd.k === 'eval_id' || fd.k === 'dataset_ref' || fd.k === 'run_at') ? 'text' : 'number';
      if (i.type === 'number') { i.step = 'any'; i.min = '0'; }
      i.className = 'fde-evin';
      i.setAttribute('data-e', fd.k);
      i.placeholder = fd.ph || '';
      cell.appendChild(i);
      if (fd.note) { cell.appendChild(cl('div', 'faint', fd.note)); }
      grid.appendChild(cell);
    });
    /* version 由目录给定,**只读** —— 学员改不了自己交的是哪一版 */
    var vc = cl('div', 'fde-numcell');
    vc.appendChild(cl('div', 'fde-numcap', 'Eval 版本'));
    var vi = document.createElement('input');
    vi.type = 'text'; vi.className = 'fde-evin fde-evro';
    vi.setAttribute('data-e', 'version'); vi.readOnly = true; vi.value = decl.version;
    vc.appendChild(vi);
    vc.appendChild(cl('div', 'faint', '由本回合目录给定，不可改'));
    grid.appendChild(vc);
    box.appendChild(grid);

    var out = cl('div', 'fde-numout fde-evout');
    box.appendChild(out);

    /* 正主项提示:这份登记是给哪一项用的 */
    if (decl.holder) {
      box.appendChild(cl('div', 'fde-numg faint',
        '⤴ 本登记供 ' + decl.holder + ' 取值：r 只从这份产物带出，界面上没有第二个地方能写它。'));
    }

    ['input', 'change'].forEach(function (ev) {
      box.addEventListener(ev, function () {
        save();                                     /* 先落草稿 —— 读数依赖草稿里的 artifacts */
        refreshEvalRun();
        document.querySelectorAll('.fieldset').forEach(function (f) { refreshNums(f); });
      });
    });
    setTimeout(refreshEvalRun, 0);
    return box;
  }

  /* 登记体检 + 兑现率读数。**不通过就说为什么不通过**,绝不显示一个能用的数。 */
  function refreshEvalRun() {
    var box = document.getElementById('fde-evalrun');
    if (!box) { return; }
    var out = box.querySelector('.fde-evout');
    if (!out) { return; }
    var ev = collectEvalRun();
    out.innerHTML = '';
    if (!ev) {
      out.appendChild(cl('div', 'faint', 'ℹ︎ 尚未登记 —— 不登记也能交包，但 r 无从带出，价值分只能空着（不拿 0 顶）。'));
      return;
    }
    var iss = F.evalRunIssues(ev);
    if (iss.block.length) {
      out.appendChild(cl('div', 'fde-numv warn',
        '⚠︎ 产物未标识（缺 ' + iss.block.join(' / ') + '）—— 平台不予采信，兑现率算不出来'));
    }
    iss.warn.forEach(function (w) { out.appendChild(cl('div', 'fde-numv warn', '⚠︎ ' + w)); });

    var rEv = F.evalRate({ artifacts: { eval: ev } });
    if (rEv === null) { return; }
    var B = (RD && RD.base) ? RD.base(curCase()) : {};
    var _n3 = numsAll(), _k3 = roundKey() || 'R2';
    if (_n3.V_scope !== undefined && _n3.V_scope !== null) { F.put('fde.lock', { V_scope: _n3.V_scope }); }
    var _lk3 = F.get('fde.lock') || {};
    var inp = F.effectiveInputs(_k3, _n3, B, { V_scope: _lk3.V_scope });
    /* ⭐ 裁定②:R3 起 Δ 用的**不是** EvalRun 的 r,而是真实运行 `r_prod`。
       这一块既然叫「EvalRun 产物登记」,就该同时把两件事说清:
       ① 登记被采信了(= rEv) ② 真正进 Δ 的是哪个 r */
    var _er3 = F.effectiveR(_k3, _n3, { artifacts: { eval: ev } });
    var r = _er3.r;
    if (_er3.isProd && r === null) { var _lr3 = F.get('fde.lockR'); if (_lr3 !== undefined) { r = _lr3; } }
    var cost = F.computeCost(inp, r);
    if (!cost.ok) {
      out.appendChild(cl('div', 'faint', '登记已采信（EvalRun r = ' + rEv + '），但参数还没填齐（缺 ' + cost.missing.join(' / ') + '）'));
      return;
    }
    var vr = F.valueRate({ artifacts: { eval: ev } }, inp, B.r_range ? B.r_range[1] : null, r);
    var ok = cl('div', 'fde-numv');
    ok.appendChild(cl('span', 'faint', '✅ EvalRun 登记已采信：r = '));
    ok.appendChild(el('b', '', String(rEv)));
    ok.appendChild(cl('span', 'faint', '（' + ev.version + '，' + (ev.eval_id || '') + '）'));
    out.appendChild(ok);
    /* ⭐ 裁定②:进 Δ 的 r 与 EvalRun 的 r **不是同一个**时,必须同时摆出来 ——
       否则学员不知道自己的分数是按哪个数算的。 */
    if (_er3.isProd) {
      var rl = cl('div', _er3.baseline !== null && r !== null && Math.abs(r - _er3.baseline) > 0.10
        ? 'fde-numv warn' : 'fde-numl');
      rl.textContent = '▶ 本回合进 Δ 的 r = ' + (r === null ? '未产出' : r) +
        '（真实运行 r_prod = 正确 ÷ 实际进入 AI 路径）' +
        (r === null ? ' —— 还需填 N_ok 与 N_ai'
                    : '') +
        (_er3.baseline !== null ? '　｜EvalRun 基准 ' + _er3.baseline.toFixed(2) +
          (r !== null && Math.abs(r - _er3.baseline) > 0.10
            ? '　⚠︎ 相差 ' + (Math.abs(r - _er3.baseline) * 100).toFixed(0) + 'pt：讲师会问为什么真跑比评测差'
            : '') : '');
      out.appendChild(rl);
    }
    var l1 = cl('div', 'fde-numl');
    l1.textContent = 'C₀=' + money(cost.C0) + '  C₁=' + money(cost.C1) + '  Δ=' + money(cost.delta);
    out.appendChild(l1);
    if (vr.ok) {
      var l2 = cl('div', 'fde-numl');
      l2.textContent = 'Δ上限=' + money(vr.delta_top) + '  →  价值兑现率='
                     + (vr.rate * 100).toFixed(1) + '%（分母用 r 区间上界 '
                     + (B.r_range ? B.r_range[1] : '?') + '）';
      out.appendChild(l2);
    } else {
      out.appendChild(cl('div', 'fde-numv warn', '⚠︎ ' + vr.why));
    }
  }

  /* 收集登记。⚠️ **一个字都没填就返回 null** —— 这样不带登记的旧包 body 一字不变,
     历史指纹照旧匹配(同 npc_answers / nums 的思路)。 */
  function collectEvalRun() {
    var box = document.getElementById('fde-evalrun');
    if (!box) { return null; }
    var g = function (k) { var e = box.querySelector('[data-e="' + k + '"]'); return e ? e.value : ''; };
    var any = EVRUN_FIELDS.some(function (fd) { return String(g(fd.k)).trim() !== ''; });
    if (!any) { return null; }
    return F.makeEvalRun({
      eval_id: g('eval_id'), version: g('version'), dataset_ref: g('dataset_ref'), run_at: g('run_at'),
      metrics: { r: g('r'), n: g('n'), failures: g('failures') }
    });
  }

  function buildRoundForm() {
    var sp = roundSpec(), box = document.getElementById('fde-fields');
    if (!sp || !box || !RD) { return false; }
    if (roundKey() === 'R1') { return false; }

    box.innerHTML = '';
    sp.items.forEach(function (it, ix) {
      var fs = cl('div', 'fieldset');
      if (ix === sp.items.length - 1) { fs.style.marginBottom = '0'; }
      var lbl = cl('label', 'f', it.no + ' · ' + it.title + ' ');
      (it.tags || []).forEach(function (k) {
        var tg = RD.TAG[k];
        if (tg) { lbl.appendChild(cl('span', 'badge ' + tg.cls, tg.label)); }
      });
      fs.appendChild(lbl);
      fs.appendChild(cl('div', 'hint', it.hint || ''));
      if (it.fields && it.fields.length) {
        it.fields.forEach(function (fd) {
          var wrap = cl('div', 'fde-sub');
          wrap.appendChild(cl('div', 'faint', fd.label));
          var inp = document.createElement('input');
          inp.type = fd.type || 'text';
          inp.className = 'fde-subin';
          inp.setAttribute('data-k', fd.k);
          inp.placeholder = fd.ph || '';
          wrap.appendChild(inp);
          fs.appendChild(wrap);
        });
        var ta = document.createElement('textarea');
        ta.style.minHeight = '58px';
        ta.placeholder = it.ph || '补充说明与依据';
        fs.appendChild(ta);
      } else {
        var ta2 = document.createElement('textarea');
        ta2.placeholder = it.ph || ('按 ' + (RD.crit(roundKey(), 'judA') || it.title) + ' 的判据交付');
        fs.appendChild(ta2);
      }
      /* ⭐ ③ 结构化数值项(2026-09-26) —— 必须放在主控件**之后**:
         collectForm 用 `fs.querySelector('select,textarea,input')` 取**第一个**控件当主值,
         数字框若放在前面会顶掉主值,把 41 项契约的输入全打乱。
         ⚠️ 渲染条件要**或上 derive** —— 08 项没有可填字段(分子分母都由平台算),
           只用 `fields.length` 判会把整块漏掉(2026-09-26 走查抓到)。 */
      if (it.nums && ((it.nums.fields || []).length || (it.nums.derive || []).length)) {
        fs.appendChild(buildNums(it));
      }
      box.appendChild(fs);
    });
    /* ⭐ ③-a EvalRun 产物登记 —— 放在 41 项**之后**(它不是交付物,是判分证据)。
       它**故意不带 `fieldset` 类**(走查抓到的 bug,见 buildEvalRun 注释),
       所以 collectForm / bindForm / refreshNums 三处 `.fieldset` 扫描天然绕过它,
       41 项契约、门槛统计、草稿结构都不受影响。 */
    if (sp.evalrun) { box.appendChild(buildEvalRun(sp.evalrun)); }
    /* ⭐ ③-c 池型案例（#05）：成本池逐项表 —— 与「EvalRun 产物登记」并列。
       一个收 Δ 的**分子**（学员自己列的池项），一个收技术层的 `r`。 */
    if (F.costModel(curCase()) === 'pool') { box.appendChild(buildPoolTable()); }
    return true;
  }

  /* ─────────── 1. 顶部状态条:组号 / 回合 ─────────── */
  function buildStatusBar() {
    var cls = F.get(F.KEY.CLASS, null) || {};
    var rnd = F.get(F.KEY.ROUND, null) || {};

    var bar = el('div',
      'display:flex;flex-wrap:wrap;gap:10px;align-items:center;' +
      'background:#f5f7fa;border:1px solid #e3e6ea;border-radius:10px;' +
      'padding:10px 14px;margin:0 0 18px;font-size:13px;');

    function chip(label, val, strong) {
      var c = el('span', 'display:inline-flex;gap:6px;align-items:center;');
      c.appendChild(el('span', 'color:#6b7280;', label));
      c.appendChild(el('span', 'font-weight:' + (strong ? '700' : '500') + ';color:#111827;', val));
      return c;
    }

    var TEAM = localStorage.getItem('fde.myTeam') || '—';
    /* ⭐ 与导出按钮**共用** `submitState()` —— 不再各自算一遍(那正是缺陷来源) */
    var isOpen = submitState().open;

    bar.appendChild(chip('组号', TEAM, true));
    bar.appendChild(el('span', 'color:#d1d5db;', '│'));
    bar.appendChild(chip('当前回合', rnd.round || '未开班', true));
    bar.appendChild(el('span', 'color:#d1d5db;', '│'));
    bar.appendChild(chip('案例', (cls.case_id || '未选卡') + (cls.case_name ? ' · ' + cls.case_name : '')));

    var st = el('span',
      'margin-left:auto;font-weight:600;padding:3px 10px;border-radius:999px;font-size:12px;' +
      (isOpen ? 'background:#e7f6ec;color:#0f7a3d;' : 'background:#fdeaea;color:#b42318;'),
      isOpen ? '🟢 提交开放' : '🔴 提交未开放');
    bar.appendChild(st);

    /* 「我是哪一组」—— 学员自填,存 localStorage(无账号方案 A1 的组号来源)
       ⚠️ B5 修复(2026-09-26 首跑发现):原先用原生 prompt(),不可样式化、
       部分平板浏览器会屏蔽、且不校验打错的组号。改为状态条内联输入。 */
    var setTeam = function (v) {
      v = String(v || '').trim().toUpperCase();
      if (!v) return false;
      if (v.length > 8) { alert('组号太长了，应该像 T01 这样（不超过 8 个字符）。'); return false; }
      localStorage.setItem('fde.myTeam', v);
      location.reload();
      return true;
    };

    var wrapT = el('span', 'margin-left:8px;display:inline-flex;gap:4px;align-items:center;');
    var tInp = el('input', 'width:62px;font-size:12px;padding:4px 7px;border:1px solid #d1d5db;' +
      'border-radius:6px;text-transform:uppercase;');
    tInp.type = 'text'; tInp.placeholder = 'T01';
    tInp.value = (TEAM === '—' ? '' : TEAM);
    tInp.title = '讲师组的组卡上有你的组号（如 T01）。本班不使用个人账号，组号即身份。';
    tInp.onkeydown = function (e) { if (e.key === 'Enter') { setTeam(tInp.value); } };
    tInp.onblur = function () { if (tInp.value.trim() && tInp.value.trim().toUpperCase() !== TEAM) { setTeam(tInp.value); } };
    var btn = el('button',
      'font-size:12px;padding:4px 10px;border:1px solid #d1d5db;' +
      'background:#fff;border-radius:6px;cursor:pointer;', '设置组号');
    btn.onclick = function () { setTeam(tInp.value); };
    wrapT.appendChild(tInp); wrapT.appendChild(btn);
    bar.appendChild(wrapT);

    if (TEAM === '—') {
      var warn = el('span', 'margin-left:8px;font-size:12px;color:#b42318;font-weight:600;',
        '← 先设组号，否则成绩回不到你名下');
      bar.appendChild(warn);
    }

    var host = document.querySelector('.page') || document.body;
    host.insertBefore(bar, host.firstChild);

    // 原型的横幅里写死了示意组名,同步成真实的(否则与状态条自相矛盾)
    var TEAM2 = localStorage.getItem('fde.myTeam') || '（未设组号）';
    ['fde-banner-team', 'fde-result-team', 'fde-example-team'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) { n.textContent = (id === 'fde-example-team' ? (TEAM2 === '（未设组号）' ? '你们组' : TEAM2) : TEAM2); }
    });
    /* 原实现是"在页面里找写死的 Delta-0x 再换掉";
       现在 HTML 已改用 id 占位(上面那段),这段扫描成了死代码,删掉。 */
  }

  /* ─────────── 2. 交付物表单:绑定 + 自动存草稿 ─────────── */
  var CID = 'fde.draft';   // 注意:用 F.KEY.DRAFT

  /* ══════════ P8 甲方质询预演(学员侧)══════════
     ⚠️ 两个「为什么这样写」:
     ① 容器用 `.npc-q`,**不是**交付物 fieldset —— D04 定的交付物是 41 项(7+10+9+8+7),
        质询应答不在其中。它是**判断分 B 项(组织／越权识别,权重 .30)的证据**。
        混进 items[] 会直接污染三项分的输入。collectForm 里显式跳过 .npc-q(双保险)。
     ② 依据(808 原文位置)藏在 <details> 里,逼学员**先自己答、再对依据** ——
        直接摊开就变成阅读理解题了,而这批题考的是「认知」不是「检索」。 */
  function npcPool() {
    var R = window.FDE_ROUNDS;
    if (!R || !R.spec) return [];
    var s = R.spec(roundKey() || 'R1');
    return (s && s.npc) || [];
  }

  function renderNpc() {
    var box = document.getElementById('fde-npc');
    if (!box) return;
    var rule = document.querySelector('[data-fde-npc-rule]');
    if (rule) rule.textContent = (window.FDE_ROUNDS && window.FDE_ROUNDS.NPC_RULE) || '';

    var pool = npcPool();
    box.textContent = '';
    if (!pool.length) {
      var p0 = document.createElement('div');
      p0.className = 'card';
      p0.textContent = '本回合目录未提供质询题。';
      box.appendChild(p0);
      return;
    }
    var saved = (F.get(F.KEY.DRAFT, null) || {}).npc_answers || [];
    var byQ = {};
    saved.forEach(function (a) { if (a && a.q) { byQ[a.q] = a.answer || ''; } });

    pool.forEach(function (n) {
      var wrap = document.createElement('div');
      wrap.className = 'fieldset npc-q';
      wrap.setAttribute('data-npc-q', n.q);
      wrap.setAttribute('data-npc-ask', n.ask);

      var head = document.createElement('div');
      head.className = 'lbl';
      head.textContent = '甲方质询 ' + n.q + (n.mark ? ' ' + n.mark : '');
      wrap.appendChild(head);

      var q = document.createElement('p');
      q.style.margin = '6px 0 10px';
      q.textContent = '「' + n.ask + '」';
      wrap.appendChild(q);

      var ta = document.createElement('textarea');
      ta.setAttribute('data-npc-answer', '');
      ta.rows = 3;
      ta.placeholder = '你打算怎么答？（写「我不确定，需要先确认 ○○」也是合格的答法）';
      ta.value = byQ[n.q] || '';
      wrap.appendChild(ta);

      var d = document.createElement('details');
      d.style.marginTop = '8px';
      var sm = document.createElement('summary');
      sm.className = 'faint';
      sm.textContent = '先自己答完，再看依据';
      d.appendChild(sm);
      var bd = document.createElement('div');
      bd.className = 'faint';
      bd.style.marginTop = '6px';
      bd.textContent = '依据：' + (n.basis || '（目录未标依据）');
      d.appendChild(bd);
      wrap.appendChild(d);

      box.appendChild(wrap);
    });
  }

  /* 采集质询应答。空答也保留(空答本身是有信息量的 —— 讲师判 B 项要看「哪几题没答」) */
  function collectNpc() {
    var out = [];
    document.querySelectorAll('.npc-q').forEach(function (w) {
      var ta = w.querySelector('[data-npc-answer]');
      out.push({
        q: w.getAttribute('data-npc-q'),
        ask: w.getAttribute('data-npc-ask') || '',
        answer: ta ? String(ta.value || '').trim() : ''
      });
    });
    return out;
  }

  function collectForm(dryRun) {
    var out = { items: [], gates_passed: [], eng_self: {}, judge_self: {} };
    /* item_id 前缀随回合变 —— 原实现写死 'R1-'(记 B16),换回合后草稿键全错 */
    var rkp = roundKey() || 'R1';
    document.querySelectorAll('.fieldset').forEach(function (fs) {
      if (fs.classList.contains('npc-q')) { return; }   /* P8 质询应答不是交付物 */
      var lbl = fs.querySelector('label.f');
      if (!lbl) return;
      var m = lbl.textContent.match(/^\s*(\d+)\s*·\s*(.+?)\s*$/);
      if (!m) return;
      var ctl = fs.querySelector('select,textarea,input');
      if (!ctl) return;
      var id = m[1], name = m[2];
      var isGate = !!fs.querySelector('.badge.b-gate');
      var val = ctl.value, parts = null, why = null;

      /* ⚠️ B2 修复(2026-09-26 首跑发现):01 候选排序原先只有一个"打包好的"选项,
         全班只能交同一个顺序 —— 而本卡的胜负手恰恰是排序(A 降本 vs B 增收)。
         现在 01 是 4 个真下拉 + 依据,这里把多控件合成一个 value。 */
      var rankCtls = fs.querySelectorAll('.fde-rank');
      if (rankCtls.length) {
        parts = [].map.call(rankCtls, function (r) { return r.value || ''; });
        var whyEl = fs.querySelector('.fde-rank-why');
        var why = whyEl ? String(whyEl.value || '').trim() : '';
        var filled = parts.filter(function (p) { return p; }).length;
        var dup = (function () {
          var seen = {}, d = [];
          parts.forEach(function (p) { if (p) { if (seen[p]) d.push(p); seen[p] = 1; } });
          return d;
        })();
        if (filled) {
          val = parts.map(function (p, ix) { return '第' + (ix + 1) + '名=' + (p || '未选'); }).join(' / ');
          if (dup.length) val += ' ⚠️名次重复：' + dup.join(',');
          if (why) val += ' ｜依据：' + why;
        } else { val = ''; }
        if (filled < 4 && filled > 0) val += ' ⚠️未排满（需 4 个）';
        else if (filled === 4 && dup.length) val += ' ⚠️名次重复，排序无效';
      }

      /* ⭐ ③ 结构化数值项:**只在真有值时**挂 `nums` 键 ——
         这样不带数值项的旧包 body 一字不变,历史指纹照旧匹配(同 npc_answers 的思路)。 */
      var item = { item_id: rkp + '-' + id, name: name, value: val,
                   type: isGate ? 'gate' : 'continuous', parts: parts, why: (typeof why !== 'undefined' ? why : null) };
      var nv = numsOf(fs);
      if (Object.keys(nv).length) { item.nums = nv; }
      out.items.push(item);
      /* 门槛达成判定:自由文本要"说明够"(≥4 字),但下拉选择本身就是明确表态,
         不能因为标签短(如"降本"只有 2 字)就判未达成。
         ⚠️ 2026-09-26 首跑修复:03 主价值的 value 从整句改成短标签后,
         旧的统一 >=4 判定导致"选了也不算达成"。 */
      var isSelect = (ctl.tagName === 'SELECT') && !rankCtls.length;
      var minLen = isSelect ? 1 : 4;
      if (isGate && val && String(val).trim().length >= minLen) { out.gates_passed.push(rkp + '-' + id); }
    });
    /* ⭐ 与状态条/导出按钮**同一个来源**(`submitState`)—— 原先这里写 null、状态条显示 S1,
       两个来源打架(2026-09-26 走查撞出)。 */
    out.round = submitState().round;
    out.team_id = localStorage.getItem('fde.myTeam') || null;
    out.case_id = (F.get(F.KEY.CLASS, {}) || {}).case_id || null;
    out.npc_answers = collectNpc();      /* P8 甲方质询应答 —— 判 B 项的证据,不是交付物 */
    /* 🧪 演练样本标记:只在**显式传 true** 时写进包(条件化 ⇒ 正常包的包体逐字节不变)。
       ⚠️ 这里不能写成 `out.dry_run = !!dryRun` 无条件赋值 —— 那会给每个正常包都加一个
          `dry_run:false` 字段,包体变了、指纹全变(历史包比对与已有的说明文档都会对不上)。 */
    if (dryRun) { out.dry_run = true; }
    /* ⭐ ③-a EvalRun 产物登记 → 落进 `artifacts.eval`。
       ⚠️ 只写 `eval`(登记形态),**绝不写 `value_rate`** —— 那个率由讲师端
          `F.valueRate()` 从登记 + 参数算出来(D04 §6.4 约束③:不许手填)。 */
    var evr = collectEvalRun();
    var pr = collectPoolRows();
    if (evr || pr.length) {
      out.artifacts = {};
      if (evr) { out.artifacts.eval = evr; }
      /* ⭐ ③-c 池型案例：学员逐项声明的成本池 → `artifacts.pool`。
         ⚠️ 只装**学员列的原始项** + 平台算出来的 Δ；**不写兑现率** —— 那由讲师端
            用 `F.valueRatePool()` 从声明 + 案例上限算出来（同 ③-a 不许手填的道理）。
         ⚠️ 无池项时**不加这个键**（旧包 body 一字不变，指纹照旧匹配）。 */
      if (pr.length) {
        out.artifacts.pool = { rows: pr, delta: F.computeCostPool(pr).delta };
      }
    }
    return out;
  }

  function bindForm() {
    var fsets = document.querySelectorAll('.fieldset');
    if (!fsets.length) return false;

    // 恢复草稿
    var draft = F.get(F.KEY.DRAFT, null);
    var restore = {};
    /* ⚠️ 存整个 item(不只 value) —— 01 候选排序是多控件字段,
       要靠 item.parts 才能把 4 个下拉恢复回去。2026-09-26 首跑修复。 */
    if (draft && draft.items) { draft.items.forEach(function (i) { restore[i.item_id] = i; }); }

    var n = 0;
    fsets.forEach(function (fs) {
      var lbl = fs.querySelector('label.f');
      if (!lbl) return;
      var m = lbl.textContent.match(/^\s*(\d+)\s*·/);
      if (!m) return;
      var ctl = fs.querySelector('select,textarea,input');
      if (!ctl || ctl.disabled) return;
      var key = (roundKey() || 'R1') + '-' + m[1];
      var rankCtls2 = fs.querySelectorAll('.fde-rank');
      if (rankCtls2.length) {
        var rc = restore[key];
        if (rc && rc.parts) {
          rankCtls2.forEach(function (sel, ix) { sel.value = rc.parts[ix] || ''; });
        }
        var whyEl2 = fs.querySelector('.fde-rank-why');
        if (whyEl2 && rc && rc.why) { whyEl2.value = rc.why; }
        rankCtls2.forEach(function (sel) {
          sel.addEventListener('change', save);
          sel.addEventListener('input', save);
        });
        if (whyEl2) { whyEl2.addEventListener('input', save); }
      } else {
        var rv = restore[key];
        if (rv !== undefined && rv !== null) { ctl.value = (rv && rv.value !== undefined) ? rv.value : rv; }
        ctl.addEventListener('input', save);
        ctl.addEventListener('change', save);
      }
      /* ⭐ ③ 恢复结构化数值项 —— 草稿里存的是 `item.nums`(键值对) */
      var numCtls = fs.querySelectorAll('.fde-numin');
      if (numCtls.length) {
        var rn = restore[key];
        numCtls.forEach(function (i) {
          var kk = i.getAttribute('data-k');
          if (rn && rn.nums && rn.nums[kk] !== undefined) { i.value = rn.nums[kk]; }
        });
        refreshNums(fs);
      }
      // 联动 03 主价值类型 → 决定计分轨(设计稿提及,先做提示)
      if (m[1] === '03') {
        ctl.addEventListener('change', function () {
          var track = String(ctl.value || '').slice(0, 2);
          var tip = fs.querySelector('.fde-track-tip');
          if (!tip) { tip = el('div', 'margin-top:6px;font-size:12px;color:#0f7a3d;'); fs.appendChild(tip); }
          tip.textContent = '→ 计分轨已定：' + (track || '未选') + '（决定后续取数公式）';
        });
      }
      n++;
    });

    // 状态卡实时刷新
    function refresh() {
      var d = collectForm();
      var gates = d.items.filter(function (i) { return i.type === 'gate'; });
      var done = d.items.filter(function (i) { return i.value && String(i.value).trim(); }).length;
      var gdone = gates.filter(function (i) { return d.gates_passed.indexOf(i.item_id) >= 0; }).length;
      /* 统计:分子分母都要活算。
         ⚠️ 原实现用 `/\s*\/ 7/` 与 `/\/ 3/` 正则匹配**写死的 7 与 3**(记 B15),
            换个 10 项的回合正则就匹配不上 ⇒ 统计静默不更新。改成按 data 钩子取。 */
      var stItems = document.querySelector('[data-fde-stat="items"] .v');
      var stGates = document.querySelector('[data-fde-stat="gates"] .v');
      if (stItems) { stItems.innerHTML = done + '<small> / ' + d.items.length + '</small>'; }
      if (stGates) { stGates.innerHTML = gdone + '<small> / ' + gates.length + '</small>'; }
      var b = document.getElementById('fde-save-hint');
      if (b) { b.textContent = '💾 已自动保存草稿 ' + F.stamp(); }
    }
    /* P8 质询应答也要进草稿 —— 事件委托,免去逐框绑定。
       ⚠️ refresh() 只数 d.items(交付物),质询应答不进那个计数 —— 它不该影响「已完成 N/7」。 */
    var npcBox = document.getElementById('fde-npc');
    if (npcBox) {
      npcBox.addEventListener('input', save);
      npcBox.addEventListener('change', save);
    }
    /* ⭐ ③-a 恢复 EvalRun 产物登记(草稿里在 `artifacts.eval`) */
    (function restoreEvalRun() {
      var box = document.getElementById('fde-evalrun');
      if (!box) { return; }
      var ev = (draft && draft.artifacts && draft.artifacts.eval) || null;
      if (ev) {
        var m = ev.metrics || {};
        var put = function (k, v) {
          var e = box.querySelector('[data-e="' + k + '"]');
          if (e && v !== undefined && v !== null) { e.value = v; }
        };
        put('eval_id', ev.eval_id); put('dataset_ref', ev.dataset_ref); put('run_at', ev.run_at);
        put('version', ev.version);
        put('r', m.r); put('n', m.n); put('failures', m.failures);
      }
      refreshEvalRun();
    }());
    /* ⭐ ③-c 恢复成本池逐项表（草稿里在 `artifacts.pool.rows`） */
    (function restorePool() {
      var box = document.getElementById('fde-pool-input');
      if (!box) { return; }
      var pr = (draft && draft.artifacts && draft.artifacts.pool && draft.artifacts.pool.rows) || null;
      var body = box.querySelector('.fde-poolbody');
      if (pr && pr.length && body) {
        body.innerHTML = '';
        pr.forEach(function (r) { body.appendChild(poolRowEl(r)); });
      }
      refreshPool();
    }());

    window.__fdeRefresh = refresh;
    return true;
  }

  function save() {
    F.put(F.KEY.DRAFT, collectForm());
    if (window.__fdeRefresh) window.__fdeRefresh();
    renderProgress();   /* B12:清单的 7 个勾与标题计数必须跟着草稿走(stat 由 refresh() 管) */
  }

  /* ─────────── 3. 导出提交包(δ 的核心动作) ─────────── */
  function buildSubmitCard() {
    // 放到「提交状态」卡片后面
    var cards = document.querySelectorAll('.card');
    var host = null;
    cards.forEach(function (c) {
      if (!host && c.querySelector('h3') && /提交状态/.test(c.querySelector('h3').textContent)) { host = c; }
    });
    if (!host) return;
    var box = card('');
    box.id = 'fde-submit';
    box.style.marginTop = '16px';
    box.appendChild(h3('📦 提交'));

    var hint = el('div', 'font-size:12px;color:#6b7280;line-height:1.7;margin-bottom:10px;');
    hint.innerHTML = '导出的是<b>提交包</b>(JSON)，含你的 7 项交付物 + <b>指纹</b>。<br>' +
                     '依据 C108 §2.3：指纹用于讲师核验，<b>改动一个字符就会失效</b>。';
    box.appendChild(hint);

    /* ⭐ 导出必须**遵守界面已经声明过的状态**（🟢 提交开放 / 🔴 提交未开放）。
       ⚠️ 未开班时导出的包 `round` 是空的 ⇒ 讲师归档不进去，所以正常导出锁住并**写明原因**，
          而不是导出一个 `fde_null_*.json` 让人事后猜（2026-09-26 走查撞出）。
       🧪 但「锁住」不能把整条链路也锁死 —— 开班前也必须能测通「填表→导出→导入判分」，
          所以另给一个**明确标着演练**的出口（周全裁定 2「加」，2026-09-27）。 */
    var ss = submitState();

    function doExport(dryRun) {
      var d = collectForm(dryRun);
      if (!d.team_id) { alert('还没有设置组号。请点顶部「设置组号」。'); return; }
      if (!d.items.some(function (i) { return i.value && String(i.value).trim(); })) {
        alert('表单还是空的 —— 先填至少一项。'); return;
      }
      if (!dryRun && !submitState().open) {
        alert('提交未开放：讲师尚未发布本回合，包内的回合号会是空的。请等讲师发布后再导出。');
        return;
      }
      var pkg = F.makePackage(d);
      /* ⚠️ 文件名里的 `pkg.round` 未开班时是 null ⇒ 原实现会拼出 `fde_null_*.json`。
         演练包一律用 `DRYRUN` 取代，让讲师在**文件名这一层**就分得清。 */
      var name = 'fde_' + (pkg.round || (dryRun ? 'DRYRUN' : 'null')) + '_' +
                 pkg.team_id + '_' + pkg.fingerprint + '.json';
      F.download(name, JSON.stringify(pkg, null, 2));
      box.appendChild(el('div', 'margin-top:10px;font-size:12px;font-weight:600;color:' +
        (dryRun ? '#8a6d00' : '#0f7a3d') + ';',
        (dryRun ? '🧪 已导出演练样本 ' : '✅ 已导出 ') + name +
        (dryRun ? '（讲师端会标为演练、不计入判分与排名）' : '')));
    }

    var btn = el('button',
      'width:100%;padding:10px;border:0;border-radius:8px;font-size:13px;font-weight:600;' +
      (ss.open ? 'background:#111827;color:#fff;cursor:pointer;'
               : 'background:#e5e7eb;color:#6b7280;cursor:not-allowed;'),
      ss.open ? '⬇ 导出提交包' : '🔒 提交未开放 —— 还不能导出');
    if (!ss.open) {
      btn.disabled = true;
      box.appendChild(el('div', 'margin-top:8px;font-size:12px;color:#b42318;line-height:1.7;',
        '讲师尚未开班、或尚未发布本回合（当前回合 = ' + (ss.round || '未开班') + '）。' +
        '此时导出的话，提交包里「是哪一回合」是空的，讲师无法归档 —— 所以这里锁住了。'));
    }
    btn.onclick = function () { doExport(false); };
    box.appendChild(btn);

    /* 🧪 演练出口 —— **只在未开班时出现**（开班后正常出口就是唯一正路，不给学员两条容易混淆的路）。 */
    if (!ss.open) {
      var dry = el('button',
        'width:100%;padding:10px;margin-top:8px;border:1px dashed #d1a000;border-radius:8px;' +
        'background:#fffbeb;color:#8a6d00;font-size:13px;font-weight:600;cursor:pointer;',
        '🧪 导出演练样本（开班前自测用）');
      dry.onclick = function () { doExport(true); };
      box.appendChild(dry);
      box.appendChild(elHTML('div', 'margin-top:6px;font-size:12px;color:#8a6d00;line-height:1.7;',
        '演练样本会带 <b>dry_run</b> 标记、文件名以 <b>DRYRUN</b> 开头，讲师端一眼认得出，' +
        '且<b>不计入判分与排名</b>。用途：开班前把「填表→导出→导入判分」整条链路先跑通一次。'));
    }

    var sub = el('div', 'font-size:12px;color:#9ca3af;margin-top:8px;display:flex;justify-content:space-between;');
    var h = el('span', '', ''); h.id = 'fde-save-hint';
    sub.appendChild(h);
    var clr = el('a', 'color:#9ca3af;cursor:pointer;text-decoration:underline;', '清空草稿');
    clr.onclick = function () {
      if (confirm('清空本表单的草稿？（不影响讲师侧）')) { F.del(F.KEY.DRAFT); location.reload(); }
    };
    sub.appendChild(clr);
    box.appendChild(sub);

    // 真实开班时的切换点(α 飞书表单)—— 设计稿 §4 待决③
    var cfg = F.get(F.KEY.CLASS, {}) || {};
    if (cfg.submit_url) {
      var a = el('a',
        'display:block;text-align:center;margin-top:10px;padding:9px;border:1px solid #111827;' +
        'border-radius:8px;color:#111827;font-size:13px;font-weight:600;text-decoration:none;',
        '↗ 或用飞书表单提交');
      a.href = cfg.submit_url; a.target = '_blank';
      box.appendChild(a);
    }

    host.parentNode.insertBefore(box, host.nextSibling);
  }

  /* ─────────── 4. 评分看板:读讲师回传的结果 ─────────── */
  function buildResult() {
    var res = F.get(F.KEY.RESULT, null);
    if (!res) return;
    var host = document.querySelector('.page') || document.body;

    var box = card('');
    box.style.cssText += 'margin:20px 0;border:2px solid #111827;';
    box.appendChild(h3('🏁 本回合成绩（讲师回传）'));

    var mine = (res.teams || []).filter(function (t) {
      return t.team_id === (localStorage.getItem('fde.myTeam') || '');
    })[0];

    if (!mine) {
      box.appendChild(el('div', 'font-size:12.5px;color:#6b7280;',
        '本回合结果已发布，但没有找到你的组（' + (localStorage.getItem('fde.myTeam') || '未设置') + ')。'));
    } else {
      var big = el('div', 'font-size:34px;font-weight:800;letter-spacing:-.02em;');
      big.textContent = mine.total === null ? '—' : (mine.total * 100).toFixed(1);
      var unit = el('span', 'font-size:15px;color:#6b7280;font-weight:500;', ' / 100');
      big.appendChild(unit);
      box.appendChild(big);

      var rk = el('div', 'font-size:13px;color:#6b7280;margin:2px 0 12px;');
      rk.textContent = '排名 ' + mine.rank + ' / ' + (res.teams || []).length +
                       '  · 回合 ' + res.round + '  · ' + (res.published_at || '');
      box.appendChild(rk);

      var tbl = el('table', 'width:100%;border-collapse:collapse;font-size:12.5px;');
      tbl.innerHTML = '<thead><tr style="text-align:left;color:#6b7280">' +
        '<th style="padding:6px 0">分项</th><th>得分</th><th>权重</th><th>备注</th></tr></thead>';
      var tb = el('tbody');
      [['价值分', mine.val, '0.45'], ['工程分', mine.eng, '0.30'], ['判断分', mine.judge, '0.25']]
        .forEach(function (r) {
          var tr = el('tr', 'border-top:1px solid #eef0f3;');
          tr.innerHTML = '<td style="padding:7px 0">' + r[0] + '</td>' +
            '<td><b>' + (r[1] === null ? '—' : (r[1] * 100).toFixed(1)) + '</b></td>' +
            '<td style="color:#6b7280">' + r[2] + '</td>' +
            '<td style="color:#9ca3af">' + (r[1] === null ? '未评' : '') + '</td>';
          tb.appendChild(tr);
        });
      tbl.appendChild(tb);
      box.appendChild(tbl);

      var f = el('div', 'font-size:12px;color:#6b7280;margin-top:10px;');
      f.innerHTML = 'C = 价值<sup>0.45</sup> × 工程<sup>0.30</sup> × 判断<sup>0.25</sup> = <b>' +
        (mine.C === null ? '—' : mine.C.toFixed(4)) + '</b>  ·  G = <b>' + mine.G + '</b>  ·  S = <b>' + mine.S + '</b>';
      box.appendChild(f);

      if (mine.notes && mine.notes.length) {
        var nl = el('ul', 'margin:10px 0 0;padding-left:18px;font-size:12px;color:#b42318;line-height:1.8;');
        mine.notes.forEach(function (n) { nl.appendChild(el('li', '', n)); });
        box.appendChild(nl);
      }
    }

    // 排行榜(学员也能看 = 「跨组可见」)
    if (res.teams && res.teams.length > 1) {
      var lb = el('div', 'margin-top:16px;');
      lb.appendChild(h3('排行榜'));
      var t2 = el('table', 'width:100%;border-collapse:collapse;font-size:12.5px;');
      t2.innerHTML = '<thead><tr style="text-align:left;color:#6b7280">' +
        '<th style="padding:6px 0">名次</th><th>组</th><th style="text-align:right">总分</th></tr></thead>';
      var b2 = el('tbody');
      res.teams.forEach(function (t) {
        var isMe = t.team_id === (localStorage.getItem('fde.myTeam') || '');
        var tr = el('tr', 'border-top:1px solid #eef0f3;' + (isMe ? 'background:#fffbeb;font-weight:700;' : ''));
        tr.innerHTML = '<td style="padding:7px 0">' + t.rank + '</td>' +
          '<td>' + (t.team_name || t.team_id) + (isMe ? ' ← 你' : '') + '</td>' +
          '<td style="text-align:right">' + (t.total === null ? '—' : (t.total * 100).toFixed(1)) + '</td>';
        b2.appendChild(tr);
      });
      t2.appendChild(b2);
      lb.appendChild(t2);
      box.appendChild(lb);
    }

    host.insertBefore(box, host.firstChild);
  }

  /* ─────────── 启动 ─────────── */
  /* B12:点亮「交付物清单」的勾 + 更新"已完成 N/7"。
     ⚠️ 这两处原本是写死的静态 HTML(永远 3 项),必须按真实草稿渲染。 */
  function renderProgress() {
    var d = F.get(F.KEY.DRAFT, null);
    var byId = {};
    var n = 0;
    if (d && d.items) {
      d.items.forEach(function (it) {
        var filled = it.value !== null && it.value !== undefined && String(it.value).trim().length > 0;
        byId[it.item_id] = filled;
        if (filled) { n++; }
      });
    }
    var rows = document.querySelectorAll('.drow[data-item]');
    for (var i = 0; i < rows.length; i++) {
      var key = rows[i].getAttribute('data-item');
      var tick = rows[i].querySelector('.tick');
      if (tick) { tick.className = byId[key] ? 'tick done' : 'tick'; tick.textContent = byId[key] ? '✓' : ''; }
    }
    var t = document.getElementById('fde-done-txt');
    if (t) { t.textContent = rows.length + ' 项 · 已完成 ' + n + ' 项'; }
    /* 「已完成 N/7」那个 stat 由 refresh() 负责,不在这里重复处理 */
  }

  /* ⭐ 案例适配 —— 按讲师端下发的 `case_id`，把学员端**随案例变化**的内容切过去。
     为什么要收在一处：案例相关文案散在 ①②③ 三屏，各写各的一定会出现
     「② 写着 A 卡、③ 的候选下拉还是 B 卡」这类自相矛盾（接入 #05 时实测到）。
     做法：① HTML 侧给随案例变化的元素打 `data-case="C0x"`，这里只负责显示/隐藏；
          ② 候选单元下拉的**标签**从 `FDE_ROUNDS.cand(caseId)` 取 ——
             **取值仍是 A/B/C/D 不变**（提交包契约不动，老包照样能验）。 */
  function applyCase() {
    var cid = curCase();

    var nodes = document.querySelectorAll('[data-case]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.display = (nodes[i].getAttribute('data-case') === cid) ? '' : 'none';
    }

    var cand = (RD && RD.cand) ? RD.cand(cid) : null;
    if (cand) {
      var sels = document.querySelectorAll('select.fde-rank');
      for (var s = 0; s < sels.length; s++) {
        var opts = sels[s].options;
        for (var o = 0; o < opts.length; o++) {
          if (opts[o].value === '') { continue; }
          for (var k = 0; k < cand.length; k++) {
            if (cand[k][0] === opts[o].value) { opts[o].text = cand[k][1]; }
          }
        }
      }
    }

    /* ③ R1 的提示与占位符也随案例换（否则会出现「② 是制造业、③ 让你聊大促客服」） */
    var HINT = {
      C03: '把 4 个候选<b>全部排进第 1–4 名</b>，并给出排序依据。<b>不排名次不给分。</b><br>' +
           '本卡的胜负手是 <b>A（降本）与 B（增收）的取舍</b> —— 两条公式<b>严禁加总</b>。',
      C05: '把 4 个候选<b>全部排进第 1–4 名</b>，并给出排序依据。<b>不排名次不给分。</b><br>' +
           '本卡的胜负手是 <b>A（质量）与 B（设备）的取舍</b> —— A 卡在<b>数据标注</b>、B 卡在<b>故障样本稀缺</b>。'
    };
    var h = document.getElementById('fde-r1-hint');
    if (h && HINT[cid]) { h.innerHTML = HINT[cid]; }

    var PH = {
      C03: '排序依据：为什么第 1 名是它？为什么最后一名不是它？（本卡胜负手是 A 降本 与 B 增收 的取舍，两条公式严禁加总）',
      C05: '排序依据：为什么第 1 名是它？为什么最后一名不是它？（本卡胜负手是 A 质量 与 B 设备 的取舍）'
    };
    var ta = document.querySelector('.fde-rank-why');
    if (ta && PH[cid]) { ta.setAttribute('placeholder', PH[cid]); }
  }

  function boot() {
    applyCase();           /* ⚠️ 必须最先 —— 后面几屏的渲染都读当前案例 */
    syncChrome();          /* 骨架文案先对齐当前回合,再渲染进度(否则会闪一下 S1) */
    startClock();          /* 倒计时按 published_at + 时限真算(C112;未设时限则显示未设时限) */
    buildRoundForm();      /* ⚠️ 必须在 bindForm() 之前 —— bindForm 只扫已存在的 .fieldset */
    renderNpc();           /* ④ 甲方质询预演:题面与依据都随回合换(P8 学员侧) */
    renderItemList();      /* 清单与表单同源,避免「清单 10 项 / 表单 7 项」自相矛盾 */
    renderProgress();
    buildStatusBar();
    if (bindForm()) { buildSubmitCard(); if (window.__fdeRefresh) window.__fdeRefresh(); }
    buildResult();
    console.log('[fde] 学员端交互层已加载 · core v' + F.VERSION
                + ' · 回合 ' + currentRound() + '/' + (roundKey() || '—'));
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
})();
