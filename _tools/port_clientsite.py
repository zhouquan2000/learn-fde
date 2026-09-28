#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""port_clientsite.py — 把「仿真客户官网」搬进 Astro 的 public/。

设计约束（每条都有理由）:
  1. **走 public/ 而不是 src/pages** —— 客户官网是纯静态多页 HTML（零 JS 依赖、零外部 CDN、
     纯系统字体），不需要 Astro 编译；public/ 会被**原样复制**到 dist/，
     正好保持「部署产物 = 原型字节」的对应关系，重排风险最低。
  2. **幂等** —— 先删目标目录再整体复制。理由同 port_prototype.py 的教训：
     移植脚本必须「跑一遍就把站点同步到原型当前状态」；否则原型里删掉的页面
     会永远留在线上（构建、测试全绿，产物却是旧的）。
  3. **不带任何指向训练平台的入口** —— 客户官网是「学员去外部查到的东西」，
     页脚只有合成声明，没有「返回训练平台」（设计纪律）。
"""
import shutil
import sys
from pathlib import Path

SRC_ROOT = Path('/mnt/e/AI-FDE/FDE网站/_L7_prototype/_clientsite')
DST_ROOT = Path.home() / 'learn-fde' / 'public' / 'clients'
SITES = ['jinggong']          # 首期只做 #05 精工机械；后续期次在此追加

for name in SITES:
    src = SRC_ROOT / name
    dst = DST_ROOT / name
    if not src.is_dir():
        sys.exit(f'❌ 源目录不存在: {src}')
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)

    pages = sorted(p.relative_to(dst).as_posix() for p in dst.rglob('*.html'))
    total = sum(p.stat().st_size for p in dst.rglob('*') if p.is_file())
    print(f'✅ public/clients/{name} —— {len(pages)} 页 · {total / 1024:.1f} KB')
    for p in pages:
        print(f'   ↳ /clients/{name}/' + p.replace('index.html', ''))

print('\n完成。下一步:\n  npm run build\n  git add -A && git commit -m "..." && git push origin main')
