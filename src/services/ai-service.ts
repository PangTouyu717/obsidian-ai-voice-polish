/**
 * DeepSeek 文本润色服务
 *
 * 调 DeepSeek Chat API 对语音转文字结果进行润色。
 * DeepSeek API 兼容 OpenAI 格式，只需改 endpoint 和模型名。
 *
 * API: https://api.deepseek.com/v1/chat/completions
 * 模型: deepseek-chat
 */

export interface PolishResult {
  original: string;
  polished: string;
}

/** 润色风格 */
export type PolishStyle = "formal" | "concise" | "casual" | "raw";

/**
 * 根据风格返回对应的 prompt 指令
 */
function styleInstruction(style: PolishStyle): string {
  const map: Record<PolishStyle, string> = {
    formal: "使文本更正式、专业，适合书面表达。修正语法错误，去掉口语化的表达。",
    concise:
      "使文本更简洁精炼，删除重复和冗余内容，保留核心信息。",
    casual:
      "保持自然的口语风格，但要通顺流畅，去掉不必要的口头禅和重复。",
    raw:
      "仅修正明显的语法错误和错别字，尽可能保持原文的表达方式和风格。不要做多余的改写。",
  };
  return map[style] ?? map.formal;
}

/** 重试间隔（毫秒） */
const RETRY_DELAYS = [1000, 3000];

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 调 DeepSeek 润色文本（带自动重试）
 *
 * @param apiKey DeepSeek API Key
 * @param text 原始文本
 * @param style 润色风格
 * @param extraInstructions 额外的自定义指令（可选）
 */
export async function polishText(
  apiKey: string,
  text: string,
  style: PolishStyle = "formal",
  extraInstructions?: string
): Promise<PolishResult> {
  const systemPrompt = `你是一个专业的文本润色助手。请对用户输入的文本进行润色。

润色要求：${styleInstruction(style)}

注意事项：
- 保留原意，不改动事实性信息
- 不要添加原文没有的信息
- 只输出润色后的文本，不要加解释、不要加引号
${extraInstructions ? `额外指示：${extraInstructions}` : ""}`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1];
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const response = await fetchWithTimeout(
        "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
            temperature: 0.7,
            max_tokens: 4096,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        // 401/403（认证问题）不重试，第一时间报给用户
        if (response.status === 401 || response.status === 403) {
          throw new Error(`DeepSeek API 认证失败 (${response.status})，请检查 API Key`);
        }
        // 429（限流）或 5xx（服务端）才重试
        if (response.status !== 429 && response.status < 500) {
          throw new Error(`DeepSeek API 错误 (${response.status}): ${err.slice(0, 200)}`);
        }
        throw new Error(`DeepSeek API 错误 (${response.status}): ${err.slice(0, 200)}`);
      }

      const data = await response.json();

      return {
        original: text,
        polished:
          data.choices?.[0]?.message?.content?.trim() ?? "",
      };
    } catch (err) {
      lastError = err;
      // 抛给上层不要重试（认证失败不用重试）
      if (err instanceof Error && err.message.includes("API 认证失败")) throw err;
      // 用尽重试次数后继续往下走
    }
  }

  // 所有重试都失败了
  const errorMessage =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`润色失败，已重试 ${RETRY_DELAYS.length} 次: ${errorMessage}`);
}

/**
 * 测试 DeepSeek API 连接是否正常
 * 发送一个简单的问候，检查能否正常响应
 */
export async function testDeepSeekConnection(
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "user", content: "Hello" },
        ],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      return { ok: true, message: "DeepSeek API 连接正常 ✅" };
    }

    const err = await response.text();
    if (response.status === 401) {
      return { ok: false, message: "API Key 无效，请检查是否正确" };
    }
    return { ok: false, message: `连接失败 (${response.status}): ${err.slice(0, 100)}` };
  } catch (err) {
    return { ok: false, message: `网络错误: ${err}` };
  }
}
