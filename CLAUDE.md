# Obsidian AI 语音润色插件

## 项目身份

这是一个 Obsidian 插件，提供「语音输入 → AI 润色 → 插入笔记」的完整工作流。
项目专属会话入口：在此目录下运行 `claude` 进入开发模式。

## 目录结构

```
obsidian-ai-voice-polish/
├── CLAUDE.md                   # 项目宪法（本文件）
├── manifest.json               # Obsidian 插件清单
├── package.json                # Node.js 依赖
├── tsconfig.json               # TypeScript 配置
├── build.mjs                   # esbuild 构建配置
├── .gitignore                  # Git 忽略规则
├── .claude/
│   └── settings.json           # Claude Code 项目设置
├── src/
│   ├── main.ts                 # 插件入口，注册命令与事件
│   ├── settings.ts             # 插件设置界面
│   ├── ui/
│   │   └── modal.ts            # 语音录制的模态框
│   ├── services/
│   │   ├── audio-recorder.ts   # 音频录制服务
│   │   ├── ai-service.ts       # AI API 调用服务
│   │   └── text-processor.ts   # 文本润色处理
│   └── utils/
│       └── helpers.ts          # 工具函数
├── styles.css                   # 插件样式
└── memory/                      # Claude Code 项目记忆（自动管理）
```

## 核心命令

```bash
npm install          # 安装依赖
npm run build        # 构建插件（输出到当前目录）
npm run dev          # 开发模式（监听文件变化）
```

每次构建后，将 `main.js` + `manifest.json` + `styles.css` 复制到
`.obsidian/plugins/ai-voice-polish/` 即可在 Obsidian 中加载。

## 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| 框架 | Obsidian API + TypeScript | 原生插件标准 |
| 构建 | esbuild | Obsidian 官方推荐，极速 |
| 包管理 | npm | 生态标准 |
| 样式 | 原生 CSS | 避免额外依赖，轻量 |

## 架构原则

1. **单向数据流**：录制 → 转写 → 润色 → 插入，每一步可独立开发和测试
2. **可插拔 AI 服务**：AI 服务层封装为接口，支持 OpenAI、本地模型等多后端
3. **异步优先**：所有音频处理、网络请求使用 async/await，不阻塞 UI
4. **Obsidian 原生体验**：遵循插件开发最佳实践，使用 Obsidian 的设置面板、Modal、Command 体系
5. **错误透明**：所有失败都有用户可见的提示，不静默吞掉错误

## 编码规范

- **命名**：变量/函数用 camelCase，类名用 PascalCase，常量用 UPPER_SNAKE_CASE
- **类型**：尽可能导出 TypeScript 类型定义，不滥用 `any`
- **注释**：公共 API 用 JSDoc 注释；复杂逻辑写「为什么」，不写「是什么」
- **文件职责**：每文件不超过 200 行，职责单一
- **导入顺序**：内置模块 → 第三方库 → 本地模块（空行分隔）

## 未来功能路线（设计时预留扩展点）

- [ ] 语音录制（浏览器 MediaRecorder / 桌面麦克风）
- [ ] 语音转文字（Whisper API）
- [ ] AI 润色（可选多轮、多种风格）
- [ ] 插入当前笔记 / 新建笔记
- [ ] 自定义润色 prompt 模板
- [ ] 多语言支持
- [ ] 支持本地模型（Ollama 等）
- [ ] 离线语音识别

## 关键 API 参考（Obsidian）

| API | 用途 |
|-----|------|
| `Plugin` | 插件基类，注册命令、设置、事件 |
| `PluginSettingTab` | 设置面板 |
| `Modal` | 自定义模态框 |
| `Notice` | 通知提示 |
| `App.vault` | 读写笔记 |
| `Workspace.getActiveViewOfType` | 获取当前编辑视图 |
| `Editor` | 编辑器操作（读写选区、插入文本） |

## 决策日志

| 日期 | 决策 | 原因 |
|------|------|------|
| - | - | - |

> **对 AI 的指令**：在开始任何代码改动前，先阅读 `CLAUDE.md` 确认架构一致性。重大设计决策追加到决策日志。

## AI 行为规则（自动执行，无需询问）

1. **图片自动分析**：当用户发送图片地址（`.png` / `.jpg` / `.jpeg` / `.webp` 文件路径），
   自动调用 `vision` skill 分析图片内容。不需要询问用户是否要分析，直接执行。
   用户发的图片文件通常位于 `D:\PhotoVideo\Photo\` 或 `/d/PhotoVideo/Photo/` 目录。
   Vision 工具路径：`/c/Users/29035/.claude/skills/vision/vision.py`
   Python 路径：`/c/Users/29035/AppData/Local/Programs/Python/Python312/python.exe`
   API Key 环境变量：`DASHSCOPE_API_KEY`（已设置）
