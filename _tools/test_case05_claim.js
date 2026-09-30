#!/usr/bin/env node
/* test_case05_claim.js — 验证 B 组申领台的匹配逻辑
   ⚠️ 不是「重写一遍逻辑来测」：直接从**原型 l7_student_app.js** 里抽出
      C5_CLAIM / c5Norm / c5Match 三段真实代码拿去跑 —— 测的是出货代码本身。
   运行：node _tools/test_case05_claim.js  */
import fs from 'fs';
const P = '/mnt/e/AI-FDE/FDE网站/_L7_prototype/l7_student_app.js';
const src = fs.readFileSync(P, 'utf8');

const a = src.indexOf('var C5_CLAIM = [');
const b = src.indexOf('function c5LogRead()');
if (a < 0 || b < 0) { console.error('❌ 抽取失败：未找到 C5_CLAIM / c5LogRead'); process.exit(1); }
const snippet = src.slice(a, b) + '\n; return { C5_CLAIM: C5_CLAIM, c5Match: c5Match, c5Norm: c5Norm };';
const api = new Function(snippet)();

const CASES = [
  ['质检员手里那张自己记的临时跟踪表',            'hit',  'B1'],
  ['系统里多出来的那几个缺陷类目',                'hit',  'B1'],
  ['夜班加严到底是怎么规定的',                    'hit',  'B1'],
  ['焊机异响通常是什么原因',                      'hit',  'B2'],
  ['同一焊点返修2次以上要做什么',                 'hit',  'B2'],
  ['老师傅有没有不成文的规矩',                    'hit',  'B2'],
  ['谁在算报废这件账',                            'hit',  'B3'],
  ['过杀造成的损失有没有人统计',                  'hit',  'B3'],
  ['除了考核表还有没有别的损失口径',              'hit',  'B3'],
  ['改造窗口是哪几天，能停多久',                  'hit',  'B4'],
  ['旧的那份处置程序作废了，现在以哪份为准',      'hit',  'B5'],
  ['给我一份资料',                                'miss', ''],
  ['你们公司的情况介绍一下',                      'miss', ''],
  ['',                                            'empty',''],
];

let pass = 0, fail = 0;
for (const [q, kind, id] of CASES) {
  const m = api.c5Match(q);
  const ok = m.kind === kind && (kind !== 'hit' || m.item.id === id);
  if (ok) { pass++; } else { fail++; }
  const got = m.kind === 'hit' ? m.item.id : (m.kind === 'ambiguous' ? 'ambiguous:' + m.items.map(i => i.id).join('/') : m.kind);
  console.log(`${ok ? '✅' : '❌'} ${kind.padEnd(6)} 期望 ${(id || kind).padEnd(10)} 实得 ${String(got).padEnd(10)} 「${q || '(空)'}」`);
}

/* 覆盖度自检：每个条目至少有一条问法能命中它 —— 否则那条材料学员永远拿不到 */
const hitIds = new Set();
const MORE = ['焊接缺陷临时跟踪表','口头规则','没人统计的损失','改造窗口','现行有效的那份控制程序'];
MORE.forEach(q => { const m = api.c5Match(q); if (m.kind === 'hit') hitIds.add(m.item.id); });
const all = api.C5_CLAIM.map(i => i.id);
const unreachable = all.filter(x => !hitIds.has(x));
console.log(`\n条目数 ${all.length}（${all.join('/')}）· 清单可命中 ${hitIds.size} 条`);
if (unreachable.length) { console.log('⚠️ 无可命中问法的条目：' + unreachable.join('/')); fail++; }

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
