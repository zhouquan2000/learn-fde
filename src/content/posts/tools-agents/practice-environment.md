---
title: 工具：实操环境 VS Code + Python venv + DeepSeek 主引擎
titleEn: "Tool: Local FDE Practice Environment"
description: 一套大陆课堂可复制的 FDE 实操环境：VS Code + Python venv + DeepSeek，无额外账号依赖，断网可降级。
category: tools-agents
type: tool
audience: [practitioner, beginner]
lang: zh
source: FDE 实操环境方案（课堂实操环境约定）
date: 2026-09-16
tags: [工具, 环境, DeepSeek, venv, VS Code]
---

## 环境三件套

这是 FDE 学员和自学者的标准实操环境，刻意保持最简，让每个人都能复制：

1. **VS Code**：编辑器 + 终端。所有练习在 VS Code 里完成，不依赖任何 AI 编码助手（Copilot 之类）。
2. **Python venv**：每个项目一个虚拟环境，依赖隔离，避免"在我电脑上能跑、在你电脑上不行"。
3. **DeepSeek 主引擎**：唯一模型供应商，通过 DeepSeek API 调用。不混用多个模型商，保持环境一致、成本可控。

## 为什么是 DeepSeek

- **唯一供应商原则**：训练营约定只用一个模型商，避免学员在多套 API、多套 Key、多套接口之间踩坑。
- **大陆可达**：DeepSeek 在国内可直接访问，不需要额外的网络配置。
- **成本可控**：API 按 Token 计费，自学和课堂批量使用都在可承受范围。

## 最小可跑流程

```
# 1. 建项目 + 虚拟环境
mkdir my-fde-lab && cd my-fde-lab
python3 -m venv .venv
source .venv/bin/activate

# 2. 装 SDK
pip install openai   # DeepSeek 兼容 OpenAI 接口

# 3. 设 Key
export DEEPSEEK_API_KEY="你的key"
```

之后用一个最小脚本就能调通 DeepSeek——这是 N1 环境搭建夜的标准动作。

## 断网降级预案

课堂场景（教室投影、弱网）是设计约束，不是事后补丁：

- **环境搭建**：所有依赖（SDK、venv）提前下载好，课堂不现场 pip install。
- **模型调用**：断网时无法调 API，降级为"离线演练"——讲方法论、读案例、写提示词草稿，网络恢复后再跑。
- **文档**：关键讲义本地化，不依赖在线 CDN。

## 这套环境的目标

让学员把注意力放在"用 AI 解决问题"上，而不是"折腾环境"。环境越简单，卡住的人越少。
