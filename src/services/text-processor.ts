/**
 * 文本处理工具
 *
 * 负责文本的预处理和后处理：
 * - 录音文本的初步清理
 * - 润色结果的格式化
 * - 分段和排版
 */

export interface ProcessOptions {
  /** 最大段落长度（字符） */
  maxParagraphLength: number;
  /** 是否移除语气词 */
  removeFillers: boolean;
  /** 是否添加标点 */
  addPunctuation: boolean;
}

export const DEFAULT_PROCESS_OPTIONS: ProcessOptions = {
  maxParagraphLength: 500,
  removeFillers: true,
  addPunctuation: true,
};

/**
 * 对语音识别原始文本进行预处理
 * 后续可基于实际数据进行调优
 */
export function preprocessTranscription(
  text: string,
  options: Partial<ProcessOptions> = {}
): string {
  const opts = { ...DEFAULT_PROCESS_OPTIONS, ...options };
  let result = text.trim();

  if (opts.removeFillers) {
    // 移除常见语气词（中英文混合场景）
    const fillers = [
      "嗯", "呃", "那个", "这个", "就是", "然后",
      "um", "uh", "like", "you know",
    ];
    for (const filler of fillers) {
      // 使用正则替换孤立语气词（前后为边界或空格）
      const regex = new RegExp(
        `(^|\\s)${filler}(?=\\s|$|，|。|？|！)`,
        "g"
      );
      result = result.replace(regex, "$1");
    }
  }

  // 合并连续空格
  result = result.replace(/\s+/g, " ");

  return result.trim();
}

/**
 * 对润色结果进行后处理
 */
export function postprocessPolished(
  text: string,
  options: Partial<ProcessOptions> = {}
): string {
  const opts = { ...DEFAULT_PROCESS_OPTIONS, ...options };
  let result = text.trim();

  if (opts.addPunctuation) {
    // 确保文本以标点结束
    if (!/[。？！.!?]\s*$/.test(result)) {
      result += "。";
    }
  }

  // 按段落长度切分
  if (result.length > opts.maxParagraphLength) {
    result = splitIntoParagraphs(result, opts.maxParagraphLength);
  }

  return result;
}

/**
 * 按最大长度将文本切分为段落
 * 在句号/问号/感叹号处断开
 */
function splitIntoParagraphs(text: string, maxLen: number): string {
  const sentences = text.match(/[^。？！.!?]+[。？！.!?]?/g) ?? [text];
  const paragraphs: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen && current.length > 0) {
      paragraphs.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) {
    paragraphs.push(current.trim());
  }

  return paragraphs.join("\n\n");
}
