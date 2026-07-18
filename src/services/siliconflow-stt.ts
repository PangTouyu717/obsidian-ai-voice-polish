/**
 * 硅基流动 (SiliconFlow) 语音转文字服务
 *
 * 使用 SenseVoiceSmall 模型，OpenAI 兼容 API 格式（multipart/form-data）。
 * 永久免费，中文识别效果优于 Whisper，国内直连无需 VPN。
 *
 * API: POST https://api.siliconflow.cn/v1/audio/transcriptions
 * 模型: FunAudioLLM/SenseVoiceSmall
 * 文档: https://docs.siliconflow.cn/cn/api-reference/audio/transcriptions
 */

import { requestUrl } from "obsidian";
import { STTProvider, STTResult } from "./stt-provider";

/** Blob 转 ArrayBuffer */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Blob 转 ArrayBuffer 失败"));
    reader.readAsArrayBuffer(blob);
  });
}

/** 根据 MIME 类型推断文件扩展名 */
function mimeToExtension(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("aac")) return "mp4";
  if (mimeType.includes("ogg") || mimeType.includes("opus")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "webm";
}

/** 构造 multipart/form-data 请求体 */
function buildMultipartBody(
  audioBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  model: string
): { body: ArrayBuffer; contentType: string } {
  const boundary =
    "----SiliconFlowBoundary" + Math.random().toString(36).substring(2);
  const encoder = new TextEncoder();

  const parts: Uint8Array[] = [];

  // model 字段
  parts.push(
    encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`
    )
  );

  // file 字段头
  parts.push(
    encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    )
  );

  // file 二进制数据
  parts.push(new Uint8Array(audioBuffer));

  // 结束边界
  parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));

  // 合并所有部分
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return {
    body: result.buffer,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export class SiliconFlowSTT implements STTProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "FunAudioLLM/SenseVoiceSmall") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async transcribe(
    audioBlob: Blob,
    _audioFormat?: string,
    _audioEncoding?: string
  ): Promise<STTResult> {
    if (!this.apiKey) {
      throw new Error("请先在设置中填写硅基流动 API Key");
    }

    const mimeType = audioBlob.type || "audio/webm";
    const extension = mimeToExtension(mimeType);
    const fileName = `audio.${extension}`;

    const audioBuffer = await blobToArrayBuffer(audioBlob);
    const { body, contentType } = buildMultipartBody(
      audioBuffer,
      fileName,
      mimeType,
      this.model
    );

    const response = await requestUrl({
      url: "https://api.siliconflow.cn/v1/audio/transcriptions",
      method: "POST",
      contentType,
      body,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (response.status !== 200) {
      const errMsg =
        (response.json as any)?.error?.message ??
        `HTTP ${response.status}`;
      throw new Error(`硅基流动 STT 错误: ${errMsg}`);
    }

    const data = response.json as { text: string };
    const text = data.text?.trim() ?? "";

    return {
      text,
      durationSeconds:
        Math.round((audioBlob.size / 16000 / 2) * 10) / 10,
    };
  }
}

/**
 * 测试硅基流动 API 连接是否正常
 */
export async function testSiliconFlowConnection(
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  if (!apiKey) {
    return { ok: false, message: "请先填写硅基流动 API Key" };
  }

  try {
    const response = await requestUrl({
      url: "https://api.siliconflow.cn/v1/models",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status === 200) {
      return { ok: true, message: "硅基流动 API 连接正常 ✅" };
    }

    if (response.status === 401) {
      return { ok: false, message: "API Key 无效，请检查是否正确" };
    }
    return { ok: false, message: `连接失败 (${response.status})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `网络错误: ${msg}` };
  }
}
