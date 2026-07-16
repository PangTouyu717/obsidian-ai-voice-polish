/**
 * 千问（通义 DashScope）语音转文字服务
 *
 * 使用 qwen-audio-turbo 模型通过 DashScope 原生多模态 API 进行语音转文字。
 * 将音频编码为 data URL，避免 Paraformer ASR 的 URL 限制和 compatible-mode 的模型限制。
 *
 * 原生 API: POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
 * 模型: qwen-audio-turbo
 */

import { STTProvider, STTResult } from "./stt-provider";

/** Blob 转完整 data URL（如 "data:audio/webm;base64,xxx"） */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Blob 转 data URL 失败"));
    reader.readAsDataURL(blob);
  });
}

export class QwenSTT implements STTProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioBlob: Blob,
    _audioFormat = "webm",
    _audioEncoding = "opus"
  ): Promise<STTResult> {
    if (!this.apiKey) {
      throw new Error("请先在设置中填写千问 API Key");
    }

    const audioDataUrl = await blobToDataUrl(audioBlob);

    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-audio-turbo",
          input: {
            messages: [
              {
                role: "user",
                content: [
                  { audio: audioDataUrl },
                  { text: "Transcribe this audio to text. Auto-detect the language (Chinese, English, or mixed). Output ONLY the transcription, no explanations." },
                ],
              },
            ],
          },
          parameters: {
            result_format: "message",
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`千问 STT 错误 (${response.status}): ${err}`);
    }

    const data = await response.json();

    // 原生多模态 API 响应格式: output.choices[0].message.content[{text: ...}]
    const content = data.output?.choices?.[0]?.message?.content;
    let text = "";
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.text) text += part.text;
      }
    } else if (typeof content === "string") {
      text = content;
    }

    return {
      text: text.trim(),
      durationSeconds: Math.round((audioBlob.size / 16000 / 2) * 10) / 10,
    };
  }
}

/**
 * 测试千问（DashScope）API 连接是否正常
 */
export async function testQwenConnection(
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  if (!apiKey) {
    return { ok: false, message: "请先填写千问 API Key" };
  }

  try {
    const response = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (response.ok) {
      return { ok: true, message: "千问 API 连接正常 ✅" };
    }

    if (response.status === 401) {
      return { ok: false, message: "API Key 无效，请检查是否正确" };
    }
    return { ok: false, message: `连接失败 (${response.status})` };
  } catch (err) {
    return { ok: false, message: `网络错误: ${err}` };
  }
}
