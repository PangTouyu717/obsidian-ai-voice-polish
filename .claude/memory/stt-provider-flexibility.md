---
name: stt-provider-flexibility
description: STT 服务商抽象层 - 支持火山引擎和千问等多服务商切换
metadata:
  type: reference
---

## STT 服务商架构

2026-07-17 重构：从「只能火山引擎」改为「可切换 STT 服务商」架构。

### 架构文件

- `src/services/stt-provider.ts` — 接口定义（`STTProvider`）+ 工厂函数（`createSTTProvider`）+ 配置校验
- `src/services/volcengine-stt.ts` — 火山引擎实现（`implements STTProvider`）
- `src/services/qwen-stt.ts` — 千问（DashScope Paraformer）实现
- `src/settings.ts` — 设置界面加入 STT 服务商下拉框，条件显示对应配置字段

### 当前支持的 STT 服务商

| 服务商 | 状态 | 所需配置 |
|--------|------|---------|
| 火山引擎 | ✅ 已实现 | Access Key + Secret Key + App ID |
| 千问（通义DashScope） | ✅ 已实现 | API Key |
| OpenAI Whisper | ⏳ 预留（尚未实现） | — |

### 设置界面新增/补充项

- STT 服务商下拉选择器
- 自定义润色指令（textarea，追加到系统 prompt）
- OpenAI Whisper 预留字段

### 注意事项

- 模态框每次使用时重建 STT 实例，确保配置最新
- 切换 STT 服务商后设置界面自动重绘显示对应字段
- `ai-service.ts` 的 `polishText()` 已支持 `extraInstructions` 参数
