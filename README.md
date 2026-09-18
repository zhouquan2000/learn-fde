# Learn FDE 网站

AI-FDE 宝藏库网站 —— 把知识、经验、工具、Agent、Skill 全部分类收好，服务三类人：0 基础小白 / FDE 从业者 / 想落地的企业。

- 站名：Learn FDE
- 域名：learn-fde.com（主）/ learnfde.ai
- 视觉：玻璃拟态 + 霓虹渐变（用户 2026-09-16 选定）
- 语言：中英双语（中文为主，英文标题 + 术语作副标签）

## 技术栈

- Astro 5（静态生成）+ Cloudflare Pages（免费档托管）
- 内容：Markdown + frontmatter（content collections）
- 无外部 CDN 依赖，字体用系统栈（大陆可达）

## 目录结构

```
fde_web/
├── astro.config.mjs        # site=https://learn-fde.com, output=static
├── src/
│   ├── content.config.ts   # content collections schema
│   ├── content/posts/      # 内容（按分类分子目录）
│   │   ├── fde-basics/     # FDE 是什么
│   │   ├── five-stations/  # 五站方法论
│   │   ├── cases/          # 实战案例
│   │   ├── tools-agents/   # 工具与 Agent
│   │   ├── courses/        # 课程与训练营
│   │   └── enterprise/     # 行业与企业应用
│   ├── layouts/BaseLayout.astro
│   ├── components/Header.astro, Footer.astro
│   ├── lib/site.ts         # 分类/路径/标签常量
│   ├── pages/
│   │   ├── index.astro     # 首页
│   │   ├── [category].astro    # 分类页
│   │   └── posts/[...slug].astro  # 详情页
│   └── styles/global.css   # 玻璃霓虹主题 tokens
└── dist/                   # 构建产物（12 页）
```

## 开发命令

```
cd ~/fde_web
npm run dev      # 本地开发 http://localhost:4321
npm run build    # 构建到 dist/
npm run preview  # 预览构建产物
```

注意：npm install 会触发 Hermes 的 tirith 安全审批（供应链风险），需在终端手动跑或批准。

## 加新内容

1. 在 `src/content/posts/<分类>/` 下建 .md 文件。
2. frontmatter 约定（含英文冒号的值必须加引号）：

```yaml
---
title: 文章标题
titleEn: "Article Title: with colon"   # 含英文冒号要加引号
description: 一句话摘要
category: five-stations   # 六选一：fde-basics/five-stations/cases/tools-agents/courses/enterprise
type: article             # article/video/podcast/tool/agent/skill
audience: [practitioner]  # beginner/practitioner/business
lang: zh
source: 来源（溯源，永不删）
date: 2026-09-16
tags: [五站, 方法论]
---
```

3. 正文用标准 Markdown。

## 脱敏红线（用户 2026-09-16 定）

**任何客户名称不得出现。** 涉及具体企业的内容，用"某大型通信运营商""某汽车服务企业"等泛称，正文加脱敏说明。

## 术语约定（沿用 FDE 研究第 6 步定稿词）

三类价值（增收/降本/风控）、生意单元、该生意单元实际负责人、试用再采购、分角色沟通、五站（挑活→进门与诊断→证明→采纳→扩张与复制）。英文原词保留：eval / adoption / owner / day-2 / artifact。

## 部署（Cloudflare Pages，待域名 Active 后执行）

两种方式，二选一：

- **直接上传（最快）**：`npm run build` 后在 Cloudflare Pages 里 Create project → Direct Upload，拖拽 dist/ 文件夹（或用 wrangler pages deploy dist）。
- **Git 集成（长期维护推荐）**：git init + 建 GitHub 仓库 push，Cloudflare Pages 里选 Git 连接，build command = `npm run build`，output directory = `dist`。

前置：learn-fde.com 的 NS 已切 Cloudflare（hadlee/henrik），等状态变 Active 后，在 Cloudflare DNS 加记录，再绑到 Pages 项目。

## 修订记录

| 日期 | 说明 |
|---|---|
| 2026-09-16 | 初建：Astro 骨架 + C 视觉 + 首批 5 篇内容（脱敏）+ 12 页构建通过 |
