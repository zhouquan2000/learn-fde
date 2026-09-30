#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sync_case05_claim.py — 把 #05 的 B 组（问才给）实物同步到站点 public/。

为什么要有这个脚本（而不是手工 cp 一次）：
  与 port_prototype.py 同一教训 —— 手工 copy 过一次就会「源改了、站点还是旧的」，
  构建/测试全绿而产物是旧的。判据：**同步脚本必须完整且幂等**。

关键设计：
  · 文件名用**不可猜的短哈希**（Cloudflare Pages 不开目录列表，
    学员只有通过「申领台」命中后拿到的 URL 才能取到文件）；
  · 页面上的下载名用 <a download="友好名"> 指定 ⇒ 学员下载到的仍是可读文件名；
  · 源文件在讲师侧（`_讲师侧_#05_PoC/02_隐形数据_B组/`），**不放进网站目录**，
    由本脚本单向同步 ⇒ 讲师侧仍是唯一真源。
运行：python3 _tools/sync_case05_claim.py
"""
import hashlib
import os
import shutil
from pathlib import Path

SRC = Path('/mnt/e/AI-FDE/FDE-Skill/10_第10步_FDE训练营课程设计V2/_讲师侧_#05_PoC/02_隐形数据_B组')
DST = Path.home() / 'learn-fde' / 'public' / 'case05' / 'B组_隐形数据'

# (讲师侧源文件名, 站点上的短哈希名)  —— 哈希名必须与 l7_student_app.js 里 C5_CLAIM 的 file 一致
MAP = [
    ('焊接缺陷临时跟踪表.xlsx', '1f3c9a7d.xlsx'),
    ('不合格品控制程序_D0版.docx', '6b2e4f08.docx'),
]

DST.mkdir(parents=True, exist_ok=True)
ok = True
for name, hashed in MAP:
    s = SRC / name
    if not s.exists():
        print(f'❌ 讲师侧源文件缺失：{s}')
        ok = False
        continue
    d = DST / hashed
    shutil.copyfile(s, d)
    h = hashlib.sha256(d.read_bytes()).hexdigest()[:16]
    print(f'✅ {hashed}  ← {name}  ({d.stat().st_size} bytes, sha256:{h})')
    # 断言：哈希名必须真的出现在**学员端 JS 原型**里，否则学员永远拿不到它
    # （必须查原型而不是 public/sim/ —— 后者由 port_prototype.py 稍后才同步过来，
    #   查它会误报「学员取不到」，那是同步顺序问题、不是清单问题）
    js = Path('/mnt/e/AI-FDE/FDE网站/_L7_prototype/l7_student_app.js')
    if js.exists() and hashed not in js.read_text(encoding='utf-8'):
        print(f'   ⚠️ l7_student_app.js 的申领清单里没有 {hashed} —— 这个文件学员取不到')

if not ok:
    raise SystemExit(1)
print('完成。下一步：python3 _tools/port_prototype.py && npm run build')
