/**
 * 火山引擎语音转文字服务
 *
 * 使用火山引擎（抖音云）ASR 一句话识别 API。
 * 录音 → base64 → 签名认证 → 发送识别 → 返回文本。
 *
 * API 文档：https://www.volcengine.com/docs/6561/80828
 */

import { requestUrl } from "obsidian";
import { STTProvider, STTResult } from "./stt-provider";

// ── 工具函数 ─────────────────────────────────

/** Blob 转 base64（去掉 data:... 前缀） */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Blob 转 base64 失败"));
    reader.readAsDataURL(blob);
  });
}

/** 字节数组转小写 hex 字符串 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 使用 Web Crypto API 计算 HMAC-SHA256 */
async function hmacSha256(
  secret: string,
  message: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return bytesToHex(new Uint8Array(signature));
}

// ── 签名计算 ─────────────────────────────────

/**
 * 计算火山引擎 HMAC-SHA256 签名
 *
 * StringToSign = HTTPMethod + "\n" + URI + "\n" + QueryString
 *              + "\n" + CanonicalHeaders + "\n" + SignedHeaders
 *
 * Signature = Hex(HMAC-SHA256(SecretKey, StringToSign))
 */
async function buildAuthorization(
  accessKey: string,
  secretKey: string,
  method: string,
  uri: string,
  queryString: string,
  host: string,
  date: string,
  body: string
): Promise<string> {
  const contentType = "application/json";
  const signedHeaders = "content-type;host;x-date";
  const canonicalHeaders =
    `content-type:${contentType}\nhost:${host}\nx-date:${date}\n`;

  const stringToSign = [
    method,
    uri,
    queryString,
    canonicalHeaders,
    signedHeaders,
  ].join("\n");

  const signature = await hmacSha256(secretKey, stringToSign);

  return `HMAC-SHA256 Credential=${accessKey}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

// ── 公开接口 ─────────────────────────────────

/**
 * @deprecated 使用 STTResult 替代
 */
export type VolcSTTResult = STTResult;

export class VolcengineSTT implements STTProvider {
  private accessKey: string;
  private secretKey: string;
  private appId: string;

  constructor(accessKey: string, secretKey: string, appId: string) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.appId = appId;
  }

  /**
   * 语音转文字
   *
   * @param audioBlob 录制的音频数据
   * @param audioFormat 音频格式，如 "webm" / "mp4" / "ogg"
   * @param audioEncoding 音频编码，如 "opus" / "aac"
   */
  async transcribe(
    audioBlob: Blob,
    audioFormat = "webm",
    audioEncoding = "opus"
  ): Promise<STTResult> {
    const host = "openspeech.bytedance.com";
    const uri = "/api/v1/asr";
    const date = new Date().toUTCString();

    const base64Audio = await blobToBase64(audioBlob);

    const body = {
      app: { appid: this.appId },
      audio: {
        format: audioFormat,
        rate: 16000,
        encoding: audioEncoding,
      },
      request: {
        model_name: "general",
        enable_punctuation: true,
      },
      audio_data: base64Audio,
    };

    const bodyStr = JSON.stringify(body);

    const authorization = await buildAuthorization(
      this.accessKey,
      this.secretKey,
      "POST",
      uri,
      "",
      host,
      date,
      bodyStr
    );

    const response = await requestUrl({
      url: `https://${host}${uri}`,
      method: "POST",
      contentType: "application/json",
      body: bodyStr,
      headers: {
        Host: host,
        "X-Date": date,
        Authorization: authorization,
      },
    });

    if (response.status !== 200) {
      throw new Error(`火山引擎 STT 错误 (${response.status})`);
    }

    if (response.json.code !== 0 && response.json.code !== 3000) {
      throw new Error(
        `火山引擎 STT 业务错误 (code=${response.json.code}): ${response.json.message ?? ""}`
      );
    }

    return {
      text: response.json.result?.text ?? "",
      durationSeconds: Math.round((audioBlob.size / 16000 / 2) * 10) / 10,
    };
  }
}

/**
 * 检测火山引擎配置是否完整
 */
export function isVolcConfigReady(
  accessKey: string,
  secretKey: string,
  appId: string
): boolean {
  return accessKey.length > 0 && secretKey.length > 0 && appId.length > 0;
}

/**
 * 测试火山引擎 API 连接是否正常
 * 通过构造签名请求访问 ASR API 来验证凭证有效性
 */
export async function testVolcengineConnection(
  accessKey: string,
  secretKey: string,
  appId: string
): Promise<{ ok: boolean; message: string }> {
  if (!isVolcConfigReady(accessKey, secretKey, appId)) {
    return { ok: false, message: "请先填写完整的火山引擎配置（AK/SK/AppID）" };
  }

  try {
    const host = "openspeech.bytedance.com";
    const uri = "/api/v1/asr";
    const date = new Date().toUTCString();

    // 极小音频数据（1 秒静音 PCM，仅用于验证凭证）
    const silentAudio = "AAAA";
    const body = {
      app: { appid: appId },
      audio: { format: "pcm", rate: 16000, encoding: "pcm" },
      request: { model_name: "general", enable_punctuation: false },
      audio_data: silentAudio,
    };

    const bodyStr = JSON.stringify(body);
    const authorization = await buildAuthorization(
      accessKey, secretKey, "POST", uri, "", host, date, bodyStr
    );

    const response = await requestUrl({
      url: `https://${host}${uri}`,
      method: "POST",
      contentType: "application/json",
      body: bodyStr,
      headers: {
        Host: host,
        "X-Date": date,
        Authorization: authorization,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "鉴权失败，请检查 Access Key、Secret Key 和 App ID" };
    }

    return { ok: true, message: "火山引擎 API 连接正常 ✅" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("403")) {
      return { ok: false, message: "鉴权失败，请检查 Access Key、Secret Key 和 App ID" };
    }
    return { ok: false, message: `网络错误: ${msg}` };
  }
}
