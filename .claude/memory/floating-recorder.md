---
name: floating-recorder
description: 浮动录音条设计 - 替代全屏模态框的可拖动小浮窗
metadata:
  type: project
---

## 浮动录音条 (FloatingRecorder)

2026-07-17 实现，替代原来的 `VoiceRecorderModal`（全屏模态框）。

### 设计要点
- 小浮窗固定在屏幕右下角，类似 Windows 语音输入
- **不阻塞其他交互** — 浮窗开着也能点笔记、点设置
- **可拖动** — 拖动到任意位置，位置保存在 localStorage
- **焦点追踪** — 打开浮窗时保存 `document.activeElement`，全局 `focusin` 监听用户点击其他输入框时自动更新。录音按钮点击不改变 `savedTarget`
- **插入优先** — input/text → contentEditable → Obsidian MarkdownView。**不复制到剪贴板**，插不了直接报错

### 文件
- `src/ui/floating-recorder.ts` — 浮动面板类
- `src/main.ts` — 单例管理，`onload` 创建，`onunload` 销毁

### 使用流程
1. 把光标放在任意输入框
2. 点 Ribbon 图标或命令打开浮窗
3. 点 🎤 录音 → ⏹ 停止 → 文字直接插入光标位置
