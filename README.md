# AI Voice Polish

> Voice recording → AI polish → Insert into notes. One-step voice writing workflow.

Record your voice, let AI polish the text, and insert it directly at your cursor position or create a new note. Supports multiple speech-to-text providers and mixed Chinese/English recognition.

[中文文档 ↓](#功能)

## Features

- 🎙 **Voice Recording** — Floating draggable panel, non-blocking UI
- 🤖 **Multiple STT Providers** — Volcengine / Qwen (DashScope)
- ✨ **AI Text Polishing** — DeepSeek integration, 4 styles (formal/concise/casual/raw)
- 📝 **Insert Mode** — Text goes wherever your cursor is (any input field)
- 🎵 **Note Mode** — Auto-create date-organized notes with playable audio
- 📱 **Mobile Support** — Works on iOS and Android
- 🌐 **Bilingual** — Chinese and English speech recognition

---

## 功能

- 🎙 **语音录制** — 浮动录音条不阻塞操作，可拖到任意位置
- 🤖 **多 STT 服务商** — 支持火山引擎 / 千问（通义 DashScope）
- ✨ **AI 润色** — 对接 DeepSeek，支持正式/简洁/口语化/仅纠错四种风格
- 📝 **插入模式** — 光标在哪个输入框，文字就插哪，不限于 Obsidian 编辑器
- 🎵 **笔记模式** — 自动创建带日期文件夹的笔记 + 可播放的录音音频
- 📱 **移动端支持** — 安卓/iOS 均可使用
- 🌐 **中英文识别** — 中英文混说也能正确转录

## Usage

1. Click the 💬 icon in the ribbon bar to open the floating recorder
2. Click 🎤 to start recording, click ⏹ to stop
3. Speech is automatically transcribed, polished, and inserted

### Mode Switching

Click the 📝/🎵 button on the floating panel to switch:

| Mode | Icon | Behavior |
|------|------|----------|
| Insert | 📝 | Text inserted at cursor position |
| Note | 🎵 | Creates a new markdown note with embedded audio |

## Installation

### From Community Plugins (pending review)

Search "AI Voice Polish" in Obsidian's community plugins browser.

### Manual Installation

Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/PangTouyu717/obsidian-ai-voice-polish/releases) and copy them to your vault's `.obsidian/plugins/ai-voice-polish/` folder.

## Configuration

### STT Provider

| Provider | Required Config |
|----------|---------------|
| Volcengine | Access Key + Secret Key + App ID |
| Qwen (DashScope) | API Key |

### Text Polishing

- DeepSeek API Key
- Polish style: formal / concise / casual / raw
- Custom prompt instructions

### File Paths

- Notes folder: where `.md` files are stored
- Audio folder: where `.webm`/`.mp4` files are stored

Both support date-based subfolder organization.

## Build

```bash
npm install
npm run build
```

## License

MIT
