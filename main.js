var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AiVoicePolishPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/ui/floating-recorder.ts
var import_obsidian2 = require("obsidian");

// src/services/audio-recorder.ts
var AudioRecorder = class {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.startTime = 0;
    this.stream = null;
  }
  /** 当前录制状态 */
  get state() {
    var _a, _b;
    return (_b = (_a = this.mediaRecorder) == null ? void 0 : _a.state) != null ? _b : "inactive";
  }
  /** 是否有已收集的音频数据（息屏中断后仍有数据） */
  get hasData() {
    return this.chunks.length > 0;
  }
  /**
   * 开始录制
   * @throws 如果无法获取麦克风权限
   */
  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u9EA6\u514B\u98CE\u8BBF\u95EE\u3002\u8BF7\u4F7F\u7528 Obsidian \u684C\u9762\u7248\u6216\u79FB\u52A8\u7248\uFF0C\u5E76\u786E\u4FDD\u5DF2\u6388\u4E88\u9EA6\u514B\u98CE\u6743\u9650\u3002");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });
    this.stream = stream;
    this.chunks = [];
    const priority = [
      "audio/mp4",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/aac",
      "audio/wav"
    ];
    const mimeType = priority.find(
      (type) => MediaRecorder.isTypeSupported(type)
    );
    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.mediaRecorder.start(100);
    this.startTime = Date.now();
  }
  /**
   * 停止录制并返回音频数据
   *
   * 核心原则：只要 chunks 有数据就返回，不 reject。
   * 息屏中断也好、异常也好，录了多少就给你多少。
   * @returns 录制完成的音频数据
   */
  stop() {
    if (!this.mediaRecorder && this.chunks.length > 0) {
      return this.buildAudioDataFromChunks("\u5DF2\u4E2D\u65AD");
    }
    if (!this.mediaRecorder) {
      return Promise.reject(new Error("\u6CA1\u6709\u5F55\u97F3\u6570\u636E"));
    }
    return new Promise((resolve) => {
      if (this.mediaRecorder.state === "inactive") {
        const data = this.buildAudioData("\u5DF2\u4E2D\u65AD");
        this.cleanup();
        resolve(data);
        return;
      }
      this.mediaRecorder.onstop = () => {
        const data = this.buildAudioData("\u6B63\u5E38\u7ED3\u675F");
        this.cleanup();
        resolve(data);
      };
      this.mediaRecorder.onerror = () => {
        const data = this.buildAudioData("\u5F02\u5E38\u7ED3\u675F");
        this.cleanup();
        resolve(data);
      };
      this.mediaRecorder.stop();
    });
  }
  /**
   * 用当前 chunks 拼装 AudioData
   */
  buildAudioData(_reason) {
    var _a, _b;
    const durationSeconds = (Date.now() - this.startTime) / 1e3;
    const blob = new Blob(this.chunks, {
      type: (_b = (_a = this.mediaRecorder) == null ? void 0 : _a.mimeType) != null ? _b : "audio/webm"
    });
    return {
      blob,
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      mimeType: blob.type
    };
  }
  /**
   * 从已有 chunks 构建 AudioData，不依赖 MediaRecorder 实例
   */
  buildAudioDataFromChunks(reason) {
    this.cleanup();
    const durationSeconds = (Date.now() - this.startTime) / 1e3;
    const blob = new Blob(this.chunks, {
      type: "audio/webm"
    });
    return Promise.resolve({
      blob,
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      mimeType: blob.type
    });
  }
  /**
   * 释放麦克风
   */
  cleanup() {
    var _a;
    (_a = this.stream) == null ? void 0 : _a.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
  }
  /** 取消录制（丢弃数据） */
  cancel() {
    var _a, _b;
    if (((_a = this.mediaRecorder) == null ? void 0 : _a.state) === "recording") {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    (_b = this.stream) == null ? void 0 : _b.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
};

// src/services/volcengine-stt.ts
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Blob \u8F6C base64 \u5931\u8D25"));
    reader.readAsDataURL(blob);
  });
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmacSha256(secret, message) {
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
async function buildAuthorization(accessKey, secretKey, method, uri, queryString, host, date, body) {
  const contentType = "application/json";
  const signedHeaders = "content-type;host;x-date";
  const canonicalHeaders = `content-type:${contentType}
host:${host}
x-date:${date}
`;
  const stringToSign = [
    method,
    uri,
    queryString,
    canonicalHeaders,
    signedHeaders
  ].join("\n");
  const signature = await hmacSha256(secretKey, stringToSign);
  return `HMAC-SHA256 Credential=${accessKey}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}
var VolcengineSTT = class {
  constructor(accessKey, secretKey, appId) {
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
  async transcribe(audioBlob, audioFormat = "webm", audioEncoding = "opus") {
    var _a, _b, _c;
    const host = "openspeech.bytedance.com";
    const uri = "/api/v1/asr";
    const date = (/* @__PURE__ */ new Date()).toUTCString();
    const base64Audio = await blobToBase64(audioBlob);
    const body = {
      app: { appid: this.appId },
      audio: {
        format: audioFormat,
        rate: 16e3,
        encoding: audioEncoding
      },
      request: {
        model_name: "general",
        enable_punctuation: true
      },
      audio_data: base64Audio
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
    const response = await fetch(`https://${host}${uri}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: host,
        "X-Date": date,
        Authorization: authorization
      },
      body: bodyStr
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`\u706B\u5C71\u5F15\u64CE STT \u9519\u8BEF (${response.status}): ${err}`);
    }
    const data = await response.json();
    if (data.code !== 0 && data.code !== 3e3) {
      throw new Error(
        `\u706B\u5C71\u5F15\u64CE STT \u4E1A\u52A1\u9519\u8BEF (code=${data.code}): ${(_a = data.message) != null ? _a : ""}`
      );
    }
    return {
      text: (_c = (_b = data.result) == null ? void 0 : _b.text) != null ? _c : "",
      durationSeconds: Math.round(audioBlob.size / 16e3 / 2 * 10) / 10
      // 粗略估算
    };
  }
};
function isVolcConfigReady(accessKey, secretKey, appId) {
  return accessKey.length > 0 && secretKey.length > 0 && appId.length > 0;
}
async function testVolcengineConnection(accessKey, secretKey, appId) {
  if (!isVolcConfigReady(accessKey, secretKey, appId)) {
    return { ok: false, message: "\u8BF7\u5148\u586B\u5199\u5B8C\u6574\u7684\u706B\u5C71\u5F15\u64CE\u914D\u7F6E\uFF08AK/SK/AppID\uFF09" };
  }
  try {
    const host = "openspeech.bytedance.com";
    const uri = "/api/v1/asr";
    const date = (/* @__PURE__ */ new Date()).toUTCString();
    const silentAudio = "AAAA";
    const body = {
      app: { appid: appId },
      audio: { format: "pcm", rate: 16e3, encoding: "pcm" },
      request: { model_name: "general", enable_punctuation: false },
      audio_data: silentAudio
    };
    const bodyStr = JSON.stringify(body);
    const authorization = await buildAuthorization(
      accessKey,
      secretKey,
      "POST",
      uri,
      "",
      host,
      date,
      bodyStr
    );
    const response = await fetch(`https://${host}${uri}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: host,
        "X-Date": date,
        Authorization: authorization
      },
      body: bodyStr
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "\u9274\u6743\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 Access Key\u3001Secret Key \u548C App ID" };
    }
    return { ok: true, message: "\u706B\u5C71\u5F15\u64CE API \u8FDE\u63A5\u6B63\u5E38 \u2705" };
  } catch (err) {
    return { ok: false, message: `\u7F51\u7EDC\u9519\u8BEF: ${err}` };
  }
}

// src/services/qwen-stt.ts
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Blob \u8F6C data URL \u5931\u8D25"));
    reader.readAsDataURL(blob);
  });
}
var QwenSTT = class {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  async transcribe(audioBlob, _audioFormat = "webm", _audioEncoding = "opus") {
    var _a, _b, _c, _d;
    if (!this.apiKey) {
      throw new Error("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199\u5343\u95EE API Key");
    }
    const audioDataUrl = await blobToDataUrl(audioBlob);
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "qwen-audio-turbo",
          input: {
            messages: [
              {
                role: "user",
                content: [
                  { audio: audioDataUrl },
                  { text: "Transcribe this audio to text. Auto-detect the language (Chinese, English, or mixed). Output ONLY the transcription, no explanations." }
                ]
              }
            ]
          },
          parameters: {
            result_format: "message"
          }
        })
      }
    );
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`\u5343\u95EE STT \u9519\u8BEF (${response.status}): ${err}`);
    }
    const data = await response.json();
    const content = (_d = (_c = (_b = (_a = data.output) == null ? void 0 : _a.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content;
    let text = "";
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.text)
          text += part.text;
      }
    } else if (typeof content === "string") {
      text = content;
    }
    return {
      text: text.trim(),
      durationSeconds: Math.round(audioBlob.size / 16e3 / 2 * 10) / 10
    };
  }
};
async function testQwenConnection(apiKey) {
  if (!apiKey) {
    return { ok: false, message: "\u8BF7\u5148\u586B\u5199\u5343\u95EE API Key" };
  }
  try {
    const response = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    );
    if (response.ok) {
      return { ok: true, message: "\u5343\u95EE API \u8FDE\u63A5\u6B63\u5E38 \u2705" };
    }
    if (response.status === 401) {
      return { ok: false, message: "API Key \u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u662F\u5426\u6B63\u786E" };
    }
    return { ok: false, message: `\u8FDE\u63A5\u5931\u8D25 (${response.status})` };
  } catch (err) {
    return { ok: false, message: `\u7F51\u7EDC\u9519\u8BEF: ${err}` };
  }
}

// src/services/stt-provider.ts
var STT_PROVIDER_LABELS = {
  volcengine: "\u706B\u5C71\u5F15\u64CE",
  qwen: "\u5343\u95EE\uFF08\u901A\u4E49\uFF09",
  "openai-whisper": "OpenAI Whisper"
};
function createSTTProvider(config) {
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
      throw new Error("OpenAI Whisper \u5C1A\u672A\u5B9E\u73B0\uFF0C\u656C\u8BF7\u671F\u5F85");
    default:
      throw new Error(`\u672A\u77E5\u7684 STT \u670D\u52A1\u5546: ${config.sttProvider}`);
  }
}
function isSTTConfigReady(config) {
  switch (config.sttProvider) {
    case "volcengine":
      return !!(config.volcAccessKey && config.volcSecretKey && config.volcAppId);
    case "qwen":
      return !!config.qwenApiKey;
    case "openai-whisper":
      return false;
    default:
      return false;
  }
}
function getSTTConfigHint(config) {
  switch (config.sttProvider) {
    case "volcengine": {
      const missing = [];
      if (!config.volcAccessKey)
        missing.push("Access Key");
      if (!config.volcSecretKey)
        missing.push("Secret Key");
      if (!config.volcAppId)
        missing.push("App ID");
      return `\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199\u706B\u5C71\u5F15\u64CE\u7684 ${missing.join("\u3001")}`;
    }
    case "qwen":
      return "\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199\u5343\u95EE API Key";
    case "openai-whisper":
      return "OpenAI Whisper \u5C1A\u672A\u5B9E\u73B0";
    default:
      return "\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u9009\u62E9\u5E76\u914D\u7F6E STT \u670D\u52A1\u5546";
  }
}

// src/services/ai-service.ts
var import_obsidian = require("obsidian");
function styleInstruction(style) {
  var _a;
  const map = {
    formal: "\u4F7F\u6587\u672C\u66F4\u6B63\u5F0F\u3001\u4E13\u4E1A\uFF0C\u9002\u5408\u4E66\u9762\u8868\u8FBE\u3002\u4FEE\u6B63\u8BED\u6CD5\u9519\u8BEF\uFF0C\u53BB\u6389\u53E3\u8BED\u5316\u7684\u8868\u8FBE\u3002",
    concise: "\u4F7F\u6587\u672C\u66F4\u7B80\u6D01\u7CBE\u70BC\uFF0C\u5220\u9664\u91CD\u590D\u548C\u5197\u4F59\u5185\u5BB9\uFF0C\u4FDD\u7559\u6838\u5FC3\u4FE1\u606F\u3002",
    casual: "\u4FDD\u6301\u81EA\u7136\u7684\u53E3\u8BED\u98CE\u683C\uFF0C\u4F46\u8981\u901A\u987A\u6D41\u7545\uFF0C\u53BB\u6389\u4E0D\u5FC5\u8981\u7684\u53E3\u5934\u7985\u548C\u91CD\u590D\u3002",
    raw: "\u4EC5\u4FEE\u6B63\u660E\u663E\u7684\u8BED\u6CD5\u9519\u8BEF\u548C\u9519\u522B\u5B57\uFF0C\u5C3D\u53EF\u80FD\u4FDD\u6301\u539F\u6587\u7684\u8868\u8FBE\u65B9\u5F0F\u548C\u98CE\u683C\u3002\u4E0D\u8981\u505A\u591A\u4F59\u7684\u6539\u5199\u3002"
  };
  return (_a = map[style]) != null ? _a : map.formal;
}
async function polishText(apiKey, text, style = "formal", extraInstructions) {
  var _a, _b, _c, _d, _e;
  const systemPrompt = `\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u6587\u672C\u6DA6\u8272\u52A9\u624B\u3002\u8BF7\u5BF9\u7528\u6237\u8F93\u5165\u7684\u6587\u672C\u8FDB\u884C\u6DA6\u8272\u3002

\u6DA6\u8272\u8981\u6C42\uFF1A${styleInstruction(style)}

\u6CE8\u610F\u4E8B\u9879\uFF1A
- \u4FDD\u7559\u539F\u610F\uFF0C\u4E0D\u6539\u52A8\u4E8B\u5B9E\u6027\u4FE1\u606F
- \u4E0D\u8981\u6DFB\u52A0\u539F\u6587\u6CA1\u6709\u7684\u4FE1\u606F
- \u53EA\u8F93\u51FA\u6DA6\u8272\u540E\u7684\u6587\u672C\uFF0C\u4E0D\u8981\u52A0\u89E3\u91CA\u3001\u4E0D\u8981\u52A0\u5F15\u53F7
${extraInstructions ? `\u989D\u5916\u6307\u793A\uFF1A${extraInstructions}` : ""}`;
  const body = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text }
    ],
    temperature: 0.5,
    max_tokens: 1024
  };
  const response = await (0, import_obsidian.requestUrl)({
    url: "https://api.deepseek.com/v1/chat/completions",
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
  if (response.status !== 200) {
    throw new Error(`DeepSeek API \u9519\u8BEF (${response.status})`);
  }
  const data = response.json;
  return {
    original: text,
    polished: (_e = (_d = (_c = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) == null ? void 0 : _d.trim()) != null ? _e : ""
  };
}
async function testDeepSeekConnection(apiKey) {
  try {
    const response = await (0, import_obsidian.requestUrl)({
      url: "https://api.deepseek.com/v1/chat/completions",
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "user", content: "Hello" }
        ],
        max_tokens: 5
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    if (response.status === 200) {
      return { ok: true, message: "DeepSeek API \u8FDE\u63A5\u6B63\u5E38 \u2705" };
    }
    return { ok: false, message: `\u8FDE\u63A5\u5931\u8D25 (${response.status})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      return { ok: false, message: "API Key \u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u662F\u5426\u6B63\u786E" };
    }
    return { ok: false, message: `\u7F51\u7EDC\u9519\u8BEF: ${msg}` };
  }
}

// src/ui/floating-recorder.ts
var _FloatingRecorder = class _FloatingRecorder {
  constructor(plugin) {
    this.state = "idle";
    this.rawText = "";
    this.polishedText = "";
    /** 用户录音前光标所在的元素（录音按钮不抢焦点） */
    this.savedTarget = null;
    /** 当前模式 */
    this.mode = "insert";
    /** 录音数据（笔记模式需要存到 vault） */
    this.lastAudioBlob = null;
    /** 插入原文时记录的位置（给后台润色替换用） */
    this.insertedStart = null;
    this.insertedEnd = null;
    // 拖动
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.panelStartX = 0;
    this.panelStartY = 0;
    // 计时
    this.durationTimer = null;
    this.recordStartTime = 0;
    /** 息屏检测处理器 */
    this.onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && this.state === "recording") {
        new import_obsidian2.Notice("\u23FA \u5F55\u97F3\u4ECD\u5728\u8FDB\u884C");
      } else if (document.visibilityState === "visible" && this.state === "recording") {
        if (this.recorder.state === "recording") {
          new import_obsidian2.Notice("\u2705 \u5F55\u97F3\u6B63\u5E38");
        } else if (this.recorder.state === "inactive") {
          new import_obsidian2.Notice("\u23F8 \u5F55\u97F3\u5728\u606F\u5C4F\u65F6\u5DF2\u4E2D\u65AD\uFF0C\u70B9\u505C\u6B62\u83B7\u53D6\u5DF2\u5F55\u5236\u7684\u5185\u5BB9");
          this.micBtn.style.background = "orange";
          this.micBtn.style.color = "white";
          this.statusEl.textContent = "\u5F55\u97F3\u5DF2\u4E2D\u65AD\uFF0C\u70B9\u51FB\u505C\u6B62";
        }
      }
    };
    this.plugin = plugin;
    this.recorder = new AudioRecorder();
    this.sttProvider = createSTTProvider(plugin.settings);
    this.createPanel();
    document.addEventListener("focusin", (e) => {
      if (!this.panelEl.contains(e.target)) {
        this.savedTarget = e.target;
      }
    });
  }
  // ── 面板创建 ────────────────────────────────
  createPanel() {
    this.panelEl = document.createElement("div");
    this.panelEl.className = "avp-floating-panel";
    this.micBtn = document.createElement("button");
    this.micBtn.className = "avp-floating-mic";
    this.micBtn.textContent = "\u{1F3A4}";
    this.micBtn.addEventListener("click", () => this.handleMicClick());
    this.panelEl.appendChild(this.micBtn);
    this.modeBtn = document.createElement("button");
    this.modeBtn.className = "avp-floating-mode";
    this.modeBtn.textContent = "\u{1F4DD}";
    this.modeBtn.title = "\u63D2\u5165\u6A21\u5F0F\uFF1A\u6587\u5B57\u63D2\u5165\u5149\u6807\u4F4D\u7F6E";
    this.modeBtn.addEventListener("click", () => this.toggleMode());
    this.panelEl.appendChild(this.modeBtn);
    this.statusEl = document.createElement("span");
    this.statusEl.className = "avp-floating-status";
    this.statusEl.textContent = "\u70B9\u51FB\u5F55\u97F3";
    this.panelEl.appendChild(this.statusEl);
    this.durationEl = document.createElement("span");
    this.durationEl.className = "avp-floating-duration";
    this.durationEl.textContent = "";
    this.panelEl.appendChild(this.durationEl);
    const closeBtn = document.createElement("button");
    closeBtn.className = "avp-floating-close";
    closeBtn.textContent = "\xD7";
    closeBtn.addEventListener("click", () => this.close());
    this.panelEl.appendChild(closeBtn);
    this.panelEl.addEventListener("mousedown", (e) => this.onDragStart(e));
    this.panelEl.addEventListener("touchstart", (e) => this.onDragStart(e), { passive: false });
    document.addEventListener("mousemove", (e) => this.onDragMove(e));
    document.addEventListener("touchmove", (e) => this.onDragMove(e), { passive: false });
    document.addEventListener("mouseup", () => this.onDragEnd());
    document.addEventListener("touchend", () => this.onDragEnd());
    this.restorePosition();
    document.body.appendChild(this.panelEl);
  }
  // ── 显示 / 关闭 ─────────────────────────────
  open() {
    this.savedTarget = document.activeElement;
    this.panelEl.style.display = "flex";
    this.resetAll();
  }
  close() {
    this.cleanup();
    this.panelEl.style.display = "none";
  }
  /** 完全销毁（插件卸载时调用） */
  destroy() {
    this.cleanup();
    document.removeEventListener("mousemove", (e) => this.onDragMove(e));
    document.removeEventListener("mouseup", () => this.onDragEnd());
    document.removeEventListener("touchmove", (e) => this.onDragMove(e));
    document.removeEventListener("touchend", () => this.onDragEnd());
    this.panelEl.remove();
  }
  cleanup() {
    this.cleanupDurationTimer();
    if (this.recorder.state !== "inactive") {
      this.recorder.cancel();
    }
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }
  // ── 状态机 ─────────────────────────────────
  async handleMicClick() {
    switch (this.state) {
      case "idle":
        if (this.mode === "insert") {
          const target = this.savedTarget;
          if (!target || !this.isValidTarget(target)) {
            new import_obsidian2.Notice("\u26A0\uFE0F \u63D2\u5165\u6A21\u5F0F\u5C31\u7EEA\u5931\u8D25\uFF1A\u8BF7\u5148\u628A\u5149\u6807\u653E\u5230\u8981\u8F93\u5165\u7684\u4F4D\u7F6E\uFF0C\u518D\u70B9\u51FB\u5F55\u97F3");
            return;
          }
          new import_obsidian2.Notice("\u2705 \u63D2\u5165\u6A21\u5F0F\u5DF2\u5C31\u7EEA\uFF0C\u5149\u6807\u5DF2\u5B9A\u4F4D");
        }
        await this.startRecording();
        break;
      case "recording":
        await this.stopRecording();
        break;
      case "done":
        this.resetAll();
        break;
    }
  }
  /** 判断目标是否是可插入文本的有效元素 */
  isValidTarget(target) {
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return true;
    }
    if (target.isContentEditable) {
      return true;
    }
    const view = this.plugin.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (view) {
      return true;
    }
    return false;
  }
  async startRecording() {
    if (!this.checkConfig())
      return;
    try {
      await this.recorder.start();
      this.state = "recording";
      this.recordStartTime = Date.now();
      this.micBtn.textContent = "\u23F9";
      this.micBtn.style.background = "var(--text-error)";
      this.micBtn.style.color = "white";
      this.statusEl.textContent = "\u5F55\u97F3\u4E2D... \u70B9\u51FB\u505C\u6B62";
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      this.startDurationTimer();
    } catch (err) {
      new import_obsidian2.Notice(`[E101] \u65E0\u6CD5\u542F\u52A8\u9EA6\u514B\u98CE: ${err}`);
    }
  }
  async stopRecording() {
    this.state = "stt";
    this.micBtn.textContent = "\u23F3";
    this.micBtn.style.background = "var(--interactive-accent)";
    this.micBtn.setAttr("disabled", "true");
    this.statusEl.textContent = "\u8BC6\u522B\u4E2D...";
    this.cleanupDurationTimer();
    let audioData;
    try {
      audioData = await this.recorder.stop();
    } catch (err) {
      new import_obsidian2.Notice(`[E102] \u5F55\u97F3\u5931\u8D25: ${err}`);
      this.resetAll();
      return;
    }
    if (audioData.durationSeconds < 0.5) {
      new import_obsidian2.Notice("\u5F55\u97F3\u592A\u77ED\uFF0C\u8BF7\u91CD\u65B0\u5F55\u5236");
      this.resetAll();
      return;
    }
    this.lastAudioBlob = audioData.blob;
    await this.doSTT(audioData);
  }
  // ── 语音转文字 ─────────────────────────────
  async doSTT(audioData) {
    const mime = audioData.mimeType.toLowerCase();
    let audioFormat = "webm";
    let audioEncoding = "opus";
    if (mime.includes("mp4") || mime.includes("m4a")) {
      audioFormat = "mp4";
      audioEncoding = "aac";
    } else if (mime.includes("ogg")) {
      audioFormat = "ogg";
      audioEncoding = "opus";
    }
    try {
      this.sttProvider = createSTTProvider(this.plugin.settings);
    } catch (err) {
      new import_obsidian2.Notice(`[E202] STT \u521D\u59CB\u5316\u5931\u8D25: ${err}`);
      this.resetAll();
      return;
    }
    try {
      const result = await this.sttProvider.transcribe(
        audioData.blob,
        audioFormat,
        audioEncoding
      );
      this.rawText = result.text;
      if (!this.rawText) {
        new import_obsidian2.Notice("\u672A\u80FD\u8BC6\u522B\u51FA\u6587\u5B57\uFF0C\u8BF7\u91CD\u8BD5");
        this.resetAll();
        return;
      }
      await this.insertRawText();
      this.close();
      this.backgroundPolish();
    } catch (err) {
      new import_obsidian2.Notice(`[E201] \u8BED\u97F3\u8BC6\u522B\u5931\u8D25: ${err}`);
      this.resetAll();
    }
  }
  /** 立刻插入原文（不等待润色） */
  async insertRawText() {
    const text = this.rawText || this.polishedText;
    if (!text)
      return;
    if (this.mode === "note") {
      await this.createNoteWithAudio(text);
    } else {
      await this.insertTextAtCursor(text);
    }
  }
  /** 后台润色：成功就替换原文，失败就保留原文 */
  async backgroundPolish() {
    this.state = "polishing";
    new import_obsidian2.Notice("\u23F3 \u6DA6\u8272\u4E2D...");
    try {
      const result = await polishText(
        this.plugin.settings.deepseekApiKey,
        this.rawText,
        this.plugin.settings.polishStyle,
        this.plugin.settings.customPrompt || void 0
      );
      if (!result.polished || result.polished === this.rawText) {
        new import_obsidian2.Notice("\u2139\uFE0F \u539F\u6587\u65E0\u9700\u6DA6\u8272\uFF0C\u5DF2\u4FDD\u7559\u539F\u6587");
        return;
      }
      const view = this.plugin.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
      if (view) {
        const editor = view.editor;
        if (this.insertedStart && this.insertedEnd) {
          editor.setSelection(this.insertedStart, this.insertedEnd);
          if (editor.getSelection() === this.rawText) {
            editor.replaceSelection(result.polished);
            this.insertedStart = this.insertedEnd = null;
            new import_obsidian2.Notice("\u2705 \u6DA6\u8272\u5DF2\u5B8C\u6210");
            return;
          }
        }
        const content = editor.getValue();
        const idx = content.lastIndexOf(this.rawText);
        if (idx !== -1) {
          const from = editor.offsetToPos(idx);
          const to = editor.offsetToPos(idx + this.rawText.length);
          editor.replaceRange(result.polished, from, to);
          new import_obsidian2.Notice("\u2705 \u6DA6\u8272\u5DF2\u5B8C\u6210");
          return;
        }
        try {
          await navigator.clipboard.writeText(result.polished);
          new import_obsidian2.Notice("\u2705 \u6DA6\u8272\u5B8C\u6210\uFF08\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF09");
        } catch (e) {
          new import_obsidian2.Notice("\u2705 \u6DA6\u8272\u5B8C\u6210\uFF08\u539F\u6587\u5DF2\u4FDD\u7559\uFF0C\u6DA6\u8272\u7ED3\u679C\u5982\u4E0B\uFF09\n" + result.polished.slice(0, 100));
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(result.polished);
        new import_obsidian2.Notice("\u2705 \u6DA6\u8272\u5B8C\u6210\uFF08\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF09");
      } catch (e) {
        new import_obsidian2.Notice("\u2705 \u6DA6\u8272\u5B8C\u6210");
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("\u6DA6\u8272\u5931\u8D25:", reason);
      new import_obsidian2.Notice(`\u2139\uFE0F \u6DA6\u8272\u672A\u5B8C\u6210: ${reason}`);
    }
  }
  // ── 插入到光标位置 ──────────────────────────
  /**
   * 根据当前模式处理结果：
   * - 插入模式 → 文字插入光标位置
   * - 笔记模式 → 创建新笔记（含润色文字 + 音频文件）
   */
  async insertToTarget() {
    this.state = "done";
    const text = this.polishedText || this.rawText;
    if (!text) {
      this.close();
      return;
    }
    if (this.mode === "note") {
      await this.createNoteWithAudio(text);
    } else {
      await this.insertTextAtCursor(text);
    }
  }
  /** 插入模式：文字放到光标位置 */
  async insertTextAtCursor(text) {
    var _a, _b;
    const target = this.savedTarget;
    if (!target) {
      new import_obsidian2.Notice("\u274C \u672A\u68C0\u6D4B\u5230\u5149\u6807\u4F4D\u7F6E\uFF0C\u8BF7\u5148\u70B9\u51FB\u8981\u8F93\u5165\u6587\u5B57\u7684\u5730\u65B9");
      this.close();
      return;
    }
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      const input = target;
      const start = (_a = input.selectionStart) != null ? _a : input.value.length;
      const end = (_b = input.selectionEnd) != null ? _b : input.value.length;
      input.value = input.value.substring(0, start) + text + input.value.substring(end);
      const newPos = start + text.length;
      input.selectionStart = newPos;
      input.selectionEnd = newPos;
      new import_obsidian2.Notice("\u2705 \u5DF2\u63D2\u5165");
      this.close();
      return;
    }
    if (target.isContentEditable) {
      const sel = window.getSelection();
      if (sel) {
        target.focus();
        const textNode = document.createTextNode(text);
        if (sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          r.deleteContents();
          r.insertNode(textNode);
          r.collapse(false);
        } else {
          const range = document.createRange();
          range.selectNodeContents(target);
          range.collapse(false);
          range.insertNode(textNode);
        }
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.collapse(true);
        sel.addRange(newRange);
      }
      new import_obsidian2.Notice("\u2705 \u5DF2\u63D2\u5165");
      this.close();
      return;
    }
    const view = this.plugin.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (view) {
      const editor = view.editor;
      const cursor = editor.getCursor();
      editor.replaceSelection(text);
      this.insertedStart = { ...cursor };
      this.insertedEnd = { ...editor.getCursor() };
      new import_obsidian2.Notice("\u2705 \u5DF2\u63D2\u5165");
      this.close();
      return;
    }
    new import_obsidian2.Notice("\u274C \u627E\u4E0D\u5230\u53EF\u63D2\u5165\u7684\u4F4D\u7F6E\uFF0C\u8BF7\u628A\u5149\u6807\u653E\u5728\u8F93\u5165\u6846\u4E2D\u518D\u8BD5");
    this.close();
  }
  /** 笔记模式：创建新笔记（含润色文字 + 录音音频） */
  async createNoteWithAudio(text) {
    const ts = /* @__PURE__ */ new Date();
    const y = ts.getFullYear();
    const m = (ts.getMonth() + 1).toString().padStart(2, "0");
    const d = ts.getDate().toString().padStart(2, "0");
    const fileDate = `${y}-${m}-${d}`;
    const rawAudioFolder = this.plugin.settings.audioFolder || ".";
    const rawNoteFolder = this.plugin.settings.noteFolder || ".";
    const noteFolder = rawNoteFolder === "." ? "" : `${rawNoteFolder}/`;
    const audioFolder = rawAudioFolder === "." ? "" : `${rawAudioFolder}/`;
    const noteDir = `${noteFolder}${fileDate}`;
    const audioDir = `${audioFolder}${fileDate}`;
    try {
      const allFiles = this.plugin.app.vault.getFiles();
      const pad = (n) => n.toString().padStart(2, "0");
      const todayNotes = allFiles.filter((f) => f.path.startsWith(noteDir + "/") && f.extension === "md").sort((a, b) => {
        const na = this.extractNum(a.name);
        const nb = this.extractNum(b.name);
        return na - nb;
      });
      for (let i = 0; i < todayNotes.length; i++) {
        const oldNum = this.extractNum(todayNotes[i].name);
        const newNum = i + 1;
        if (oldNum === newNum)
          continue;
        const newName = `${fileDate}-${pad(newNum)}.md`;
        const newPath = `${noteDir}/${newName}`;
        const existing = this.plugin.app.vault.getAbstractFileByPath(newPath);
        if (existing instanceof import_obsidian2.TFile && existing.path !== todayNotes[i].path) {
          await this.plugin.app.vault.delete(existing);
        }
        await this.plugin.app.vault.rename(todayNotes[i], newPath);
        const audioExts = ["webm", "mp4", "ogg", "wav", "aac", "mp3"];
        for (const ext of audioExts) {
          const oldAudioPath = `${audioDir}/${fileDate}-${pad(oldNum)}.${ext}`;
          const oldAudio = allFiles.find((f) => f.path === oldAudioPath);
          if (oldAudio) {
            const newAudioPath = `${audioDir}/${fileDate}-${pad(newNum)}.${ext}`;
            const existingAudio = this.plugin.app.vault.getAbstractFileByPath(newAudioPath);
            if (existingAudio instanceof import_obsidian2.TFile && existingAudio.path !== oldAudio.path) {
              await this.plugin.app.vault.delete(existingAudio);
            }
            await this.plugin.app.vault.rename(oldAudio, newAudioPath);
            break;
          }
        }
      }
      const nextNum = pad(todayNotes.length + 1);
      const baseName = `${fileDate}-${nextNum}`;
      if (this.lastAudioBlob) {
        const ext = this.getAudioExtension(this.lastAudioBlob.type);
        const audioPath = `${audioDir}/${baseName}.${ext}`;
        const audioDirObj = this.plugin.app.vault.getAbstractFileByPath(audioDir);
        if (!audioDirObj) {
          await this.plugin.app.vault.createFolder(audioDir);
        }
        const existingAudio = this.plugin.app.vault.getAbstractFileByPath(audioPath);
        if (existingAudio instanceof import_obsidian2.TFile) {
          await this.plugin.app.vault.delete(existingAudio);
        }
        const buffer = await this.lastAudioBlob.arrayBuffer();
        await this.plugin.app.vault.createBinary(audioPath, buffer);
        const notePath = `${noteDir}/${baseName}.md`;
        const noteDirObj = this.plugin.app.vault.getAbstractFileByPath(noteDir);
        if (!noteDirObj) {
          await this.plugin.app.vault.createFolder(noteDir);
        }
        const oldNote = this.plugin.app.vault.getAbstractFileByPath(notePath);
        if (oldNote instanceof import_obsidian2.TFile) {
          await this.plugin.app.vault.delete(oldNote);
        }
        const audioEmbed = `
![[${audioPath}]]
`;
        const noteContent = `${baseName}

#voice/${fileDate}
${audioEmbed}

${text}
`;
        const noteFile = await this.plugin.app.vault.create(notePath, noteContent);
        const leaf = this.plugin.app.workspace.getLeaf(false);
        await leaf.openFile(noteFile);
        new import_obsidian2.Notice(`\u2705 \u5DF2\u521B\u5EFA\u8BED\u97F3\u7B14\u8BB0`);
      } else {
        const notePath = `${noteDir}/${baseName}.md`;
        const noteDirObj = this.plugin.app.vault.getAbstractFileByPath(noteDir);
        if (!noteDirObj) {
          await this.plugin.app.vault.createFolder(noteDir);
        }
        const oldNote = this.plugin.app.vault.getAbstractFileByPath(notePath);
        if (oldNote instanceof import_obsidian2.TFile) {
          await this.plugin.app.vault.delete(oldNote);
        }
        const noteContent = `${baseName}

#voice/${fileDate}

${text}
`;
        const noteFile = await this.plugin.app.vault.create(notePath, noteContent);
        const leaf = this.plugin.app.workspace.getLeaf(false);
        await leaf.openFile(noteFile);
        new import_obsidian2.Notice(`\u2705 \u5DF2\u521B\u5EFA\u8BED\u97F3\u7B14\u8BB0`);
      }
    } catch (err) {
      new import_obsidian2.Notice(`\u274C \u521B\u5EFA\u7B14\u8BB0\u5931\u8D25: ${err}`);
    }
    this.close();
  }
  /** 从 MIME 类型推断音频文件扩展名 */
  getAudioExtension(mimeType) {
    const mime = mimeType.toLowerCase();
    if (mime.includes("mp4") || mime.includes("m4a"))
      return "mp4";
    if (mime.includes("ogg"))
      return "ogg";
    if (mime.includes("wav"))
      return "wav";
    if (mime.includes("aac"))
      return "aac";
    if (mime.includes("mp3"))
      return "mp3";
    return "webm";
  }
  /** 从文件名提取序号，如 "2026-07-17-02.md" → 2 */
  extractNum(fileName) {
    const match = fileName.match(/-(\d+)\.\w+$/);
    return match ? parseInt(match[1], 10) : 9999;
  }
  /** 切换模式 */
  toggleMode() {
    if (this.mode === "insert") {
      this.mode = "note";
      this.modeBtn.textContent = "\u{1F3B5}";
      this.modeBtn.title = "\u7B14\u8BB0\u6A21\u5F0F\uFF1A\u65B0\u5EFA\u7B14\u8BB0 + \u5F55\u97F3\u97F3\u9891";
      this.statusEl.textContent = "\u7B14\u8BB0+\u97F3\u9891\u6A21\u5F0F";
    } else {
      this.mode = "insert";
      this.modeBtn.textContent = "\u{1F4DD}";
      this.modeBtn.title = "\u63D2\u5165\u6A21\u5F0F\uFF1A\u6587\u5B57\u63D2\u5165\u5149\u6807\u4F4D\u7F6E";
      this.statusEl.textContent = "\u70B9\u51FB\u5F55\u97F3";
    }
  }
  // ── 配置检查 ────────────────────────────────
  checkConfig() {
    const s = this.plugin.settings;
    if (!s) {
      new import_obsidian2.Notice("[E091] \u63D2\u4EF6\u8BBE\u7F6E\u672A\u52A0\u8F7D");
      this.close();
      return false;
    }
    if (!isSTTConfigReady(s)) {
      new import_obsidian2.Notice(getSTTConfigHint(s));
      this.close();
      return false;
    }
    if (!s.deepseekApiKey) {
      new import_obsidian2.Notice("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199 DeepSeek API Key");
      this.close();
      return false;
    }
    return true;
  }
  // ── 拖动 ────────────────────────────────────
  clientX(e) {
    return "touches" in e ? e.touches[0].clientX : e.clientX;
  }
  clientY(e) {
    return "touches" in e ? e.touches[0].clientY : e.clientY;
  }
  onDragStart(e) {
    if (e.target.tagName === "BUTTON")
      return;
    if ("touches" in e)
      e.preventDefault();
    this.isDragging = true;
    this.dragStartX = this.clientX(e);
    this.dragStartY = this.clientY(e);
    this.panelStartX = this.panelEl.offsetLeft;
    this.panelStartY = this.panelEl.offsetTop;
    this.panelEl.style.cursor = "grabbing";
    this.panelEl.style.opacity = "0.85";
  }
  onDragMove(e) {
    if (!this.isDragging)
      return;
    if ("touches" in e)
      e.preventDefault();
    const dx = this.clientX(e) - this.dragStartX;
    const dy = this.clientY(e) - this.dragStartY;
    this.panelEl.style.left = `${this.panelStartX + dx}px`;
    this.panelEl.style.top = `${this.panelStartY + dy}px`;
    this.panelEl.style.right = "auto";
    this.panelEl.style.bottom = "auto";
  }
  onDragEnd() {
    if (!this.isDragging)
      return;
    this.isDragging = false;
    this.panelEl.style.cursor = "grab";
    this.panelEl.style.opacity = "1";
    try {
      localStorage.setItem(
        _FloatingRecorder.POSITION_KEY,
        JSON.stringify({
          left: this.panelEl.style.left,
          top: this.panelEl.style.top
        })
      );
    } catch (e) {
    }
  }
  restorePosition() {
    try {
      const saved = localStorage.getItem(_FloatingRecorder.POSITION_KEY);
      if (saved) {
        const pos = JSON.parse(saved);
        if (pos.left)
          this.panelEl.style.left = pos.left;
        if (pos.top)
          this.panelEl.style.top = pos.top;
        this.panelEl.style.right = "auto";
        this.panelEl.style.bottom = "auto";
        return;
      }
    } catch (e) {
    }
    this.panelEl.style.right = "24px";
    this.panelEl.style.bottom = "80px";
    this.panelEl.style.left = "auto";
    this.panelEl.style.top = "auto";
  }
  // ── 计时器 ─────────────────────────────────
  startDurationTimer() {
    this.durationTimer = window.setInterval(() => {
      const secs = Math.floor((Date.now() - this.recordStartTime) / 1e3);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      this.durationEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
    }, 200);
  }
  cleanupDurationTimer() {
    if (this.durationTimer !== null) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
    this.durationEl.textContent = "";
  }
  // ── 重置 ───────────────────────────────────
  resetAll() {
    this.state = "idle";
    this.micBtn.textContent = "\u{1F3A4}";
    this.micBtn.style.background = "";
    this.micBtn.removeAttribute("disabled");
    this.durationEl.textContent = "";
    this.cleanupDurationTimer();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    if (this.mode === "note") {
      this.statusEl.textContent = "\u7B14\u8BB0+\u97F3\u9891\u6A21\u5F0F";
    } else {
      this.statusEl.textContent = "\u70B9\u51FB\u5F55\u97F3";
    }
  }
};
// 位置存储 key
_FloatingRecorder.POSITION_KEY = "avp-floating-pos";
var FloatingRecorder = _FloatingRecorder;

// src/settings.ts
var import_obsidian3 = require("obsidian");
var DEFAULT_SETTINGS = {
  sttProvider: "volcengine",
  volcAccessKey: "",
  volcSecretKey: "",
  volcAppId: "",
  qwenApiKey: "",
  openaiApiKey: "",
  audioFolder: "voice",
  noteFolder: "",
  deepseekApiKey: "",
  polishStyle: "formal",
  customPrompt: "",
  autoInsert: true
};
var AiVoicePolishSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AI Voice Polish \u8BBE\u7F6E" });
    containerEl.createEl("h3", { text: "\u{1F3A4} \u8BED\u97F3\u8F6C\u6587\u5B57\uFF08STT\uFF09" });
    new import_obsidian3.Setting(containerEl).setName("STT \u670D\u52A1\u5546").setDesc("\u9009\u62E9\u8BED\u97F3\u8F6C\u6587\u5B57\u7684\u670D\u52A1\u63D0\u4F9B\u5546").addDropdown((dropdown) => {
      const providers = [
        "volcengine",
        "qwen",
        "openai-whisper"
      ];
      for (const p of providers) {
        const label = p === "openai-whisper" ? `${STT_PROVIDER_LABELS[p]} (\u5373\u5C06\u652F\u6301)` : STT_PROVIDER_LABELS[p];
        dropdown.addOption(p, label);
      }
      dropdown.setValue(this.plugin.settings.sttProvider).onChange(async (value) => {
        this.plugin.settings.sttProvider = value;
        await this.plugin.saveSettings();
        this.display();
      });
    });
    if (this.plugin.settings.sttProvider === "volcengine") {
      containerEl.createEl("p", {
        text: "\u5728\u706B\u5C71\u5F15\u64CE\u63A7\u5236\u53F0\u521B\u5EFA\u8BED\u97F3\u8BC6\u522B\u5E94\u7528\u83B7\u53D6\u51ED\u8BC1\u3002",
        cls: "setting-item-description"
      });
      new import_obsidian3.Setting(containerEl).setName("Access Key").setDesc("\u706B\u5C71\u5F15\u64CE\u7684 Access Key").addText(
        (text) => text.setPlaceholder("AK...").setValue(this.plugin.settings.volcAccessKey).onChange(async (value) => {
          this.plugin.settings.volcAccessKey = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian3.Setting(containerEl).setName("Secret Key").setDesc("\u706B\u5C71\u5F15\u64CE\u7684 Secret Key").addText((text) => {
        text.setPlaceholder("SK...").setValue(this.plugin.settings.volcSecretKey).onChange(async (value) => {
          this.plugin.settings.volcSecretKey = value;
          await this.plugin.saveSettings();
        });
        text.inputEl.type = "password";
      });
      new import_obsidian3.Setting(containerEl).setName("App ID").setDesc("\u706B\u5C71\u5F15\u64CE\u8BED\u97F3\u8BC6\u522B\u5E94\u7528\u7684 App ID").addText(
        (text) => text.setPlaceholder("4xxxxxxxxxx").setValue(this.plugin.settings.volcAppId).onChange(async (value) => {
          this.plugin.settings.volcAppId = value;
          await this.plugin.saveSettings();
        })
      );
      this.addTestButton("\u6D4B\u8BD5\u706B\u5C71\u5F15\u64CE\u8FDE\u63A5", async () => {
        const s = this.plugin.settings;
        return testVolcengineConnection(s.volcAccessKey, s.volcSecretKey, s.volcAppId);
      });
    }
    if (this.plugin.settings.sttProvider === "qwen") {
      containerEl.createEl("p", {
        text: "\u5728\u963F\u91CC\u4E91\u6A21\u578B\u670D\u52A1\u7075\u79EF\uFF08DashScope\uFF09\u521B\u5EFA API Key\u3002",
        cls: "setting-item-description"
      });
      new import_obsidian3.Setting(containerEl).setName("API Key").setDesc("\u5343\u95EE\uFF08DashScope\uFF09\u7684 API Key\uFF0C\u4EE5 sk- \u5F00\u5934").addText((text) => {
        text.setPlaceholder("sk-...").setValue(this.plugin.settings.qwenApiKey).onChange(async (value) => {
          this.plugin.settings.qwenApiKey = value;
          await this.plugin.saveSettings();
        });
        text.inputEl.type = "password";
      });
      this.addTestButton("\u6D4B\u8BD5\u5343\u95EE\u8FDE\u63A5", async () => {
        return testQwenConnection(this.plugin.settings.qwenApiKey);
      });
    }
    if (this.plugin.settings.sttProvider === "openai-whisper") {
      containerEl.createEl("p", {
        text: "OpenAI Whisper \u652F\u6301\u5C1A\u672A\u5B8C\u6210\uFF0C\u656C\u8BF7\u671F\u5F85\u3002",
        cls: "setting-item-description"
      });
      new import_obsidian3.Setting(containerEl).setName("API Key").setDesc("OpenAI API Key\uFF08\u9884\u7559\u5B57\u6BB5\uFF09").addText((text) => {
        text.setPlaceholder("sk-...").setValue(this.plugin.settings.openaiApiKey).onChange(async (value) => {
          this.plugin.settings.openaiApiKey = value;
          await this.plugin.saveSettings();
        });
        text.inputEl.type = "password";
      });
    }
    containerEl.createEl("h3", { text: "\u{1F4C2} \u6587\u4EF6\u5B58\u653E\u8DEF\u5F84" });
    containerEl.createEl("p", {
      text: "\u7B14\u8BB0\u6A21\u5F0F\u548C\u97F3\u9891\u6587\u4EF6\u7684\u5B58\u653E\u4F4D\u7F6E\uFF0C\u76F8\u5BF9\u4E8E vault \u6839\u76EE\u5F55\u3002\u7559\u7A7A\u8868\u793A vault \u6839\u76EE\u5F55\u3002",
      cls: "setting-item-description"
    });
    new import_obsidian3.Setting(containerEl).setName("\u7B14\u8BB0\u5B58\u653E\u6587\u4EF6\u5939").setDesc("\u8BED\u97F3\u7B14\u8BB0 .md \u6587\u4EF6\u7684\u5B58\u653E\u8DEF\u5F84").addText(
      (text) => text.setPlaceholder("\u7559\u7A7A = vault \u6839\u76EE\u5F55").setValue(this.plugin.settings.noteFolder).onChange(async (value) => {
        this.plugin.settings.noteFolder = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u97F3\u9891\u5B58\u653E\u6587\u4EF6\u5939").setDesc("\u5F55\u97F3\u97F3\u9891 .webm \u6587\u4EF6\u7684\u5B58\u653E\u8DEF\u5F84").addText(
      (text) => text.setPlaceholder('\u9ED8\u8BA4 "voice"').setValue(this.plugin.settings.audioFolder).onChange(async (value) => {
        this.plugin.settings.audioFolder = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u270D\uFE0F \u6587\u672C\u6DA6\u8272\uFF08DeepSeek\uFF09" });
    containerEl.createEl("p", {
      text: "\u4F7F\u7528 DeepSeek Chat API \u5BF9\u8BED\u97F3\u8F6C\u6587\u5B57\u7ED3\u679C\u8FDB\u884C\u6DA6\u8272\u3002",
      cls: "setting-item-description"
    });
    new import_obsidian3.Setting(containerEl).setName("API Key").setDesc("DeepSeek \u7684 API Key").addText((text) => {
      text.setPlaceholder("sk-...").setValue(this.plugin.settings.deepseekApiKey).onChange(async (value) => {
        this.plugin.settings.deepseekApiKey = value;
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "password";
    });
    this.addTestButton("\u6D4B\u8BD5 DeepSeek \u8FDE\u63A5", async () => {
      return testDeepSeekConnection(this.plugin.settings.deepseekApiKey);
    });
    new import_obsidian3.Setting(containerEl).setName("\u6DA6\u8272\u98CE\u683C").setDesc("\u9009\u62E9 AI \u6DA6\u8272\u7684\u9ED8\u8BA4\u98CE\u683C").addDropdown(
      (dropdown) => dropdown.addOption("formal", "\u6B63\u5F0F").addOption("concise", "\u7B80\u6D01").addOption("casual", "\u53E3\u8BED\u5316").addOption("raw", "\u4EC5\u4FEE\u6B63\u9519\u8BEF").setValue(this.plugin.settings.polishStyle).onChange(async (value) => {
        this.plugin.settings.polishStyle = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u81EA\u5B9A\u4E49\u6DA6\u8272\u6307\u4EE4").setDesc(
      "\u989D\u5916\u7684\u6DA6\u8272\u8981\u6C42\uFF0C\u4F1A\u8FFD\u52A0\u5230\u7CFB\u7EDF prompt \u672B\u5C3E\u3002\u4F8B\u5982\uFF1A\u8BF7\u4F7F\u7528 Markdown \u683C\u5F0F\u8F93\u51FA"
    ).addTextArea(
      (text) => text.setPlaceholder("\u4F8B\u5982\uFF1A\u4F7F\u7528\u5217\u8868\u5F62\u5F0F\u8F93\u51FA\u8981\u70B9...").setValue(this.plugin.settings.customPrompt).onChange(async (value) => {
        this.plugin.settings.customPrompt = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u81EA\u52A8\u63D2\u5165").setDesc(
      "\u5F00\u542F\u540E\uFF0C\u6DA6\u8272\u5B8C\u6210\u76F4\u63A5\u63D2\u5165\u7B14\u8BB0\uFF0C\u8DF3\u8FC7\u9884\u89C8\u786E\u8BA4\u3002\u5173\u95ED\u5219\u4F1A\u663E\u793A\u6DA6\u8272\u7ED3\u679C\u8BA9\u4F60\u786E\u8BA4\u3002"
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoInsert).onChange(async (value) => {
        this.plugin.settings.autoInsert = value;
        await this.plugin.saveSettings();
      })
    );
  }
  /**
   * 添加一个"测试连接"按钮，点击后执行测试并显示结果
   */
  addTestButton(label, testFn) {
    const setting = new import_obsidian3.Setting(this.containerEl).setDesc("").addButton((btn) => {
      btn.setButtonText("\u6D4B\u8BD5\u8FDE\u63A5");
      btn.onClick(async () => {
        btn.setButtonText("\u23F3 \u6D4B\u8BD5\u4E2D...");
        btn.setDisabled(true);
        try {
          const result = await testFn();
          btn.setButtonText("\u6D4B\u8BD5\u8FDE\u63A5");
          btn.setDisabled(false);
          if (result.ok) {
            new import_obsidian3.Notice(result.message, 3e3);
            setting.setDesc(`\u2705 ${result.message}`);
          } else {
            new import_obsidian3.Notice(`\u274C ${result.message}`, 5e3);
            setting.setDesc(`\u274C ${result.message}`);
          }
        } catch (err) {
          btn.setButtonText("\u6D4B\u8BD5\u8FDE\u63A5");
          btn.setDisabled(false);
          setting.setDesc(`\u274C \u6D4B\u8BD5\u5F02\u5E38: ${err}`);
        }
      });
    });
  }
};

// src/main.ts
var MIC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`;
var AiVoicePolishPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.floatingRecorder = null;
  }
  async onload() {
    await this.loadSettings();
    console.log("AI Voice Polish: onload started");
    (0, import_obsidian4.addIcon)("avp-mic", MIC_ICON);
    this.floatingRecorder = new FloatingRecorder(this);
    this.addCommand({
      id: "open-voice-recorder",
      name: "\u6253\u5F00\u8BED\u97F3\u5F55\u5236\u5668",
      icon: "avp-mic",
      callback: () => {
        this.openRecorder();
      }
    });
    this.addCommand({
      id: "polish-selected-text",
      name: "\u6DA6\u8272\u9009\u4E2D\u7684\u6587\u672C",
      callback: () => {
        this.polishSelectedText();
      }
    });
    const ribbonIcon = this.addRibbonIcon("message-square", "AI Voice Polish", () => {
      this.openRecorder();
    });
    ribbonIcon.setAttribute("data-avp-ribbon", "true");
    console.log("AI Voice Polish: ribbon icon added");
    this.addSettingTab(new AiVoicePolishSettingTab(this.app, this));
    console.log("AI Voice Polish: onload complete");
  }
  onunload() {
    if (this.floatingRecorder) {
      this.floatingRecorder.destroy();
      this.floatingRecorder = null;
    }
  }
  /** 打开浮动录音条 */
  openRecorder() {
    if (this.floatingRecorder) {
      this.floatingRecorder.open();
    }
  }
  /** 润色当前编辑器中选中的文本 */
  async polishSelectedText() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    if (!view) {
      new import_obsidian4.Notice("\u6CA1\u6709\u6253\u5F00\u7684\u7F16\u8F91\u5668");
      return;
    }
    const editor = view.editor;
    const selectedText = editor.getSelection();
    if (!selectedText) {
      new import_obsidian4.Notice("\u8BF7\u5148\u9009\u4E2D\u8981\u6DA6\u8272\u7684\u6587\u672C");
      return;
    }
    new import_obsidian4.Notice("\u6DA6\u8272\u529F\u80FD\u5C06\u5728\u540E\u7EED\u7248\u672C\u5B9E\u73B0");
  }
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
