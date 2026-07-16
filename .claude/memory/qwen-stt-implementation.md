---
name: qwen-stt-implementation
description: 千问 STT 的最终实现方案 - 使用 qwen-audio-turbo 原生多模态 API
metadata:
  type: reference
---

## 千问 STT 实现

**最终方案：** `qwen-audio-turbo` 通过 DashScope 原生多模态 API。
**文件：** `src/services/qwen-stt.ts`

### 演进过程
1. `paraformer-v2` → 400 url error（只接受 file_urls）
2. `paraformer-realtime-v2` → 400 url error（同）
3. `qwen-audio-turbo` via compatible-mode → 404 model_not_supported
4. ✅ `qwen-audio-turbo` via 原生 API → 成功

### API 细节
- 端点：`POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- 音频格式：`data:audio/webm;base64,xxx`（data URL）
- 提示词用英文：`"Transcribe this audio to text. Auto-detect the language (Chinese, English, or mixed)..."` 确保中英文都能识别
- 响应解析：`data.output.choices[0].message.content[{text: ...}]`

### 当前状态
- 火山引擎 STT：`src/services/volcengine-stt.ts`（使用 HMAC-SHA256 签名）
- 千问 STT：`src/services/qwen-stt.ts`（使用 qwen-audio-turbo）
- OpenAI Whisper：预留 `"openai-whisper"` 选项但未实现
