import {
  App,
  Modal,
  Notice,
  MarkdownView,
} from "obsidian";
import AiVoicePolishPlugin from "../main";
import { AudioRecorder, AudioData } from "../services/audio-recorder";
import {
  createSTTProvider,
  isSTTConfigReady,
  getSTTConfigHint,
  STTProvider,
} from "../services/stt-provider";
import { polishText, PolishStyle } from "../services/ai-service";

/**
 * 语音录制 → STT（可切换服务商）→ DeepSeek 润色 → 插入笔记
 *
 * 错误码说明：
 * E001 - 打开模态框失败
 * E099 - 按钮点击未捕获异常
 * E101 - 麦克风启动失败（getUserMedia）
 * E102 - 停止录音失败
 * E201 - 语音识别 API 调用失败
 * E202 - 重建 STT 实例失败
 * E301 - DeepSeek 润色 API 调用失败
 * E401 - 创建笔记失败
 */
export class VoiceRecorderModal extends Modal {
  private plugin: AiVoicePolishPlugin;

  private recorder: AudioRecorder;
  private sttProvider: STTProvider;

  /** 当前状态 */
  private state:
    | "idle"
    | "recording"
    | "stt"
    | "polishing"
    | "preview"
    | "done" = "idle";

  /** 当前录制时长定时器 */
  private durationTimer: number | null = null;

  // DOM 元素
  private statusEl!: HTMLElement;
  private actionBtn!: HTMLElement;
  private durationEl!: HTMLElement;
  private previewContainer!: HTMLElement;
  private polishedTextEl!: HTMLTextAreaElement;

  // 管线数据
  private rawText = "";
  private polishedText = "";

  constructor(app: App, plugin: AiVoicePolishPlugin) {
    super(app);
    this.plugin = plugin;
    this.recorder = new AudioRecorder();
    // STT 实例在每次使用时重建，确保配置最新
    this.sttProvider = createSTTProvider(plugin.settings);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    this.modalEl.style.width = "520px";

    contentEl.createEl("h2", { text: "🎙 AI 语音润色" });

    // 状态文字
    this.statusEl = contentEl.createEl("p", {
      text: "点击按钮开始录音",
      cls: "avp-status-text",
    });

    // 录制时长
    this.durationEl = contentEl.createEl("p", {
      text: "",
      cls: "avp-duration-text",
    });

    // 按钮
    const btnContainer = contentEl.createDiv({
      cls: "avp-button-container",
    });
    this.actionBtn = btnContainer.createEl("button", {
      text: "⏺ 开始录音",
      cls: "avp-record-btn",
    });
    this.actionBtn.addEventListener("click", () => {
      this.handleAction().catch((err) => {
        new Notice(`[E099] 操作失败: ${err?.message || err}`);
        console.error("VoicePolish E099:", err);
        this.resetAll();
      });
    });

    // 预览区域（初始隐藏）
    this.previewContainer = contentEl.createDiv({
      cls: "avp-preview-container",
    });
    this.previewContainer.style.display = "none";

    this.previewContainer.createEl("h3", { text: "润色结果" });

    this.polishedTextEl = this.previewContainer.createEl("textarea", {
      cls: "avp-textarea",
    });
    this.polishedTextEl.rows = 8;
    this.polishedTextEl.placeholder = "润色后的文本将显示在这里...";
    this.polishedTextEl.addEventListener("input", () => {
      this.polishedText = this.polishedTextEl.value;
    });

    const actionRow = this.previewContainer.createDiv({
      cls: "avp-action-row",
    });

    const insertBtn = actionRow.createEl("button", {
      text: "📝 插入笔记",
      cls: "avp-insert-btn",
    });
    insertBtn.addEventListener("click", () => this.insertToNote());

    const reRecordBtn = actionRow.createEl("button", {
      text: "🔄 重新录制",
      cls: "avp-rerecord-btn",
    });
    reRecordBtn.addEventListener("click", () => this.resetAll());
  }

  onClose() {
    this.cleanupDurationTimer();
    this.contentEl.empty();
  }

  // ── 状态机 ─────────────────────────────────

  private async handleAction() {
    switch (this.state) {
      case "idle":
        await this.startRecording();
        break;
      case "recording":
        await this.stopRecording();
        break;
      case "preview":
        this.close();
        break;
    }
  }

  /** 检查配置是否完整 */
  private checkConfig(): boolean {
    const s = this.plugin.settings;

    if (!s) {
      new Notice("[E091] 插件设置未加载，请重启 Obsidian");
      this.close();
      return false;
    }

    // 检查 STT 配置
    if (!isSTTConfigReady(s)) {
      const hint = getSTTConfigHint(s);
      new Notice(hint);
      this.close();
      return false;
    }

    // 检查润色配置
    if (!s.deepseekApiKey) {
      new Notice("请先在设置中填写 DeepSeek API Key");
      this.close();
      return false;
    }

    return true;
  }

  // ── 录音 ───────────────────────────────────

  private async startRecording() {
    if (!this.checkConfig()) return;

    try {
      await this.recorder.start();
      this.state = "recording";
      this.actionBtn.textContent = "⏹ 停止录音";
      this.statusEl.textContent = "🔴 录音中... 说完后点击停止";
      this.startDurationTimer();
    } catch (err) {
      const msg = err?.message || err;
      new Notice(`[E101] 无法启动麦克风: ${msg}。请确保已连接麦克风并授予权限。`);
      console.error("VoicePolish E101:", err);
    }
  }

  private async stopRecording() {
    this.state = "stt";
    this.actionBtn.textContent = "⏳ 识别中...";
    this.actionBtn.setAttr("disabled", "true");
    this.statusEl.textContent = "🔄 正在将语音转为文字...";
    this.cleanupDurationTimer();

    let audioData: AudioData;
    try {
      audioData = await this.recorder.stop();
    } catch (err) {
      new Notice(`[E102] 录音失败: ${err?.message || err}`);
      console.error("VoicePolish E102:", err);
      this.resetAll();
      return;
    }

    if (audioData.durationSeconds < 0.5) {
      new Notice("录音太短，请重新录制");
      this.resetAll();
      return;
    }

    await this.doSTT(audioData);
  }

  // ── 语音转文字 ─────────────────────────────

  private async doSTT(audioData: AudioData) {
    // 根据 blob 类型推断音频格式
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

    // 每次使用时重建 STT 实例（确保配置最新）
    try {
      this.sttProvider = createSTTProvider(this.plugin.settings);
    } catch (err) {
      new Notice(`[E202] STT 服务初始化失败: ${err?.message || err}`);
      console.error("VoicePolish E202:", err);
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
        new Notice("未能识别出文字，请重试");
        this.resetAll();
        return;
      }

      await this.doPolish();
    } catch (err) {
      new Notice(`[E201] 语音识别失败: ${err?.message || err}`);
      console.error("VoicePolish E201:", err);
      this.resetAll();
    }
  }

  // ── AI 润色 ────────────────────────────────

  private async doPolish() {
    this.state = "polishing";
    this.statusEl.textContent = "🔄 AI 正在润色文本...";

    try {
      const result = await polishText(
        this.plugin.settings.deepseekApiKey,
        this.rawText,
        this.plugin.settings.polishStyle as PolishStyle,
        this.plugin.settings.customPrompt || undefined
      );
      this.polishedText = result.polished;

      if (this.plugin.settings.autoInsert) {
        await this.insertToNoteInternal(this.polishedText);
        return;
      }

      this.showPreview();
    } catch (err) {
      new Notice(`[E301] 润色失败: ${err?.message || err}`);
      console.error("VoicePolish E301:", err);
      this.polishedText = this.rawText;
      this.showPreview();
    }
  }

  // ── 预览 ───────────────────────────────────

  private showPreview() {
    this.state = "preview";
    this.actionBtn.textContent = "✅ 完成";
    this.actionBtn.removeAttribute("disabled");
    this.previewContainer.style.display = "block";
    this.polishedTextEl.value = this.polishedText;
    this.statusEl.textContent = "✅ 处理完成，可编辑或直接插入笔记";
  }

  // ── 插入笔记 ───────────────────────────────

  private insertToNote() {
    const text = this.polishedTextEl.value.trim();
    if (!text) {
      new Notice("没有可插入的文本");
      return;
    }
    this.insertToNoteInternal(text);
  }

  private async insertToNoteInternal(text: string) {
    this.state = "done";

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (view) {
      const editor = view.editor;
      editor.replaceSelection(text);
      new Notice("✅ 已插入当前笔记");
      this.close();
      return;
    }

    try {
      const fileName = `语音笔记 ${new Date().toISOString().slice(0, 10)}.md`;
      const file = await this.app.vault.create(fileName, text);
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      new Notice("✅ 已创建新语音笔记");
      this.close();
    } catch (err) {
      new Notice(`[E401] 创建笔记失败: ${err?.message || err}`);
    }
  }

  // ── 计时器 ─────────────────────────────────

  private startDurationTimer() {
    const start = Date.now();
    this.durationTimer = window.setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      const min = Math.floor(secs / 60);
      const s = secs % 60;
      this.durationEl.textContent = `⏱ ${min}:${s.toString().padStart(2, "0")}`;
    }, 200);
  }

  private cleanupDurationTimer() {
    if (this.durationTimer !== null) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
    this.durationEl.textContent = "";
  }

  // ── 重置 ───────────────────────────────────

  private resetAll() {
    this.state = "idle";
    this.actionBtn.textContent = "⏺ 开始录音";
    this.actionBtn.removeAttribute("disabled");
    this.statusEl.textContent = "点击按钮开始录音";
    this.previewContainer.style.display = "none";
    this.polishedTextEl.value = "";
    this.rawText = "";
    this.polishedText = "";
    this.cleanupDurationTimer();
  }
}
