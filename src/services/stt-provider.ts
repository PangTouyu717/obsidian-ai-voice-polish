/**
 * STT（语音转文字）服务商抽象层
 *
 * 定义统一的 STTProvider 接口，各服务商分别实现。
 * 通过工厂函数 createSTTProvider 根据配置创建对应实例。
 */

import { VolcengineSTT } from "./volcengine-stt";
import { QwenSTT } from "./qwen-stt";

export interface STTResult {
  text: string;
  durationSeconds: number;
}

export interface STTProvider {
  transcribe(
    audioBlob: Blob,
    audioFormat?: string,
    audioEncoding?: string
  ): Promise<STTResult>;
}

export type STTProviderType = "volcengine" | "qwen" | "openai-whisper";

export const STT_PROVIDER_LABELS: Record<STTProviderType, string> = {
  volcengine: "火山引擎",
  qwen: "千问（通义）",
  "openai-whisper": "OpenAI Whisper",
};

export interface STTProviderConfig {
  sttProvider: STTProviderType;
  volcAccessKey: string;
  volcSecretKey: string;
  volcAppId: string;
  qwenApiKey: string;
  openaiApiKey: string;
}

/**
 * 根据配置创建 STT 服务实例
 */
export function createSTTProvider(config: STTProviderConfig): STTProvider {
  switch (config.sttProvider) {
    case "volcengine":
      return new VolcengineSTT(
        config.volcAccessKey,
        config.volcSecretKey,
        config.volcAppId
      );
    case "qwen":
      return new QwenSTT(config.qwenApiKey);
    case "openai-whisper":
      throw new Error("OpenAI Whisper 尚未实现，敬请期待");
    default:
      throw new Error(`未知的 STT 服务商: ${config.sttProvider}`);
  }
}

/**
 * 检查当前选择的 STT 服务商配置是否完整
 */
export function isSTTConfigReady(config: STTProviderConfig): boolean {
  switch (config.sttProvider) {
    case "volcengine":
      return !!(
        config.volcAccessKey &&
        config.volcSecretKey &&
        config.volcAppId
      );
    case "qwen":
      return !!config.qwenApiKey;
    case "openai-whisper":
      return false;
    default:
      return false;
  }
}

/**
 * 返回配置不完整的提示文字
 */
export function getSTTConfigHint(config: STTProviderConfig): string {
  switch (config.sttProvider) {
    case "volcengine": {
      const missing: string[] = [];
      if (!config.volcAccessKey) missing.push("Access Key");
      if (!config.volcSecretKey) missing.push("Secret Key");
      if (!config.volcAppId) missing.push("App ID");
      return `请在设置中填写火山引擎的 ${missing.join("、")}`;
    }
    case "qwen":
      return "请在设置中填写千问 API Key";
    case "openai-whisper":
      return "OpenAI Whisper 尚未实现";
    default:
      return "请先在设置中选择并配置 STT 服务商";
  }
}
