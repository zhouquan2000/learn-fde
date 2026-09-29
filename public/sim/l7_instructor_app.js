/* ══════════════════════════════════════════════════════════════════
   l7_instructor_app.js · 讲师端交互层 v1.0
   依赖 l7_core.js · 不改动 v0.3 原型的设计与样式,只挂功能
   P6 = 开班与回合发布  ·  P7 = 导入判分与排名
   依据:20_状态层A_设计稿(A-δ)· 14_D06 §1/§2/§3 · 08_D04 §6.1
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var F = window.FDE;
  if (!F) { console.error('[fde] l7_core.js 未加载'); return; }

  function el(tag, css, txt) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt !== undefined) { e.textContent = txt; }   // 默认纯文本:学员提交的内容会进 DOM,必须转义
    return e;
  }
  /* 需要标签时显式用这个(只喂我们自己写的固定模板,绝不喂用户内容) */
  function elHTML(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html !== undefined) { e.innerHTML = html; }
    return e;
  }
  function card(css) { return el('div', (css || '') + 'background:#fff;border:1px solid #e3e6ea;border-radius:10px;padding:16px 18px;margin:16px 0;'); }
  function h3(t) { return el('h3', 'margin:0 0 10px;font-size:14px;font-weight:700;', t); }
  function btn(txt, primary) {
    var b = el('button', 'padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;' +
      (primary ? 'background:#111827;color:#fff;border:0;' : 'background:#fff;color:#111827;border:1px solid #d1d5db;'), txt);
    return b;
  }
  function inp(css) { return el('input', 'padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;' + (css || '')); }
  function sel(opts, css) {
    var s = el('select', 'padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;' + (css || ''));
    opts.forEach(function (o) { var x = el('option', '', o[1]); x.value = o[0]; s.appendChild(x); });
    return s;
  }
  var P6 = document.getElementById('p6');
  var P7 = document.getElementById('p7');

  /* ══════════════════ P6 · 开班与回合发布 ══════════════════ */
  var CASE_LIB = [
    ['C03', '优选生活（零售电商 × 客服售后）★首期'],
    ['C05', '精工机械（制造加工 × 生产质量）· ② 档案与基线参数已接入；⚠️ R2–R5 收益核算字段仍按 C03 口径，选用前需先做「成本池型」模板适配'],
    ['C01', '云岭通信（电信通信 × 客服售后）'],
    ['C07', '云栈科技（高科技软件 × 客服售后）'],
    ['C12', '磐云数据（高科技软件 × 运营调度）'],
    ['C09', '星幕娱乐（传媒娱乐 × 客服售后）']
  ];
  var ROUNDS = ['S1 挑活', 'S2 诊断共创 PoC', 'S3 受控投产', 'S4 持续采纳', 'S5 扩张复制'];

  function buildP6() {
    if (!P6) return;
    var cfg = F.get(F.KEY.CLASS, {}) || {};
    var rnd = F.get(F.KEY.ROUND, {}) || {};

    var box = card('border:2px solid #111827;');
    box.appendChild(h3('🎓 开班配置（讲师）'));
    box.appendChild(el('div', 'font-size:12px;color:#6b7280;margin-bottom:12px;',
      '配置存在浏览器本地。学员端读同一份状态（同一台机器同一浏览器）。'));

    function row(label, node, hint) {
      var r = el('div', 'display:flex;gap:12px;align-items:center;margin-bottom:10px;flex-wrap:wrap;');
      r.appendChild(el('div', 'width:96px;font-size:12.5px;color:#374151;flex:none;', label));
      r.appendChild(node);
      if (hint) r.appendChild(el('span', 'font-size:12px;color:#9ca3af;', hint));
      return r;
    }

    /* 案例 */
    var caseSel = sel(CASE_LIB.map(function (c) { return [c[0], c[1]]; }), 'min-width:300px;');
    caseSel.value = cfg.case_id || 'C03';
    box.appendChild(row('案例', caseSel, '首期已裁 = #03(C107)'));

    /* 组数 */
    var teamIn = inp('width:70px;');
    teamIn.type = 'number'; teamIn.min = 1; teamIn.max = 20;
    teamIn.value = cfg.team_count || 6;
    box.appendChild(row('组数', teamIn, '同卡 PK 建议 ≤ 6 组'));

    /* 组名前缀 */
    var prefIn = inp('width:130px;');
    prefIn.value = cfg.team_prefix || 'T';
    box.appendChild(row('组名前缀', prefIn, '生成 T01 / T02 …'));

    /* 飞书表单链接(α 通道,可留空) */
    var urlIn = inp('width:340px;');
    urlIn.placeholder = 'https://…（留空则只用导出包）';
    urlIn.value = cfg.submit_url || '';
    box.appendChild(row('飞书表单', urlIn, '真实开班时填，学员端会出现按钮'));

    /* 回合 */
    var rndSel = sel(ROUNDS.map(function (r, i) { return ['S' + (i + 1), r]; }), 'min-width:180px;');
    rndSel.value = rnd.round || 'S1';
    box.appendChild(row('当前回合', rndSel));

    /* 开关 */
    var openCb = el('input'); openCb.type = 'checkbox';
    /* ⚠️ 安全默认 = **不勾**(2026-09-27 真机走查抓到):原实现 `rnd.open !== false` 在
       「没保存过配置」时 `rnd.open === undefined` ⇒ 判定为真 ⇒ **未开班却预先勾上「允许提交」**,
       与同一个页面顶部的「未开班」胶囊自相矛盾,讲师顺手点保存就会静默开通提交。
       判据与学员端 `submitState()` 对齐:没配置 = 关。 */
    openCb.checked = rnd.open === true;
    var openWrap = el('label', 'display:flex;gap:6px;align-items:center;font-size:12.5px;');
    openWrap.appendChild(openCb);
    openWrap.appendChild(el('span', '', '允许学员提交'));
    box.appendChild(row('提交开关', openWrap));

    /* 回合时限 —— 学员端倒计时唯一的数据来源。
       ⚠️ 存在的理由(C112):学员端此前显示的是**写死的**「剩余 02:47:12 / 进度 31%」,
          学员会当成真时间。真数其实算得出来 —— 本回合的 published_at 一发就有,
          只缺「一回合多少分钟」这个配置。**留空 = 学员端显示「未设时限」,不编数字。** */
    var minIn = el('input', 'width:78px;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-family:ui-monospace;font-size:12.5px;');
    minIn.type = 'number'; minIn.min = '0'; minIn.step = '15';
    minIn.placeholder = '240';
    minIn.value = (rnd.minutes ? String(rnd.minutes) : '');
    box.appendChild(row('回合时限（分钟）', minIn, '留空 = 不显示倒计时（学员端不会看到编造的时间）'));

    var saveBtn = btn('💾 保存配置并发布回合', true);
    saveBtn.onclick = function () {
      F.put(F.KEY.CLASS, {
        case_id: caseSel.value,
        case_name: (CASE_LIB.filter(function (c) { return c[0] === caseSel.value; })[0] || [])[1] || '',
        team_count: Number(teamIn.value) || 6,
        team_prefix: prefIn.value || 'T',
        submit_url: urlIn.value.trim() || '',
        configured_at: F.stamp()
      });
      F.put(F.KEY.ROUND, {
        round: rndSel.value, open: openCb.checked, published_at: F.stamp(),
        minutes: Number(minIn.value) > 0 ? Number(minIn.value) : 0
      });
      syncChrome();
      startClock();          /* 发布后立刻按新 published_at 重算时钟(C112) */
      buildP8();             /* P8 题库随回合换 —— 不重算就会留着上一站的题 */
      flash(box, '✅ 已发布：' + rndSel.value + (openCb.checked ? '（提交开放）' : '（提交关闭）'));
      renderTeams();
      renderGrading();   /* 判据随回合变 —— 换了回合必须重画判分表(B13/B14 同类风险) */
    };
    box.appendChild(saveBtn);

    /* 组卡(打印用) */
    var cardBtn = btn('🖨 生成组卡（组号 + 口令）', false);
    cardBtn.style.marginLeft = '10px';
    cardBtn.onclick = function () {
      var n = Number(teamIn.value) || 6, pre = prefIn.value || 'T', out = [];
      for (var i = 1; i <= n; i++) {
        var id = pre + ('0' + i).slice(-2);
        var pw = F.fp(id + '#fde#' + (caseSel.value || 'C03'));
        out.push(id + '\t' + pw);
      }
      var old = document.getElementById('fde-teams');
      if (old) old.remove();
      var tb = card('background:#fffbeb;border-color:#fcd34d;');
      tb.id = 'fde-teams';
      tb.appendChild(h3('🖨 组卡 —— 打印裁开发给各组'));
      var pre2 = el('pre', 'font-size:13px;line-height:1.9;margin:0;font-family:ui-monospace,Consolas,monospace;', '组号\t口令\n' + out.join('\n'));
      tb.appendChild(pre2);
      tb.appendChild(el('div', 'font-size:12px;color:#92400e;margin-top:10px;',
        '口令 = 组号哈希前 8 位（便于你事后核对，不必另存）。'));
      box.parentNode.insertBefore(tb, box.nextSibling);
    };
    box.appendChild(cardBtn);

    var clsBtn = btn('↺ 重置开班', false);
    clsBtn.style.marginLeft = '10px';
    clsBtn.onclick = function () {
      if (confirm('清空开班配置与提交开关？（已导入的提交包与评分也会清掉）')) {
        [F.KEY.CLASS, F.KEY.ROUND, F.KEY.SUBS, F.KEY.SCORES, F.KEY.RESULT, DRY_KEY].forEach(F.del);
        location.reload();
      }
    };
    box.appendChild(clsBtn);

    P6.appendChild(box);
  }

  function flash(host, msg) {
    var old = host.querySelector('.fde-flash');
    if (old) old.remove();
    var f = el('div', 'margin-top:12px;padding:9px 12px;border-radius:8px;background:#e7f6ec;' +
      'color:#0f7a3d;font-size:12.5px;font-weight:600;', msg);
    f.className = 'fde-flash';
    host.appendChild(f);
  }

  function renderTeams() {
    var cfg = F.get(F.KEY.CLASS, {}) || {};
    var old = document.getElementById('fde-teamlist');
    if (old) old.remove();
    if (!P6 || !cfg.team_count) return;
    var box = card();
    box.id = 'fde-teamlist';
    box.appendChild(h3('👥 组清单'));
    var out = [];
    for (var i = 1; i <= cfg.team_count; i++) { out.push((cfg.team_prefix || 'T') + ('0' + i).slice(-2)); }
    box.appendChild(el('div', 'font-size:13px;letter-spacing:.05em;', out.join('   ')));
    P6.appendChild(box);
  }

  /* ══════════════════ P7 · 导入判分与排名 ══════════════════ */
  var SUBS = [];
  /* 🧪 演练样本（`dry_run:true` 的包）**单独存放，绝不进 SUBS**。
     理由:SUBS 是判分表与排名的唯一输入,演练样本混进去就会污染成绩 —— 所以这里不是"打个标签",
     而是**结构上隔离**(周全裁定 2「加」的硬要求:讲师端一眼认得出、且不计入判分与排名)。 */
  var DRYS = [];
  var DRY_KEY = 'fde.dryruns';
  /* 回合决定价值分口径(D06 v1.3 §2.1.1):R1 打「预估的可核验性」1–5,R2 起打 EvalRun 的实测率。
     必须每次现算 —— 讲师可能在 P6 改了回合再切到 P7,模块级常量会陈旧。
     ⚠️ fde.round 存的是**对象** {round, open, published_at},不是字符串 ——
        写成 `F.get(KEY.ROUND) === 'S1'` 会恒为 false(首跑踩过)。 */
  function currentRound() {
    var r = F.get(F.KEY.ROUND, null);
    if (!r) return 'S1';
    return (typeof r === 'string') ? r : (r.round || 'S1');
  }
  /* 站号 → 回合键:当前发布的是 'S2',内容目录里的键是 'R2'。
     ⚠️ 视图层一律用 roundKey(),不要各写各的映射 —— 这类映射写歪过一次就会静默失效。 */
  var RD = window.FDE_ROUNDS || null;
  function roundKey() {
    var m = /^S([1-5])$/.exec(currentRound());
    return m ? 'R' + m[1] : 'R1';
  }
  /* 当前回合的内容目录(判据/短标签/软门槛/NPC) —— 每次现算,防 P6 改回合后陈旧 */
  function rspec() { return RD ? RD.spec(roundKey()) : null; }
  function critOf(key) { var s = rspec(); return s ? s.crit[key] : ''; }
  function shortOf(key) { return RD ? RD.short(roundKey(), key) : ''; }
  /* 把回合文案刷到页面骨架(横幅/各屏标题)。
     ⚠️ 存在的理由:这些文案原先 5 处写死在 HTML 里(记 B14),发布 S2–S5 后仍显示 S1。 */
  function syncChrome() {
    if (RD && RD.applyChrome) { RD.applyChrome(currentRound()); }
    syncClassChip();
  }
  /* 页头「几组」徽标 —— 原先是**写死**的 `6 组 / 24 人`,没有钩子、从不更新。
     与 B4/B12/B14/B15 同类:静态度量冒充实际状态。开班配置一改它就是假话。
     ⚠️ 现在只显示**有依据的数字**:组数取自 `fde.class.team_count`。
        「人数」**直接删掉** —— 配置里根本没有这个字段,原来那个 24 是凭空的。
        要显示人数就得先在开班配置里真的加一个字段,不能靠页面编。 */
  function syncClassChip() {
    var el2 = document.querySelector('[data-fde-class-chip]');
    if (!el2) return;
    var cfg = F.get(F.KEY.CLASS, {}) || {};
    el2.textContent = cfg.team_count ? (cfg.team_count + ' 组') : '未开班';
    el2.title = cfg.team_count
      ? ('案例：' + (cfg.case_name || cfg.case_id || '—') + '｜组名前缀 ' + (cfg.team_prefix || 'T')
         + '｜配置于 ' + (cfg.configured_at || '—'))
      : '还没有开班配置 —— 在⑥控制台下面「🎓 开班配置」里设';
  }
  /* ───── 回合时钟(C112):讲师端也要看同一个真时钟 ─────
     ⚠️ 页头那个 `#clock` 原先写着**写死的** `02:47:12`,而且**从来没有被 JS 更新过** ——
       讲师照它控场会控错。现在与学员端同源于 `published_at + minutes`。
     **未设时限就显示「未设时限」,不编数字。** */
  function syncClock() {
    var rnd = F.get(F.KEY.ROUND, null) || {};
    var el2 = document.getElementById('clock') || document.querySelector('[data-fde-clock-chip]');
    if (!el2) { return; }
    var c = F.roundClock(rnd);
    if (!c) { el2.textContent = '未设时限'; return; }
    el2.textContent = c.closed ? '已收卷' : (c.expired ? '已到时' : '剩余 ' + c.left);
  }
  var clockTimer = null;
  function startClock() {
    syncClock();
    if (clockTimer) { return; }                       /* 反复发布回合不要叠出多个定时器 */
    if (F.roundClock(F.get(F.KEY.ROUND, null) || {})) {
      clockTimer = setInterval(syncClock, 1000);
    }
  }
  function isR1() { return roundKey() === 'R1'; }
  var SCORES = {};

  function buildP7() {
    if (!P7) return;

    /* —— 导入区 —— */
    var imp = card('border:2px solid #111827;');
    imp.appendChild(h3('📥 导入学员提交包'));
    imp.appendChild(el('div', 'font-size:12px;color:#6b7280;margin-bottom:12px;',
      '可一次选多个 .json。每个包会先做指纹校验（C108 §2.3），校验失败的会在表里标红。'));

    var file = el('input'); file.type = 'file'; file.multiple = true; file.accept = '.json';
    file.style.cssText = 'font-size:13px;';
    var pend = [];
    file.onchange = function () {
      F.readFiles(file.files, function (res) {
        pend = res;
        var box = document.getElementById('fde-pending');
        if (box) box.remove();
        box = card('background:#f5f7fa;');
        box.id = 'fde-pending';
        box.appendChild(h3('待导入 ' + res.length + ' 个包'));
        var t = el('table', 'width:100%;border-collapse:collapse;font-size:12.5px;');
        t.innerHTML = '<thead><tr style="text-align:left;color:#6b7280">' +
          '<th style="padding:5px 0">文件</th><th>组</th><th>回合</th><th>标记</th><th>指纹</th><th>校验</th></tr></thead>';
        var tb = el('tbody');
        res.forEach(function (r) {
          var ok = r.ok; var v = { ok: false, why: r.err };
          if (ok) { v = F.verifyPackage(r.data); }
          var isDry = ok && r.data.dry_run === true;
          var tr = el('tr', 'border-top:1px solid #eef0f3;' + (v.ok ? (isDry ? 'background:#fffbeb;' : '') : 'background:#fdeaea;'));
          tr.innerHTML = '<td style="padding:6px 0;font-family:ui-monospace,monospace">' + r.file + '</td>' +
            '<td>' + (ok ? (r.data.team_id || '—') : '—') + '</td>' +
            '<td>' + (ok ? (r.data.round || '—') : '—') + '</td>' +
            '<td>' + (isDry ? '🧪 演练样本' : '—') + '</td>' +
            '<td style="font-family:ui-monospace,monospace">' + (ok ? r.data.fingerprint : '—') + '</td>' +
            '<td style="color:' + (v.ok ? '#0f7a3d' : '#b42318') + ';font-weight:' + (v.ok ? '500' : '700') + '">' +
            (v.ok ? '✅ 通过' : '❌ ' + v.why) + '</td>';
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        box.appendChild(t);
        var okN = res.filter(function (r) { return r.ok; }).length;
        var badN = res.filter(function (r) { return r.ok && !F.verifyPackage(r.data).ok; }).length;
        var okBtn = btn('✅ 导入 ' + okN + ' 个包' +
          (badN ? '（其中 ' + badN + ' 个指纹异常，会标红待你处置）' : ''), true);
        okBtn.style.marginTop = '12px';
        okBtn.onclick = function () {
          var n = 0, bad = 0, dry = 0;
          res.forEach(function (r) {
            if (!r.ok) return;
            var v = F.verifyPackage(r.data);
            if (!v.ok) { r.data.__tampered = v.why; bad++; }
            /* 🧪 演练样本走**另一条路** —— 不进 SUBS,因此不会出现在判分表与排名里。 */
            if (r.data.dry_run === true) {
              var j = DRYS.map(function (s) { return s.fingerprint; }).indexOf(r.data.fingerprint);
              if (j >= 0) { DRYS[j] = r.data; } else { DRYS.push(r.data); }
              dry++; return;
            }
            var idx = SUBS.map(function (s) { return s.team_id; }).indexOf(r.data.team_id);
            if (idx >= 0) { SUBS[idx] = r.data; } else { SUBS.push(r.data); }
            n++;
          });
          F.put(F.KEY.SUBS, SUBS);
          F.put(DRY_KEY, DRYS);
          renderGrading();
          renderDryRuns();
          okBtn.textContent = '✅ 已导入 ' + n + ' 个' +
            (dry ? '（另收下 ' + dry + ' 个 🧪 演练样本，不计入判分与排名）' : '') +
            (bad ? '（含 ' + bad + ' 个指纹异常，已在表中标红）' : '');
        };
        box.appendChild(okBtn);
        imp.parentNode.insertBefore(box, imp.nextSibling);
      });
    };
    imp.appendChild(file);
    P7.appendChild(imp);

    /* 恢复已导入的 */
    SUBS = F.get(F.KEY.SUBS, []) || [];
    SCORES = F.get(F.KEY.SCORES, {}) || {};
    DRYS = F.get(DRY_KEY, []) || [];
    if (SUBS.length) { renderGrading(); }
    if (DRYS.length) { renderDryRuns(); }
  }

  /* —— 🧪 演练样本面板 ——
     只展示，不判分、不排名。存在的理由：开班前必须能确认「填表→导出→导入」整条链路通了，
     而正常提交在未开班时被锁住（`round` 为空、无法归档）。这个面板就是那条链路的验证面。 */
  function renderDryRuns() {
    var old = document.getElementById('fde-dryruns');
    if (old) old.remove();
    if (!P7 || !DRYS.length) return;

    var box = card('border:1px dashed #d1a000;background:#fffbeb;');
    box.id = 'fde-dryruns';
    box.appendChild(h3('🧪 演练样本 · ' + DRYS.length + ' 个（不计入判分与排名）'));
    box.appendChild(elHTML('div', 'font-size:12px;color:#8a6d00;margin-bottom:10px;line-height:1.7;',
      '这些包带 <b>dry_run</b> 标记，是开班前用来验证链路的。它们<b>不在下面的判分表里</b>，' +
      '也不会出现在排名中。开班后请让学员重新导出<b>正常提交包</b>。'));

    var t = el('table', 'width:100%;border-collapse:collapse;font-size:12.5px;');
    t.innerHTML = '<thead><tr style="text-align:left;color:#8a6d00">' +
      '<th style="padding:5px 0">组</th><th>回合</th><th>交付物</th><th>指纹</th><th>校验</th><th></th></tr></thead>';
    var tb = el('tbody');
    DRYS.forEach(function (s) {
      var v = F.verifyPackage(s);
      var tr = el('tr', 'border-top:1px solid #f0e2bd;');
      tr.innerHTML = '<td style="padding:6px 0">' + (s.team_id || '—') + '</td>' +
        '<td>' + (s.round || '—（未开班）') + '</td>' +
        '<td>' + ((s.items || []).length) + ' 项</td>' +
        '<td style="font-family:ui-monospace,monospace">' + (v.ok ? s.fingerprint : '—') + '</td>' +
        '<td style="color:' + (v.ok ? '#0f7a3d' : '#b42318') + ';font-weight:600">' +
        (v.ok ? '✅ 通过' : '❌ ' + v.why) + '</td><td></td>';
      var rm = el('a', 'color:#8a6d00;cursor:pointer;text-decoration:underline;', '移除');
      rm.onclick = function () {
        DRYS = DRYS.filter(function (x) { return x.fingerprint !== s.fingerprint; });
        F.put(DRY_KEY, DRYS); renderDryRuns();
      };
      tr.lastChild.appendChild(rm);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    box.appendChild(t);

    var clr = btn('清空演练样本');
    clr.style.marginTop = '10px';
    clr.style.background = '#8a6d00';
    clr.onclick = function () {
      if (confirm('清空所有演练样本？（不影响判分表里的正式提交）')) {
        DRYS = []; F.put(DRY_KEY, []); renderDryRuns();
      }
    };
    box.appendChild(clr);

    /* 插在判分表**之前** —— 顺序本身在提示「这不是成绩」。 */
    var g = document.getElementById('fde-grading');
    if (g) { g.parentNode.insertBefore(box, g); } else { P7.appendChild(box); }
  }

  /* —— 判分表 —— */
  function renderGrading() {
    var old = document.getElementById('fde-grading');
    if (old) old.remove();
    if (!P7 || !SUBS.length) return;

    var box = card();
    box.id = 'fde-grading';
    box.appendChild(h3('✍️ 判分 · ' + SUBS.length + ' 组'));
    box.appendChild(elHTML('div', 'font-size:12px;color:#6b7280;margin-bottom:12px;line-height:1.7;',
      '人工分一律 <b>1–5</b>，按 D06 §2.4 换算 <code>(评分−1)÷4</code>。<br>' +
      '<b style="color:#b45309">价值分口径随回合变（D06 v1.4 §2.1.1–§2.1.2）</b>：' +
      (isR1()
        ? '<b>R1 由讲师打「预估的可核验性」1–5</b> —— 判据：① 收益口径是否选对（降本/增收/风控三分，严禁混算）' +
          '② 基线与上限是否写明 ③ 关键假设是否可核验。<b>R2 起改由平台自动带出，届时本框只读。</b>' +
          '<br><span style="color:#92400e">⚠️ <b>R1 不填价值分 ⇒ 该组总分算不出（显示 —），无法排名。</b></span>'
        : (rspec() && rspec().evalrun
            ? '<b>价值分 = </b><code>Δ实际 ÷ Δ上限</code>（0–1 率，<b>不换算</b>）。' +
              '<br><b style="color:#b45309">⚠️ 关键是「Δ实际 用的 r 从哪来」—— 逐回合不同：</b>' +
              '<br>· <b>R2</b>：用 <b>EvalRun 的 r</b>（此时还没有真实运行，只能用评测结论）' +
              '<br>· <b>R3</b>：用 <b>真实运行的 r_prod</b>（<code>正确 ÷ 实际进入 AI 路径</code>，808 §5 F08-B）' +
              ' —— <b>评测说得好、真跑差，分数会当场掉下来</b>' +
              '<br>· <b>R4 / R5</b>：<b>沿用 R3 投产评审冻结的 r_prod</b>（两站不复测 r，808 §5）' +
              '<br><b>判据一句话</b>：<b>评测结论负责「准入」，真实运行负责「算账」。</b>' +
              '<br><span style="color:#0f7d3d">✅ 本回合（' + rspec().evalrun.kind + ' ' + rspec().evalrun.version +
              '）价值分<b>只读</b>：参数取自<a href="#fde-grading">平台侧</a>（案例级基线 + 开班锁定的已批准范围，' +
              '<b>学员不可改</b>），实测计数取自包内 <code>items[].nums</code>，' +
              '<b>讲师在这台机器上改不了</b>。</span>'
              + '<br><span style="color:#92400e">⚠️ 该组没登记 EvalRun（或产物未标识）⇒ r 不予采信 ⇒ '
              + '价值分留空、总分算不出（显示 —）。<b>不要手填补一个。</b></span>'
            : '<b>本回合尚未声明产物依据</b> ⇒ 价值分为<b>手填</b>（复核时须另附依据）。'))));

    P7.appendChild(box);
    rebuildGrading(box);
  }

  function defaultScore(s) {
    /* ⭐ ③-a:本回合若声明了 `evalrun`(R2/R3),价值分**只能派生** ——
       派不出来就是 null(明说原因),**不回落成可手填**(D04 §6.4 约束③)。 */
    var dv = deriveValue(s);
    var d = { value_rate: dv.declared ? dv.rate
                 : ((s.artifacts && s.artifacts.value_rate !== undefined) ? s.artifacts.value_rate : null),
              value_est: null,   /* R1 讲师打的 1–5 预估;R2 起不用(D06 v1.3 §2.1.1) */
              value_derived: !!dv.declared, value_why: dv.declared ? (dv.why || '') : '',
              eng: {}, judge: {}, reds: [], gates: [], gate: 'ok' };
    SCORES[s.team_id] = d;
    return d;
  }

  /* 表体构造:每行用真实 DOM 拼装(输入框要绑事件,不能走 innerHTML) */
  /* ⭐ ③ 结构化数值证据(2026-09-26) —— 判「价值分」的依据。
     ⚠️ 这里显示的是**平台算出来的** Δ / Δ上限 / 兑现率,**不是学员填的**:
        学员界面只收原始参数(V/A/A′/c/k/M),Δ 一律由 F.computeCost 算 ——
        所以这一栏编不了。这正是 D04 §6.4 约束③「r 不可手填」的落地。 */
  function fmtN(v) { return (v === undefined || v === null) ? '—' : String(v); }
  function money2(n) {
    if (n === null || n === undefined || isNaN(n)) { return '—'; }
    return '¥' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  /* ⭐ 跨回合锁定(裁定①):开班锁定的「已批准范围」。
     R3 的包一出现 `V_scope` 就记住它,R4/R5 沿用 —— 讲师按站顺序判分,所以这个缓存天然可用。
     ⚠️ 若 R4/R5 判分时**还没有**锁定值,`effectiveInputs` 会回落到全量 V **并在来源里写明**,
        讲师看得到「⚠︎ 回落到全量」而不是悄悄用一个错的分母。 */
  var LOCKED = {};
  /* 从包内 `items[].nums` 取原始参数。
     ⭐ v1.2 起一律走 `F.effectiveInputs` —— 案例级基线平台带入、分母取开班锁定范围,
        **不再从包里读 A/A′/c/k/M**(D04 v1.1 §4.3:学员不可改,包内同名值只作核对)。 */
  function paramOf(s) {
    var n = {};
    ((s && s.items) || []).forEach(function (it) {
      var o = it.nums || {};
      Object.keys(o).forEach(function (k) { n[k] = o[k]; });
    });
    var B = (window.FDE_ROUNDS && window.FDE_ROUNDS.base) ? window.FDE_ROUNDS.base((s && s.case_id) || 'C03') : {};
    if (s && n.V_scope !== undefined) { LOCKED[s.team_id] = n.V_scope; }
    var sp = rspec();
    var key = (sp && sp.key) ? sp.key : 'R2';
    var ei = F.effectiveInputs(key, n, B, { V_scope: LOCKED[s ? s.team_id : ''] });
    return { n: n, B: B, inp: ei, ei: ei,
             scopeNote: ei.__src ? ei.__src.V : '' };
  }

  /* ⭐ ③-a 价值分:**派生,不手填**(2026-09-26)。
     D06 §2.1.1「R2 起打 Δ实际 ÷ Δ上限」+ D04 §6.4 约束③「r 不可手填」。
     本回合若声明了 `evalrun`(R2 = EvalRun v1.0 / R3 = v2.0),价值分就只能由
     `F.valueRate(包, 包内 nums 的参数, r 区间上界)` 算出 ——
     讲师这台机器上**没有**任何能改写它的输入框。
     算不出就**明说为什么**,绝不回落成手填(那正是这条链要堵的洞)。 */
  function deriveValue(s) {
    var sp = rspec();
    if (!sp || !sp.evalrun) { return { declared: false }; }
    var P = paramOf(s);
    /* ⭐ 分回合 r(裁定②/ D06 v1.4 §2.1.2 / D04 v1.1 §4.4):
       R2 用 EvalRun 的 r;R3 用真实运行 r_prod;R4/R5 沿用 R3 冻结值。 */
    var er = F.effectiveR((sp.key || 'R2'), P.n, s);
    var rUse = er.r;
    /* R4/R5 的包内**没有**运行计数 ⇒ 沿用 R3 冻结的实测值(内存缓存,讲师按站顺序判分) */
    if (er.isProd && rUse === null && LOCKED[s.team_id + '.r'] !== undefined) {
      rUse = LOCKED[s.team_id + '.r'];
      er = { r: rUse, src: '沿用 R3 投产评审冻结的真实运行 r_prod = ' + rUse.toFixed(2) + '（808 §5）',
             isProd: true, baseline: er.baseline };
    }
    if (er.isProd && er.r !== null) { LOCKED[s.team_id + '.r'] = er.r; }
    var vr = F.valueRate(s, P.inp, P.B.r_range ? P.B.r_range[1] : null, rUse);
    return { declared: true, ok: vr.ok, rate: vr.ok ? vr.rate : null,
             why: vr.ok ? '' : vr.why,
             delta_top: vr.ok ? vr.delta_top : null,
             rUpper: P.B.r_range ? P.B.r_range[1] : null,
             r: rUse, rSrc: er.src, isProd: er.isProd,
             evalR: F.evalRate(s),
             scopeNote: P.scopeNote,
             version: sp.evalrun.version, kind: sp.evalrun.kind };
  }

  function numsEvidence(s) {
    if (!s || !s.items) { return null; }
    var n = {};
    s.items.forEach(function (it) {
      var o = it.nums || {};
      Object.keys(o).forEach(function (k) { n[k] = o[k]; });
    });
    /* ⭐ ③-a:没有 nums 但有 EvalRun 登记时也要显示 —— 讲师要能看出「这组登记了产物但参数没填」 */
    var anyEv = !!(s.artifacts && s.artifacts.eval);
    if (!Object.keys(n).length && !anyEv) { return null; }
    var B = (window.FDE_ROUNDS && window.FDE_ROUNDS.base) ? window.FDE_ROUNDS.base(s.case_id || 'C03') : {};
    /* ⭐ v1.2:与 `deriveValue` **同源** —— 参数走 effectiveInputs、r 走 effectiveR,
       否则证据行显示的和实际算分的可能不是同一套数(那正是「显示值 ≠ 计算值」那类缺陷)。 */
    var P = paramOf(s);
    var inp = P.inp;
    var sp0 = rspec();
    var er0 = F.effectiveR((sp0 && sp0.key) || 'R2', n, s);
    var r = er0.r;
    if (er0.isProd && r === null && LOCKED[s.team_id + '.r'] !== undefined) { r = LOCKED[s.team_id + '.r']; }
    var cost = F.computeCost(inp, r);
    var vr = F.valueRate(s, inp, B.r_range ? B.r_range[1] : null, r);

    var tr = el('tr', 'background:#f7fbf8;');
    var td = el('td');
    td.colSpan = 999;
    td.style.cssText = 'padding:6px 4px 10px 18px;font-size:12.5px;color:#33513f;border-bottom:1px solid #eef0f3;';
    td.appendChild(el('div', 'font-weight:700;color:#0f7a3d;margin-bottom:4px;',
      '🔢 本组结构化数值（③ —— 学员只填原始计数，Δ 由平台算，界面改不了）'));
    /* ⚠️ 参数来自**平台侧**(案例级基线 + 开班锁定范围),不是学员填的 —— 必须写明来源,
       否则讲师看到的数字与「谁给的」对不上,这一栏就核不了(2026-09-26 走查抓到)。 */
    var fv = function (k) {
      if (n[k] !== undefined && n[k] !== null) { return fmtN(n[k]); }
      if (B[k] !== undefined && B[k] !== null) { return fmtN(B[k]) + '（卡基线）'; }
      return '—';
    };
    td.appendChild(el('div', 'font-family:ui-monospace,SFMono-Regular,monospace;margin-bottom:4px;',
      'V=' + fv('V') + (inp.__scopeRound ? '（已批准范围，开班锁定，学员不可改）' : '') +
      '　A=' + fv('A') + '　A′=' + fv('Ap') + '　c=' + fv('c') +
      '　k=' + fv('k') + '　M=' + fv('M')));
    /* ⭐ 分回合 r —— 「用哪个 r」必须写在行上(裁定② / D06 v1.4 §2.1.2) */
    td.appendChild(el('div', 'color:#7c2d12;margin-bottom:4px;',
      'r（进 Δ）= ' + (r === null ? '未产出' : r.toFixed(4)) + '　来源：' + (er0.src || '—') +
      (er0.isProd && er0.baseline !== null ? '　｜EvalRun 基准 = ' + er0.baseline.toFixed(2) + '（对比用）' : '')));
    if (cost.ok) {
      td.appendChild(el('div', '', 'C₀ ' + money2(cost.C0) + '　→　C₁ ' + money2(cost.C1) +
        '　→　Δ ' + money2(cost.delta) + (cost.delta > 0 ? '' : '　（非正 = 方案不成立）')));
    } else {
      td.appendChild(el('div', 'color:#b45309;',
        '⚠︎ 参数不全（缺 ' + cost.missing.join(' / ') + '）—— 价值分不可算：先核对，不要用印象补一个数'));
    }
    if (vr.ok) {
      td.appendChild(el('div', '', 'Δ上限 ' + money2(vr.delta_top) + '（r 取区间上界 ' + vr.r_upper +
        '）　→　价值兑现率 ' + (vr.rate * 100).toFixed(1) + '%'));
    } else {
      td.appendChild(el('div', 'color:#b45309;', '⚠︎ ' + vr.why));
    }
    /* ⭐ ③-a EvalRun 产物登记:讲师核对「r 究竟从哪来、能不能被复核」的地方。
       ⚠️ 显示的是**包里的登记**与**平台体检结果**,不是任何可编辑的分数。 */
    var ev = (s.artifacts && s.artifacts.eval) || null;
    if (ev) {
      var iss = F.evalRunIssues(ev), em = ev.metrics || {};
      td.appendChild(el('div', 'font-family:ui-monospace,SFMono-Regular,monospace;margin-top:4px;color:#1f4e79;',
        '📎 EvalRun ' + fmtN(ev.version) + '｜' + fmtN(ev.eval_id) + '｜验收集 ' + fmtN(ev.dataset_ref) +
        '｜n=' + fmtN(em.n) + '　failures=' + fmtN(em.failures) + '｜' + fmtN(ev.run_at)));
      iss.block.forEach(function (b) {
        td.appendChild(el('div', 'color:#b45309;', '⛔ 硬门槛未过：缺 ' + b + ' ⇒ r 不予采信'));
      });
      iss.warn.forEach(function (w) { td.appendChild(el('div', 'color:#b45309;', '⚠︎ ' + w)); });
      td.appendChild(el('div', 'font-size:11.5px;color:#6b7280;',
        '讲师可据此要求现场重跑（D08 复核 b + c）。'));
    } else {
      td.appendChild(el('div', 'color:#b45309;', '⚠︎ 本组未登记 EvalRun 产物 ⇒ 无 r 可采信。'));
    }
    tr.appendChild(td);
    return tr;
  }

  function rebuildGrading(box) {
    var oldT = box.querySelector('table'); if (oldT) oldT.remove();

    var t = el('table', 'width:100%;border-collapse:collapse;font-size:12.5px;');
    var thead = el('thead');
    var sp = rspec(), rk = roundKey();
    var sh = function (k, w) {
      var n = Math.round(w * 100);
      return '.' + (n < 10 ? '0' : '') + n + ' ' + (shortOf(k) || '—');
    };
    var engRow2 = [sh('engA', F.W.ENG.A), sh('engB', F.W.ENG.B), sh('engC', F.W.ENG.C), sh('engD', F.W.ENG.D)].join(' / ');
    var judRow2 = [sh('judA', F.W.JUDGE.A), sh('judB', F.W.JUDGE.B), sh('judC', F.W.JUDGE.C),
                   '<b style="color:#b45309">' + sh('judD', F.W.JUDGE.D) + '</b>'].join(' / ');
    thead.innerHTML = '<tr style="text-align:left;color:#6b7280;font-size:11.5px">' +
      '<th style="padding:6px 4px">组</th><th>价值分<br><span style="font-weight:400">' +
      (isR1() ? '（预估 1–5）' : '（率 0–1）') + '</span></th>' +
      '<th colspan="4" style="text-align:center;border-left:1px solid #eef0f3">工程分 A/B/C/D</th>' +
      '<th colspan="4" style="text-align:center;border-left:1px solid #eef0f3">判断分 A/B/C/D</th>' +
      '<th style="border-left:1px solid #eef0f3">门槛</th>' +
      '<th style="text-align:right">总分</th><th style="text-align:right">名次</th></tr>' +
      '<tr style="color:#9ca3af;font-size:10.5px;text-transform:none"><th></th><th></th>' +
      '<th colspan="4" style="text-align:center;border-left:1px solid #eef0f3">' + engRow2 + '</th>' +
      '<th colspan="4" style="text-align:center;border-left:1px solid #eef0f3">' + judRow2 + '</th>' +
      '<th colspan="3" style="border-left:1px solid #eef0f3"></th></tr>' +
      '<tr style="color:#b45309;font-size:10.5px;background:#fffbeb">' +
      '<th colspan="2"></th><th colspan="9" style="text-align:left;padding:5px 4px;border-left:1px solid #fcd34d">' +
      '<b>判据随回合变，权重全程不变（D06 §4 的 S 时间加权以「各回合可比」为前提）。当前 = ' +
      (sp ? sp.station + ' · ' + sp.name : rk) + '</b>' +
      (sp ? ' —— ' + sp.dropNote : '') +
      '<span style="color:#92400e"><br><b>D 项</b>：' + critOf('judD') + '</span>' +
      '<span style="color:#92400e"><br>⚠️ 任何回合都必须给 D 项打分 —— 留空会触发权重归一化告警。</span></th></tr>';
    t.appendChild(thead);
    var tb = el('tbody');

    SUBS.forEach(function (s) {
      var sc = SCORES[s.team_id] || defaultScore(s);
      var tr = el('tr', 'border-top:1px solid #eef0f3;');

      tr.appendChild(function () {
        var td = el('td', 'padding:8px 4px;font-weight:700;');
        td.textContent = s.team_id;
        if (s.__tampered) {
          td.appendChild(el('div', 'color:#b42318;font-size:10.5px;font-weight:600;', '⚠️ 指纹不符'));
        }
        return td;
      }());

      tr.appendChild(function () {
        var td = el('td');
        var i = inp('width:62px;'); i.type = 'number'; i.step = isR1() ? '1' : '0.01';
        if (isR1()) { i.min = 1; i.max = 5;
          i.title = critOf('value') || '（未定义）';
          i.value = sc.value_est === undefined || sc.value_est === null ? '' : sc.value_est;
          i.oninput = function () {
            sc.value_est = i.value === '' ? null : Number(i.value);
            sc.value_rate = sc.value_est === null ? null : F.norm(sc.value_est);  /* 1–5 → 0–1 */
            recompute();
          };
        } else if (sc.value_derived) {
          /* ⭐ ③-a:本回合声明了 `evalrun` ⇒ 价值分**只读**,显示平台算出的率。
             讲师在这台机器上改不了它 —— 这正是 D04 §6.4 约束③ 的落地。
             算不出来时留空 + 把原因挂在 title 上(不回落成手填)。 */
          i.readOnly = true;
          i.style.cssText = 'width:62px;background:#f1f3f6;color:#4b5563;cursor:not-allowed;';
          i.min = 0; i.max = 1;
          i.title = '由 EvalRun 产物 + 包内参数算出，讲师不得手填（D04 §6.4 约束③）'
                    + (sc.value_why ? '｜算不出：' + sc.value_why : '');
          i.value = (sc.value_rate === null || sc.value_rate === undefined) ? '' : sc.value_rate;
        } else {
          /* ⚠️ R4/R5 的「实测价值核验产出」形态源里未定(见断面 §未决) ⇒ 暂保持手填,
             但**明说是手填,不假装它有据**。R2/R3 走上面那条只读分支。 */
          i.min = 0; i.max = 2;
          i.title = '⚠️ 手填 —— 本回合尚未声明产物依据（' + (critOf('value') || '（未定义）') + '）';
          i.value = sc.value_rate === null || sc.value_rate === undefined ? '' : sc.value_rate;
          i.oninput = function () { sc.value_rate = i.value === '' ? null : Number(i.value); recompute(); };
        }
        td.appendChild(i); return td;
      }());

      ['A', 'B', 'C', 'D'].forEach(function (k, k2) {
        var td = el('td'); if (k2 === 0) td.style.borderLeft = '1px solid #eef0f3';
        var i = inp('width:44px;'); i.type = 'number'; i.min = 1; i.max = 5;
        /* 判据按回合取(B13 修复:原先只有 D 项有 title,A/B/C 是空串 ⇒ 讲师无据可依) */
        i.title = (k + ' 项 · ' + currentRound() + ') ' + (critOf('eng' + k) || '（未定义）'));
        i.value = sc.eng[k] === undefined || sc.eng[k] === null ? '' : sc.eng[k];
        i.oninput = function () { sc.eng[k] = i.value === '' ? null : Number(i.value); recompute(); };
        td.appendChild(i); tr.appendChild(td);
      });
      ['A', 'B', 'C', 'D'].forEach(function (k, k2) {
        var td = el('td'); if (k2 === 0) td.style.borderLeft = '1px solid #eef0f3';
        var i = inp('width:44px;'); i.type = 'number'; i.min = 1; i.max = 5;
        i.title = (k + ' 项 · ' + currentRound() + ') ' + (critOf('jud' + k) || '（未定义）'));
        if (k === 'D') { i.style.borderColor = '#fcd34d'; i.style.background = '#fffbeb'; }
        i.value = sc.judge[k] === undefined || sc.judge[k] === null ? '' : sc.judge[k];
        i.oninput = function () { sc.judge[k] = i.value === '' ? null : Number(i.value); recompute(); };
        td.appendChild(i); tr.appendChild(td);
      });

      tr.appendChild(function () {
        var td = el('td', 'border-left:1px solid #eef0f3;');
        var sgs = (rspec() && rspec().softGates) || F.SOFT_GATE;
        var g = sel([['ok', '正常'], ['soft', '软门槛 ×0.7'], ['red', '🔴 红线 → 0']], 'width:112px;');
        g.title = '软门槛随回合变（本回合 ' + sgs.length + ' 项）：' + sgs.join(' / ') +
                  '。⚠️ 本控件一次只演示第 1 项；多项触发需在提交包里显式列出。';
        g.value = sc.gate || 'ok';
        g.onchange = function () {
          sc.gate = g.value;
          sc.reds = g.value === 'red' ? [F.HARD_RED[0]] : [];
          sc.gates = g.value === 'soft' ? [sgs[0]] : [];
          recompute();
        };
        td.appendChild(g); return td;
      }());

      var tdT = el('td', 'text-align:right;font-weight:700;'); tdT.id = 'tot-' + s.team_id; tr.appendChild(tdT);
      var tdR = el('td', 'text-align:right;font-weight:700;'); tdR.id = 'rk-' + s.team_id; tr.appendChild(tdR);
      tb.appendChild(tr);

      /* ⭐ ③ 结构化数值证据 —— 摆在判分行上方(它是价值分的输入,先看见才能判) */
      var evRow = numsEvidence(s);
      if (evRow) { tb.appendChild(evRow); }

      /* 该组的甲方质询应答(学员端 ④ 屏填的)—— 判 B 项(越权识别)的证据,摆在眼前省得来回切屏。
         ⚠️ 只在**有应答**时插行:空行会把判分表撑得很长,而空答本身已由 P8 记录台管。 */
      var npcAns = (s.npc_answers || []).filter(function (a) { return a && a.answer; });
      if (npcAns.length) {
        var ntr = el('tr', 'background:#fbfbfd;');
        var ntd = el('td');
        ntd.colSpan = 999;
        ntd.style.cssText = 'padding:6px 4px 10px 18px;font-size:12.5px;color:#4b5563;border-bottom:1px solid #eef0f3;';
        ntd.appendChild(el('div', 'font-weight:700;color:#5b4bd6;margin-bottom:4px;',
          '🗣 本组甲方质询应答 ' + npcAns.length + ' 条（学员端 ④ 屏）'));
        npcAns.forEach(function (a) {
          var one = el('div', 'margin:3px 0;');
          one.appendChild(el('span', 'font-weight:600;', a.q + '　'));
          one.appendChild(el('span', '', a.answer));
          ntd.appendChild(one);
        });
        ntr.appendChild(ntd);
        tb.appendChild(ntr);
      }
    });

    t.appendChild(tb);
    box.appendChild(t);

    var ac = el('div', 'display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;');
    var pub = btn('📢 发布结果到学员端', true);
    pub.onclick = function () {
      var rows = SUBS.map(function (s) {
        var r = F.score(SCORES[s.team_id]);
        return Object.assign({ team_id: s.team_id, team_name: s.team_name || s.team_id,
          score_err: s.__tampered || null }, r);
      });
      var ranked = F.rank(rows, 'total');
      var out = { round: (F.get(F.KEY.ROUND, {}) || {}).round || 'S1',
        published_at: F.stamp(),
        teams: ranked.map(function (r) { return Object.assign({}, r.row, { rank: r.rank }); }) };
      F.put(F.KEY.RESULT, out);
      flash(box, '✅ 已发布到学员端（学员刷新页面即可看到自己的成绩与排行榜）');
    };
    ac.appendChild(pub);

    var rst = btn('↺ 清空评分', false);
    rst.onclick = function () {
      if (confirm('清空所有人工分？')) { SCORES = {}; F.put(F.KEY.SCORES, {}); renderGrading(); }
    };
    ac.appendChild(rst);

    var csv = btn('⬇ 导出评分明细 CSV', false);
    csv.onclick = function () {
      var head = 'team,value_rate,engA,engB,engC,engD,judgeA,judgeB,judgeC,judgeD,gate,C,G,S,total,rank';
      var lines = [head];
      var rows2 = SUBS.map(function (s) { return { s: s, r: F.score(SCORES[s.team_id]) }; });
      var rk = F.rank(rows2.map(function (x) { return Object.assign({ team_id: x.s.team_id }, x.r); }), 'total');
      rows2.forEach(function (x) {
        var sc = SCORES[x.s.team_id], r = x.r;
        var rkRow = rk.filter(function (k) { return k.row.team_id === x.s.team_id; })[0];
        lines.push([x.s.team_id, sc.value_rate === null ? '' : sc.value_rate,
          sc.eng.A, sc.eng.B, sc.eng.C, sc.eng.D,
          sc.judge.A, sc.judge.B, sc.judge.C, sc.judge.D, sc.gate,
          r.C === null ? '' : r.C.toFixed(6), r.G, r.S,
          r.total === null ? '' : r.total.toFixed(6), rkRow ? rkRow.rank : ''].join(','));
      });
      F.download('fde_scores_' + F.isoDate() + '.csv', lines.join('\n'));
    };
    ac.appendChild(csv);
    box.appendChild(ac);

    recompute();
  }

  var _recomputeBusy = false;
  function recompute() {
    if (!SUBS.length) return;
    F.put(F.KEY.SCORES, SCORES);
    var rows = SUBS.map(function (s) {
      return Object.assign({ team_id: s.team_id }, F.score(SCORES[s.team_id]));
    });
    var rk = F.rank(rows, 'total');
    rk.forEach(function (k) {
      var t = document.getElementById('tot-' + k.row.team_id);
      var r = document.getElementById('rk-' + k.row.team_id);
      if (t) {
        t.textContent = k.value === null ? '—' : (k.value * 100).toFixed(1);
        t.style.color = k.value === null ? '#9ca3af' : (k.value === 0 ? '#b42318' : '#111827');
      }
      if (r) { r.textContent = k.rank; }
    });
    /* 汇总条 —— 必须指名道姓说差哪一项,否则讲师无从下手(首跑实测:只说"差分项"等于没说) */
    var oldS = document.getElementById('fde-summary');
    if (oldS) oldS.remove();
    var g = document.getElementById('fde-grading');
    if (g) {
      var nullRows = rows.filter(function (r) { return r.total === null; });
      var noVal = nullRows.filter(function (r) { return r.C === null && r.val === null; }).length;
      var s = el('div', 'margin-top:12px;padding:9px 12px;border-radius:8px;background:#f5f7fa;' +
        'font-size:12px;color:#374151;line-height:1.8;', '');
      s.id = 'fde-summary';
      s.innerHTML = '已评 <b>' + (rows.length - nullRows.length) + '</b> / ' + rows.length +
        (nullRows.length
          ? ' · <span style="color:#b42318">' + nullRows.length + ' 组总分算不出</span>'
            + (noVal ? '<br>其中 <b>' + noVal + ' 组缺<b>价值分</b></b> —— '
              + (isR1()
                  ? 'R1 须由讲师打「预估的可核验性」1–5(D06 v1.3 §2.1.1)：收益口径是否选对 / 基线与上限是否写明 / 关键假设是否可核验。'
                  : 'R2 起须由 EvalRun 跑出 <code>value_rate</code> 并写进提交包，讲师不得手填。') : '')
          : ' ✅ 全部可算');
      g.appendChild(s);

      /* 给"价值分未填"的输入框上警示色,和 D 项一个做法 */
      SUBS.forEach(function (sub) {
        var sc = SCORES[sub.team_id];
        var row = rows.filter(function (r) { return r.team_id === sub.team_id; })[0];
        if (!row || row.total !== null) return;
        var tr = null;
        var tis = document.querySelectorAll('#fde-grading tbody tr');
        for (var n = 0; n < tis.length; n++) { if (tis[n].children[0].textContent.indexOf(sub.team_id) === 0) { tr = tis[n]; break; } }
        if (tr && row.val === null) {
          var vi = tr.querySelectorAll('input')[0];
          if (vi) { vi.style.borderColor = '#fcd34d'; vi.style.background = '#fffbeb'; }
        }
      });
    }
  }

  /* ══════════════════ P8 · 甲方质询记录台 ══════════════════
     为什么要有这一屏(2026-09-26 判定):
       判断分 B 项(组织／越权识别,权重 .30)原先**没有任何可核查的输入** ——
       讲师凭印象打分。16_P8 §7④ 早就写了「P8 界面的真实价值在**记录**」,
       而 D06 §8 的复核门正要这批数据。所以 P8 不是"把剧本搬上屏",
       而是**把讲师脑子里的判断落成可回查的记录**。 */
  var P8 = document.getElementById('p8');
  var VERDICTS = [
    { k: 'ok',   t: '守住',  c: '#0f7a3d' },
    { k: 'over', t: '越界',  c: '#b42318' },
    { k: 'none', t: '未答',  c: '#6b7280' }
  ];
  function npcAll() { return F.get(F.KEY.NPC, {}) || {}; }
  function npcRec() { return npcAll()[roundKey() || 'R1'] || {}; }
  function npcSet(team, verdict, note) {
    var all = npcAll(), rk = roundKey() || 'R1';
    all[rk] = all[rk] || {};
    all[rk][team] = { verdict: verdict, note: note || '' };
    all[rk][team].at = F.stamp();
    F.put(F.KEY.NPC, all);
  }
  function p8Teams() {
    var cfg = F.get(F.KEY.CLASS, {}) || {};
    var out = [];
    if (cfg.team_count) {
      for (var i = 1; i <= cfg.team_count; i++) { out.push((cfg.team_prefix || 'T') + ('0' + i).slice(-2)); }
    }
    /* 也把已导入提交包里的组并进来 —— 否则没设开班配置时这一屏是空的,讲师无从记录 */
    SUBS.forEach(function (s) { if (s.team_id && out.indexOf(s.team_id) < 0) { out.push(s.team_id); } });
    return out.sort();
  }

  function buildP8() {
    if (!P8) return;
    var s = rspec();
    var pool = (s && s.npc) || [];
    var R = window.FDE_ROUNDS || {};

    var cnt = P8.querySelector('[data-fde-npc-count]');
    if (cnt) cnt.textContent = pool.length ? '（本站 ' + pool.length + ' 题，挑 2–3 句用）' : '（本站目录未提供）';
    var rl = P8.querySelector('[data-fde-npc-rule]');
    if (rl) rl.textContent = '⚠️ ' + (R.NPC_RULE || '');

    /* 题库 */
    var host = document.getElementById('fde-p8-pool');
    if (host) {
      host.textContent = '';
      if (!pool.length) {
        host.appendChild(el('div', 'font-size:13px;color:#6b7280;', '本回合目录未提供质询题。'));
      }
      pool.forEach(function (n) {
        var row = el('div', 'padding:10px 0;border-top:1px solid #eef0f3;');
        var hd = el('div', 'font-size:12.5px;font-weight:700;color:#5b4bd6;',
                    n.q + (n.mark ? ' ' + n.mark : ''));
        row.appendChild(hd);
        row.appendChild(el('div', 'font-size:14px;margin:4px 0 4px;', '「' + n.ask + '」'));
        row.appendChild(el('div', 'font-size:12px;color:#6b7280;', '依据：' + (n.basis || '（未标）')));
        host.appendChild(row);
      });
    }

    /* 8 组不等于 */
    var eq = document.getElementById('fde-p8-eq8');
    if (eq) {
      eq.textContent = '';
      (R.EQ8 || []).forEach(function (e) {
        var row = el('div', 'padding:9px 0;border-top:1px solid #eef0f3;');
        row.appendChild(el('div', 'font-size:12.5px;font-weight:700;color:#b42318;',
                           e.no + ' ' + e.trap));
        row.appendChild(el('div', 'font-size:13.5px;margin:3px 0;', '「' + e.line + '」'));
        row.appendChild(el('div', 'font-size:12px;color:#6b7280;', '为什么值钱：' + e.why));
        eq.appendChild(row);
      });
    }

    /* 分组记录 */
    var rec = document.getElementById('fde-p8-record');
    if (!rec) return;
    rec.textContent = '';
    var teams = p8Teams();
    if (!teams.length) {
      rec.appendChild(el('div', 'font-size:13px;color:#6b7280;',
        '还没有组 —— 先在⑥控制台做开班配置（设组数），或在⑦导入学员提交包。'));
      return;
    }
    var cur = npcRec();
    var tbl = el('table');
    var thead = el('thead'), hr = el('tr');
    ['组', '判定', '备注（学员说了什么、你怎么接）'].forEach(function (t) {
      hr.appendChild(el('th', 'text-align:left;', t));
    });
    thead.appendChild(hr); tbl.appendChild(thead);

    var tb = el('tbody');
    teams.forEach(function (tm) {
      var got = cur[tm] || {};
      var tr = el('tr');
      tr.appendChild(el('td', 'font-weight:700;', tm));

      var td1 = el('td'), grp = el('div', 'display:flex;gap:6px;');
      VERDICTS.forEach(function (v) {
        var b = btn(v.t);
        b.style.cssText += ';padding:3px 10px;font-size:12.5px;';
        if (got.verdict === v.k) { b.style.background = v.c; b.style.color = '#fff'; b.style.borderColor = v.c; }
        b.addEventListener('click', function () { npcSet(tm, v.k, (rec.querySelector('[data-note="' + tm + '"]') || {}).value); buildP8(); });
        grp.appendChild(b);
      });
      td1.appendChild(grp);
      tr.appendChild(td1);

      var td2 = el('td');
      var ta = inp('width:100%;');
      ta.setAttribute('data-note', tm);
      ta.placeholder = '例：答"明天能开工" → 用 ≠1 追 F04 就绪；她自己改口说"要先看准备清单"';
      ta.value = got.note || '';
      ta.addEventListener('input', function () { npcSet(tm, got.verdict || '', ta.value); });
      td2.appendChild(ta);
      tr.appendChild(td2);
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    rec.appendChild(tbl);

    /* 汇总 —— 讲师一眼看出哪组最危险 */
    var nOver = 0, nNone = 0, nOk = 0;
    teams.forEach(function (tm) {
      var v = (cur[tm] || {}).verdict;
      if (v === 'over') nOver++; else if (v === 'none') nNone++; else if (v === 'ok') nOk++;
    });
    rec.appendChild(el('div', 'font-size:12.5px;color:#6b7280;margin-top:10px;',
      '本站记录：守住 ' + nOk + ' 组 · 越界 ' + nOver + ' 组 · 未答 ' + nNone + ' 组'
      + '（越界是最值钱的课堂素材 —— 现场追一次「你凭什么这么说」，比讲十分钟管用）'));
  }

  /* ─────────── 启动 ─────────── */
  function boot() {
    if (!P6 && !P7) { console.warn('[fde] 未找到 #p6 / #p7'); return; }
    syncChrome();
    startClock();          /* 时钟同源于 published_at + 时限(C112) */
    buildP6(); renderTeams(); buildP7(); buildP8();
    console.log('[fde] 讲师端交互层已加载 · core v' + F.VERSION);
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
})();
