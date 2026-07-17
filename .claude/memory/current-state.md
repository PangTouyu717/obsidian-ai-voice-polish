---
name: current-state
description: 项目当前状态 - 代码完成，已上架社区插件市场审核中
metadata:
  type: project
---

## 项目当前状态（2026-07-17）

### ✅ 已完成

**核心功能：**
- [x] 插件基本框架（main.ts + settings.ts + 构建）
- [x] 设置界面（STT 服务商选择 + DeepSeek 配置 + 自定义 Prompt + 测试连接按钮）
- [x] 火山引擎 STT（HMAC-SHA256 签名认证）
- [x] 千问 STT（qwen-audio-turbo 原生多模态 API ✅ 最终方案）
- [x] DeepSeek 文本润色（支持自定义指令）
- [x] 浮动录音条（可拖动小浮窗，支持鼠标+触屏拖动）
- [x] 焦点追踪（光标在哪文字就插哪，不限于 Obsidian 编辑器）
- [x] 中英文语音识别
- [x] 错误码体系（E001-E401）
- [x] Vision 自动分析图片配置

**双模式：**
- [x] 📝 插入模式 — 文字插到光标位置，不产生文件
- [x] 🎵 笔记模式 — 创建带日期文件夹的笔记 + 可播放音频

**文件路径：**
- [x] 音频路径可配置：当前 `Record/audio/`
- [x] 笔记路径可配置：当前 `Record/text/`
- [x] 按日期自动分子文件夹（如 `2026-07-17/`）
- [x] 文件自动重编号（删前面的，后面的自动补上）
- [x] 音频/笔记文件夹自动创建

**上架准备：**
- [x] GitHub 仓库：https://github.com/PangTouyu717/obsidian-ai-voice-polish
- [x] Release v0.1.0 已发布（含 main.js / manifest.json / styles.css）
- [x] README.md（中英文双语）
- [x] versions.json
- [x] LICENSE（MIT）
- [x] 已提交到 community.obsidian.md 审核

**音频格式（重要）：**
- 桌面端：webm/opus（Electron 原生支持）
- 安卓端：mp4（兼容性最好）
- iOS 端：mp4（不支持 webm）

### ✅ 新修复（2026-07-17）
- [x] **插入模式事前确认**：点录音按钮前先检查光标是否在有效位置（INPUT/contentEditable/Markdown），不在则立刻提示，不让用户白录
- [x] **润色 API 加超时 + 自动重试**：30 秒超时 + 失败自动重试 2 次（间隔 1s/3s），认证错误不重试

### 📋 待办
- [ ] 等待 Obsidian 插件市场审核通过 — ✅ **已上架！**
- [ ] 上架后手机端测试
- [ ] 润色选区文本功能完善（目前只占位）
- [ ] OpenAI Whisper STT 支持
- [ ] 多润色服务商支持（目前仅 DeepSeek）

### 已知问题
- `obsidianmd/obsidian-releases` 仓库禁用了外部 PR，提交改走 community.obsidian.md 网站
