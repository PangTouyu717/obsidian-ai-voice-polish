/**
 * DeepSeek 文本润色服务
 *
 * 用 Obsidian 的 requestUrl API 代替 fetch，
 * 解决手机端 CORS 拦截问题（failed to fetch）。
 *
 * API: https://api.deepseek.com/v1/chat/completions
 * 模型: deepseek-chat
 */

import { requestUrl } from "obsidian";

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

/**
 * 调 DeepSeek 润色文本
 *
 * 使用 Obsidian 的 requestUrl 绕过 CORS 限制，
 * 手机端和桌面端都能正常工作。
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

  const body = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.5,
    max_tokens: 1024,
  };

  const response = await requestUrl({
    url: "https://api.deepseek.com/v1/chat/completions",
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (response.status !== 200) {
    throw new Error(`DeepSeek API 错误 (${response.status})`);
  }

  const data = response.json;

  return {
    original: text,
    polished:
      data.choices?.[0]?.message?.content?.trim() ?? "",
  };
}

/**
 * 测试 DeepSeek API 连接是否正常
 * 发送一个简单的问候，检查能否正常响应
 */
export async function testDeepSeekConnection(
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await requestUrl({
      url: "https://api.deepseek.com/v1/chat/completions",
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "user", content: "Hello" },
        ],
        max_tokens: 5,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status === 200) {
      return { ok: true, message: "DeepSeek API 连接正常 ✅" };
    }

    return { ok: false, message: `连接失败 (${response.status})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      return { ok: false, message: "API Key 无效，请检查是否正确" };
    }
    return { ok: false, message: `网络错误: ${msg}` };
  }
}
