#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""port_prototype.py — 把 L7 原型单文件 HTML 机械化搬进 Astro 页面。

设计约束(每条都有理由,不是随手写的):
  1. **零转换风险优先**:原型已实测可跑,移植只做**机械切分**,不改任何标记语义。
  2. **`<style>` 必须 `is:global`** —— 应用 JS 用 `document.createElement` 生成大量 DOM,
     Astro 默认的 scoped 样式只给**模板里的**元素加 `astro-xxxx` 类,
     JS 造出来的元素拿不到 ⇒ 样式会静默失效(页面看着'没坏'但一半样式没了)。
  3. **所有 `<script>` 必须 `is:inline`** —— 标记里有 `onclick="go(1,this)"` 这类内联事件,
     依赖函数是**全局**的;Astro 默认会把 `<script>` 打包成模块并提升,全局函数就没了 ⇒ 点击全失灵。
  4. **花括号转义** —— `data-fde-h1="{S} · {N}"` 是给 JS 做字符串替换的**占位符**,
     但 Astro 模板会把 `{S}` 当表达式解析 ⇒ 用 HTML 实体 `&#123;`/`&#125;`,
     浏览器解析后属性值仍是 `{S}`,JS 逻辑完全不变(选实体而非改写,是为了不动原型)。
  5. **外部 JS 指向 `/sim/`** —— 四个 js 已复制到 `public/sim/`,保持 `?v=` 缓存戳。
"""
import io
import re
import sys
from pathlib import Path

SRC = Path('/mnt/e/AI-FDE/FDE网站/_L7_prototype')
DST = Path.home() / 'learn-fde'

TARGETS = [
    # (源文件, 输出 .astro, 页面标题, 外部脚本清单, 额外说明)
    ('l7_prototype_v0.4_student.html', 'src/pages/sim/index.astro',
     '学员端 · FDE 模拟商战',
     ['l7_core.js', 'l7_rounds.js', 'l7_student_app.js']),
    ('l7_prototype_v0.4_instructor.html', 'src/pages/sim/console/index.astro',
     '讲师端 · FDE 模拟商战',
     ['l7_core.js', 'l7_rounds.js', 'l7_pool.js', 'l7_instructor_app.js']),
]


def split_prototype(html: str):
    """切出 <style> 块、<body> 标记(不含脚本)、内联脚本、外部脚本 src。"""
    styles = re.findall(r'<style[^>]*>(.*?)</style>', html, re.S)
    body_m = re.search(r'<body[^>]*>(.*)</body>', html, re.S)
    body = body_m.group(1)

    # 抽出所有 <script>…</script>(含带 src 的)
    inline_scripts, ext_scripts = [], []
    def _take(m):
        tag = m.group(0)
        src_m = re.search(r'src="([^"]+)"', tag)
        if src_m:
            ext_scripts.append(src_m.group(1))
            return ''   # 外部脚本在页面末尾统一以 /sim/ 路径重新发出,正文里移除
        inline_scripts.append(re.search(r'<script[^>]*>(.*?)</script>', tag, re.S).group(1))
        return '\x00SCRIPT\x00'
    body = re.sub(r'<script[^>]*>.*?</script>', _take, body, flags=re.S)

    return styles, body.strip(), inline_scripts, ext_scripts


def escape_braces(s: str) -> str:
    """只转义花括号 —— {S}/{N}/{D} 是 JS 占位符,不能被 Astro 当表达式解析。"""
    return s.replace('{', '&#123;').replace('}', '&#125;')


def build_page(src_name, out_rel, title, js_files):
    html = io.open(SRC / src_name, encoding='utf-8').read()
    styles, body, inline_scripts, ext_scripts = split_prototype(html)

    # 校验:原型引用的外部脚本必须都在预期清单里(防止漏搬某个 js)
    got = [Path(s.split('?')[0]).name for s in ext_scripts]
    if sorted(got) != sorted(js_files):
        sys.exit(f'❌ {src_name}: 外部脚本清单不符 —— 原型 {got} vs 预期 {js_files}')

    v = None
    for s in ext_scripts:
        m = re.search(r'\?v=([0-9.]+)', s)
        if m:
            v = m.group(1)
    v = v or '1'
    n_scripts_placeholder = body.count('\x00SCRIPT\x00')

    parts = []
    parts.append('---\n')
    parts.append('/* ⚠️ 本文件由 _tools/port_prototype.py 从 L7 原型**机械移植**生成(勿手改)。\n')
    parts.append(f'   源:{src_name} · 重新移植:python3 _tools/port_prototype.py */\n')
    parts.append('---\n')
    parts.append('\n')
    # ⚠️ 必须有完整文档骨架 —— 第一版移植只搬了 <style> 和 body,
    #    结果产出**没有 doctype / 没有 <meta charset> / 没有 <head>**,
    #    浏览器按默认编码猜 ⇒ 全站中文乱码(2026-09-26 走查撞出)。
    parts.append('<!doctype html>\n<html lang="zh-CN" data-theme="light">\n<head>\n')
    parts.append('  <meta charset="utf-8" />\n')
    parts.append('  <meta name="viewport" content="width=device-width, initial-scale=1" />\n')
    parts.append(f'  <title>{title}</title>\n')
    parts.append('  <!-- 主题须在首次绘制前定好,否则深色用户会看到白屏闪一下 -->\n')
    parts.append("  <script is:inline>try{var t=localStorage.getItem('fde.theme');"
                 "if(t==='dark')document.documentElement.dataset.theme='dark';}catch(e){}</script>\n")
    # 全局样式:JS 生成的 DOM 不在 Astro 作用域内,必须 not-scoped
    for st in styles:
        parts.append('<style is:global>\n' + st.strip() + '\n</style>\n')
    # 顶栏 logo 回首页(原型里是 <div>,没链接;生产站必须能回去)
    parts.append('<style is:global>\n'
                 'a.logo{text-decoration:none;color:inherit}\n'
                 'a.logo:hover b{text-decoration:underline}\n'
                 '</style>\n')
    parts.append('</head>\n<body>\n')
    body = escape_braces(body)
    # 原型里 logo 是 <div class="logo">…</div>;生产站要能回首页 ⇒ 换成 <a>。
    # ⚠️ 必须**连闭合标签一起换** —— 只换开标签会让标签不配对,
    #    浏览器把其后整个顶栏吞进这个 <a> 里(2026-09-26 走查撞出:出现"链接套链接")。
    body, n_logo = re.subn(r'<div class="logo">(.*?)</div>',
                           r'<a class="logo" href="/">\1</a>', body, count=1, flags=re.S)
    if n_logo != 1:
        sys.exit(f'❌ {src_name}: logo 元素定位失败(预期恰好 1 处,实得 {n_logo})')
    # 内联脚本原样保留(且必须 is:inline,见文件头 ③)
    for code in inline_scripts:
        body = body.replace('\x00SCRIPT\x00',
                            '<script is:inline>' + code.strip() + '</script>', 1)
    # 兜底:若还有未替换的占位(说明脚本数对不上),大声报错而不是静默丢
    if '\x00SCRIPT\x00' in body:
        sys.exit(f'❌ {src_name}: 有 {body.count(chr(0)+"SCRIPT"+chr(0))} 个脚本占位未替换')
    parts.append(body + '\n')
    parts.append('\n')
    # ⚠️ 为什么把三个 `<script src>` 换成显式顺序加载 + 失败大声报错:
    #    这不是为了绕开什么 bug —— 本机无头浏览器**不执行外部脚本**
    #    (实测:连 23 字节的 `window.__probe="ok"` 用 script 标签加载都是 onload 但变量为 null,
    #     动态 createElement('script') 生成的内联脚本同样不执行),
    #    所以本机根本**无法验证 JS 运行**。既然如此,就更要让**真实浏览器**里的失败可见:
    #      ① 顺序确定(核心 → 目录 → 交互层),不依赖三个并行标签的完成次序;
    #      ② 任一文件加载失败 ⇒ 页面底部出现醒目红条并写明"报告给讲师",
    #         而不是一个"看着正常、点了没反应"的死页面(教室场景下静默失败最贵);
    #      ③ 真实用户(学员)看到红条就知道该刷新/找讲师,不用猜。
    files_js = ','.join(f"'/sim/{f}?v={v}'" for f in js_files)
    parts.append('<script is:inline>\n')
    parts.append('(function () {\n')
    parts.append(f'  var files = [{files_js}];\n')
    parts.append('  var i = 0;\n')
    parts.append('  function next() {\n')
    parts.append('    if (i >= files.length) { return; }\n')
    parts.append("    var s = document.createElement('script');\n")
    parts.append('    s.src = files[i++];\n')
    parts.append('    s.onload = next;\n')
    parts.append('    s.onerror = function () {\n')
    parts.append("      var d = document.createElement('div');\n")
    parts.append("      d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;'\n"
                 "        + 'background:#b91c1c;color:#fff;padding:10px 16px;font:13px/1.6 system-ui,sans-serif';\n")
    parts.append("      d.textContent = '⚠️ 平台脚本加载失败：' + s.src\n"
                 "        + ' —— 页面功能不可用。请刷新；若持续失败，请把这条提示报告给讲师。';\n")
    parts.append('      document.body.appendChild(d);\n')
    parts.append('    };\n')
    parts.append('    document.body.appendChild(s);\n')
    parts.append('  }\n')
    parts.append('  next();\n')
    parts.append('})();\n')
    parts.append('</script>\n')
    parts.append('</body>\n</html>\n')

    out = DST / out_rel
    out.parent.mkdir(parents=True, exist_ok=True)
    io.open(out, 'w', encoding='utf-8').write(''.join(parts))
    # ⚠️ 四个 js 必须**由移植脚本一并复制**,不能靠"手工 cp 过一次"。
    #    第一版只手动 cp 了 JS,结果原型里改了 `l7_student_app.js` 却没进站点 ——
    #    构建、测试、终检**全绿**,而产物是旧的(2026-09-26 靠 grep 产物才抓到)。
    #    判据:移植脚本必须**完整且幂等** —— 跑一遍就把站点同步到原型当前状态。
    for f in js_files:
        _src_js = (SRC / f).read_bytes()
        _dst_js = DST / 'public' / 'sim' / f
        _dst_js.parent.mkdir(parents=True, exist_ok=True)
        _dst_js.write_bytes(_src_js)
        print(f'   ↳ 复制 {f}（{len(_src_js)} bytes）')
    print(f'✅ {out_rel}  ← {src_name}')
    print(f'   样式 {len(styles)} 块 · 内联脚本 {len(inline_scripts)} 段 · '
          f'外部脚本 {len(js_files)} 个(?v={v}) · 标记 {len(body.splitlines())} 行')


if __name__ == '__main__':
    for src_name, out_rel, title, js in TARGETS:
        build_page(src_name, out_rel, title, js)
    print('\n完成。下一步:npm run build 验证。')
