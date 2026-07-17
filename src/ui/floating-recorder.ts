import {
  Notice,
  MarkdownView,
  TFile,
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

type RecorderState = "idle" | "recording" | "stt" | "polishing" | "done";
type RecorderMode = "insert" | "note";

/**
 * 可拖动的浮动录音条 — 类似 Windows 语音输入小浮窗
 *
 * - 光标在哪，文字就插在哪（input / textarea / contenteditable / Markdown）
 * - 不阻塞其他交互，可拖动
 */
export class FloatingRecorder {
  private plugin: AiVoicePolishPlugin;
  private recorder: AudioRecorder;
  private sttProvider: STTProvider;

  private state: RecorderState = "idle";
  private rawText = "";
  private polishedText = "";

  /** 用户录音前光标所在的元素（录音按钮不抢焦点） */
  private savedTarget: HTMLElement | null = null;

  /** 当前模式 */
  private mode: RecorderMode = "insert";

  // DOM
  private panelEl!: HTMLElement;
  private micBtn!: HTMLElement;
  private modeBtn!: HTMLElement;
  private statusEl!: HTMLElement;
  private durationEl!: HTMLElement;

  /** 录音数据（笔记模式需要存到 vault） */
  private lastAudioBlob: Blob | null = null;

  /** 插入原文时记录的位置（给后台润色替换用） */
  private insertedStart: { line: number; ch: number } | null = null;
  private insertedEnd: { line: number; ch: number } | null = null;

  // 拖动
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panelStartX = 0;
  private panelStartY = 0;

  // 计时
  private durationTimer: number | null = null;
  private recordStartTime = 0;

  // 位置存储 key
  private static POSITION_KEY = "avp-floating-pos";

  constructor(plugin: AiVoicePolishPlugin) {
    this.plugin = plugin;
    this.recorder = new AudioRecorder();
    this.sttProvider = createSTTProvider(plugin.settings);
    this.createPanel();

    // 全局监听焦点变化：用户点到哪，就记住哪
    document.addEventListener("focusin", (e) => {
      if (!this.panelEl.contains(e.target as Node)) {
        this.savedTarget = e.target as HTMLElement;
      }
    });
  }

  // ── 面板创建 ────────────────────────────────

  private createPanel() {
    this.panelEl = document.createElement("div");
    this.panelEl.className = "avp-floating-panel";

    // 录音按钮
    this.micBtn = document.createElement("button");
    this.micBtn.className = "avp-floating-mic";
    this.micBtn.textContent = "🎤";
    this.micBtn.addEventListener("click", () => this.handleMicClick());
    this.panelEl.appendChild(this.micBtn);

    // 模式切换按钮
    this.modeBtn = document.createElement("button");
    this.modeBtn.className = "avp-floating-mode";
    this.modeBtn.textContent = "📝";
    this.modeBtn.title = "插入模式：文字插入光标位置";
    this.modeBtn.addEventListener("click", () => this.toggleMode());
    this.panelEl.appendChild(this.modeBtn);

    // 状态文字
    this.statusEl = document.createElement("span");
    this.statusEl.className = "avp-floating-status";
    this.statusEl.textContent = "点击录音";
    this.panelEl.appendChild(this.statusEl);

    // 时长
    this.durationEl = document.createElement("span");
    this.durationEl.className = "avp-floating-duration";
    this.durationEl.textContent = "";
    this.panelEl.appendChild(this.durationEl);

    // 关闭按钮
    const closeBtn = document.createElement("button");
    closeBtn.className = "avp-floating-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => this.close());
    this.panelEl.appendChild(closeBtn);

    // 拖动（鼠标 + 触屏）
    this.panelEl.addEventListener("mousedown", (e) => this.onDragStart(e));
    this.panelEl.addEventListener("touchstart", (e) => this.onDragStart(e), { passive: false });
    document.addEventListener("mousemove", (e) => this.onDragMove(e));
    document.addEventListener("touchmove", (e) => this.onDragMove(e), { passive: false });
    document.addEventListener("mouseup", () => this.onDragEnd());
    document.addEventListener("touchend", () => this.onDragEnd());

    // 恢复上次位置
    this.restorePosition();

    // 追加到 body
    document.body.appendChild(this.panelEl);
  }

  // ── 显示 / 关闭 ─────────────────────────────

  open() {
    // 记住当前焦点位置（用户打开浮窗前可能已经把光标放在输入框了）
    this.savedTarget = document.activeElement as HTMLElement;
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

  private cleanup() {
    this.cleanupDurationTimer();
    if (this.recorder.state !== "inactive") {
      this.recorder.cancel();
    }
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  // ── 状态机 ─────────────────────────────────

  private async handleMicClick() {
    switch (this.state) {
      case "idle":
        if (this.mode === "insert") {
          // 插入模式：录音前先检查光标是否在有效位置
          const target = this.savedTarget;
          if (!target || !this.isValidTarget(target)) {
            new Notice("⚠️ 插入模式就绪失败：请先把光标放到要输入的位置，再点击录音");
            return;
          }
          new Notice("✅ 插入模式已就绪，光标已定位");
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
  private isValidTarget(target: HTMLElement): boolean {
    // input / textarea
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return true;
    }
    // contentEditable（含 CodeMirror 等富文本编辑器）
    if ((target as HTMLElement).isContentEditable) {
      return true;
    }
    // Obsidian Markdown 编辑器
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      return true;
    }
    return false;
  }

  /** 息屏检测处理器（用于清理） */
  private onVisibilityChange = () => {
    if (document.visibilityState === "hidden" && this.state === "recording") {
      new Notice("⏺ 录音在后台继续运行");
    } else if (document.visibilityState === "visible" && this.state === "recording") {
      // 亮屏后检测录音是否还活着
      if (this.recorder.state === "inactive" && this.recorder.hasData) {
        new Notice("🔁 检测到录音中断，正在处理已录制的音频...");
        this.stopRecording();
      } else if (this.recorder.state === "recording") {
        new Notice("✅ 录音一切正常");
      }
    }
  };

  private async startRecording() {
    if (!this.checkConfig()) return;

    try {
      await this.recorder.start();
      this.state = "recording";
      this.recordStartTime = Date.now();
      this.micBtn.textContent = "⏹";
      this.micBtn.style.background = "var(--text-error)";
      this.micBtn.style.color = "white";
      this.statusEl.textContent = "录音中... 点击停止";

      document.addEventListener("visibilitychange", this.onVisibilityChange);
      this.startDurationTimer();
    } catch (err) {
      new Notice(`[E101] 无法启动麦克风: ${err}`);
    }
  }

  private async stopRecording() {
    this.state = "stt";
    this.micBtn.textContent = "⏳";
    this.micBtn.style.background = "var(--interactive-accent)";
    this.micBtn.setAttr("disabled", "true");
    this.statusEl.textContent = "识别中...";
    this.cleanupDurationTimer();

    let audioData: AudioData;
    try {
      audioData = await this.recorder.stop();
    } catch (err) {
      new Notice(`[E102] 录音失败: ${err}`);
      this.resetAll();
      return;
    }

    if (audioData.durationSeconds < 0.5) {
      new Notice("录音太短，请重新录制");
      this.resetAll();
      return;
    }

    // 保存音频 blob（笔记模式要用）
    this.lastAudioBlob = audioData.blob;

    await this.doSTT(audioData);
  }

  // ── 语音转文字 ─────────────────────────────

  private async doSTT(audioData: AudioData) {
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
      new Notice(`[E202] STT 初始化失败: ${err}`);
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

      // 先插原文 → 用户立刻看到文字，不等待润色
      await this.insertRawText();
      // 关闭浮窗，返回正常编辑状态
      this.close();

      // 后台润色
      this.backgroundPolish();
    } catch (err) {
      new Notice(`[E201] 语音识别失败: ${err}`);
      this.resetAll();
    }
  }

  /** 立刻插入原文（不等待润色） */
  private async insertRawText() {
    const text = this.rawText || this.polishedText;
    if (!text) return;

    if (this.mode === "note") {
      await this.createNoteWithAudio(text);
    } else {
      await this.insertTextAtCursor(text);
    }
  }

  /** 后台润色：成功就替换原文，失败就保留原文 */
  private async backgroundPolish() {
    this.state = "polishing";
    new Notice("⏳ 润色中...");

    try {
      const result = await polishText(
        this.plugin.settings.deepseekApiKey,
        this.rawText,
        this.plugin.settings.polishStyle as PolishStyle,
        this.plugin.settings.customPrompt || undefined
      );

      if (!result.polished || result.polished === this.rawText) {
        new Notice("ℹ️ 原文无需润色，已保留原文");
        return;
      }

      // 尝试替换：先按记录的位置替换，失败再全文搜索
      const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        const editor = view.editor;

        // 1️⃣ 按记录的位置替换（用户没动过原文 → 最精确）
        if (this.insertedStart && this.insertedEnd) {
          editor.setSelection(this.insertedStart, this.insertedEnd);
          if (editor.getSelection() === this.rawText) {
            editor.replaceSelection(result.polished);
            this.insertedStart = this.insertedEnd = null;
            new Notice("✅ 润色已完成");
            return;
          }
        }

        // 2️⃣ 用户可能改过原文 → 全文搜索容错
        const content = editor.getValue();
        const idx = content.lastIndexOf(this.rawText);
        if (idx !== -1) {
          const from = editor.offsetToPos(idx);
          const to = editor.offsetToPos(idx + this.rawText.length);
          editor.replaceRange(result.polished, from, to);
          new Notice("✅ 润色已完成");
          return;
        }

        // 3️⃣ 真的找不到了 → 把润色结果放剪贴板
        try {
          await navigator.clipboard.writeText(result.polished);
          new Notice("✅ 润色完成（已复制到剪贴板）");
        } catch {
          new Notice("✅ 润色完成（原文已保留，润色结果如下）\n" + result.polished.slice(0, 100));
        }
        return;
      }

      // 笔记模式或其他情况→放剪贴板
      try {
        await navigator.clipboard.writeText(result.polished);
        new Notice("✅ 润色完成（已复制到剪贴板）");
      } catch {
        new Notice("✅ 润色完成");
      }
    } catch (err) {
      // 润色失败：通知用户具体原因，但原文已经插入，不影响使用
      const reason = err instanceof Error ? err.message : String(err);
      console.error("润色失败:", reason);
      new Notice(`ℹ️ 润色未完成: ${reason}`);
    }
  }

  // ── 插入到光标位置 ──────────────────────────

  /**
   * 根据当前模式处理结果：
   * - 插入模式 → 文字插入光标位置
   * - 笔记模式 → 创建新笔记（含润色文字 + 音频文件）
   */
  private async insertToTarget() {
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
  private async insertTextAtCursor(text: string) {
    const target = this.savedTarget;

    if (!target) {
      new Notice("❌ 未检测到光标位置，请先点击要输入文字的地方");
      this.close();
      return;
    }

    // input / textarea
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      const input = target as HTMLInputElement;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value =
        input.value.substring(0, start) + text + input.value.substring(end);
      const newPos = start + text.length;
      input.selectionStart = newPos;
      input.selectionEnd = newPos;
      new Notice("✅ 已插入");
      this.close();
      return;
    }

    // contentEditable（含 CodeMirror）
    if ((target as HTMLElement).isContentEditable) {
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
      new Notice("✅ 已插入");
      this.close();
      return;
    }

    // Obsidian Markdown 编辑器
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      const editor = view.editor;
      // 记下插入前位置
      const cursor = editor.getCursor();
      editor.replaceSelection(text);
      // 记下插入后位置（给后台润色替换用）
      this.insertedStart = { ...cursor };
      this.insertedEnd = { ...editor.getCursor() };
      new Notice("✅ 已插入");
      this.close();
      return;
    }

    new Notice("❌ 找不到可插入的位置，请把光标放在输入框中再试");
    this.close();
  }

  /** 笔记模式：创建新笔记（含润色文字 + 录音音频） */
  private async createNoteWithAudio(text: string) {
    const ts = new Date();
    const y = ts.getFullYear();
    const m = (ts.getMonth() + 1).toString().padStart(2, "0");
    const d = ts.getDate().toString().padStart(2, "0");

    const fileDate = `${y}-${m}-${d}`; // 2026-07-17

    // 从设置读取存放路径
    const rawAudioFolder = this.plugin.settings.audioFolder || ".";
    const rawNoteFolder = this.plugin.settings.noteFolder || ".";
    const noteFolder = rawNoteFolder === "." ? "" : `${rawNoteFolder}/`;
    const audioFolder = rawAudioFolder === "." ? "" : `${rawAudioFolder}/`;

    // 日期子文件夹：{folder}/{date}/{baseName}.ext
    const noteDir = `${noteFolder}${fileDate}`;
    const audioDir = `${audioFolder}${fileDate}`;

    try {
      const allFiles = this.plugin.app.vault.getFiles();
      const pad = (n: number) => n.toString().padStart(2, "0");

      // 1) 扫描今日日期文件夹下的笔记，重编号
      const todayNotes = allFiles
        .filter((f) => f.path.startsWith(noteDir + "/") && f.extension === "md")
        .sort((a, b) => {
          const na = this.extractNum(a.name);
          const nb = this.extractNum(b.name);
          return na - nb;
        });

      for (let i = 0; i < todayNotes.length; i++) {
        const oldNum = this.extractNum(todayNotes[i].name);
        const newNum = i + 1;
        if (oldNum === newNum) continue;

        const newName = `${fileDate}-${pad(newNum)}.md`;
        const newPath = `${noteDir}/${newName}`;
        const existing = this.plugin.app.vault.getAbstractFileByPath(newPath);
        if (existing instanceof TFile && existing.path !== todayNotes[i].path) {
          await this.plugin.app.vault.delete(existing);
        }
        await this.plugin.app.vault.rename(todayNotes[i], newPath);

        // 同步重命名日期文件夹下的音频（支持多种扩展名）
        const audioExts = ["webm", "mp4", "ogg", "wav", "aac", "mp3"];
        for (const ext of audioExts) {
          const oldAudioPath = `${audioDir}/${fileDate}-${pad(oldNum)}.${ext}`;
          const oldAudio = allFiles.find((f) => f.path === oldAudioPath);
          if (oldAudio) {
            const newAudioPath = `${audioDir}/${fileDate}-${pad(newNum)}.${ext}`;
            const existingAudio = this.plugin.app.vault.getAbstractFileByPath(newAudioPath);
            if (existingAudio instanceof TFile && existingAudio.path !== oldAudio.path) {
              await this.plugin.app.vault.delete(existingAudio);
            }
            await this.plugin.app.vault.rename(oldAudio, newAudioPath);
            break; // 找到对应扩展名后停止
          }
        }
      }

      const nextNum = pad(todayNotes.length + 1);
      const baseName = `${fileDate}-${nextNum}`;

      // 2) 保存音频到 {audioDir}/
      if (this.lastAudioBlob) {
        // 从 MIME 类型推断正确扩展名，保证播放器能识别
        const ext = this.getAudioExtension(this.lastAudioBlob.type);
        const audioPath = `${audioDir}/${baseName}.${ext}`;
        // 确保日期文件夹存在
        const audioDirObj = this.plugin.app.vault.getAbstractFileByPath(audioDir);
        if (!audioDirObj) {
          await this.plugin.app.vault.createFolder(audioDir);
        }
        // 删旧文件避免冲突
        const existingAudio = this.plugin.app.vault.getAbstractFileByPath(audioPath);
        if (existingAudio instanceof TFile) {
          await this.plugin.app.vault.delete(existingAudio);
        }
        const buffer = await this.lastAudioBlob.arrayBuffer();
        await this.plugin.app.vault.createBinary(audioPath, buffer);

        // 3) 创建笔记到 {noteDir}/
        const notePath = `${noteDir}/${baseName}.md`;
        // 确保笔记日期文件夹存在
        const noteDirObj = this.plugin.app.vault.getAbstractFileByPath(noteDir);
        if (!noteDirObj) {
          await this.plugin.app.vault.createFolder(noteDir);
        }
        // 删旧笔记避免冲突
        const oldNote = this.plugin.app.vault.getAbstractFileByPath(notePath);
        if (oldNote instanceof TFile) {
          await this.plugin.app.vault.delete(oldNote);
        }

        const audioEmbed = `\n![[${audioPath}]]\n`;
        const noteContent = `${baseName}\n\n#voice/${fileDate}\n${audioEmbed}\n\n${text}\n`;
        const noteFile = await this.plugin.app.vault.create(notePath, noteContent);

        // 4) 打开笔记
        const leaf = this.plugin.app.workspace.getLeaf(false);
        await leaf.openFile(noteFile);

        new Notice(`✅ 已创建语音笔记`);
      } else {
        // 没有音频文件（理论上不会发生）
        const notePath = `${noteDir}/${baseName}.md`;
        const noteDirObj = this.plugin.app.vault.getAbstractFileByPath(noteDir);
        if (!noteDirObj) {
          await this.plugin.app.vault.createFolder(noteDir);
        }
        const oldNote = this.plugin.app.vault.getAbstractFileByPath(notePath);
        if (oldNote instanceof TFile) {
          await this.plugin.app.vault.delete(oldNote);
        }
        const noteContent = `${baseName}\n\n#voice/${fileDate}\n\n${text}\n`;
        const noteFile = await this.plugin.app.vault.create(notePath, noteContent);
        const leaf = this.plugin.app.workspace.getLeaf(false);
        await leaf.openFile(noteFile);
        new Notice(`✅ 已创建语音笔记`);
      }
    } catch (err) {
      new Notice(`❌ 创建笔记失败: ${err}`);
    }
    this.close();
  }

  /** 从 MIME 类型推断音频文件扩展名 */
  private getAudioExtension(mimeType: string): string {
    const mime = mimeType.toLowerCase();
    if (mime.includes("mp4") || mime.includes("m4a")) return "mp4";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("wav")) return "wav";
    if (mime.includes("aac")) return "aac";
    if (mime.includes("mp3")) return "mp3";
    return "webm"; // 默认
  }

  /** 从文件名提取序号，如 "2026-07-17-02.md" → 2 */
  private extractNum(fileName: string): number {
    const match = fileName.match(/-(\d+)\.\w+$/);
    return match ? parseInt(match[1], 10) : 9999;
  }

  /** 切换模式 */
  private toggleMode() {
    if (this.mode === "insert") {
      this.mode = "note";
      this.modeBtn.textContent = "🎵";
      this.modeBtn.title = "笔记模式：新建笔记 + 录音音频";
      this.statusEl.textContent = "笔记+音频模式";
    } else {
      this.mode = "insert";
      this.modeBtn.textContent = "📝";
      this.modeBtn.title = "插入模式：文字插入光标位置";
      this.statusEl.textContent = "点击录音";
    }
  }

  // ── 配置检查 ────────────────────────────────

  private checkConfig(): boolean {
    const s = this.plugin.settings;
    if (!s) {
      new Notice("[E091] 插件设置未加载");
      this.close();
      return false;
    }
    if (!isSTTConfigReady(s)) {
      new Notice(getSTTConfigHint(s));
      this.close();
      return false;
    }
    if (!s.deepseekApiKey) {
      new Notice("请先在设置中填写 DeepSeek API Key");
      this.close();
      return false;
    }
    return true;
  }

  // ── 拖动 ────────────────────────────────────

  private clientX(e: MouseEvent | TouchEvent): number {
    return "touches" in e ? e.touches[0].clientX : e.clientX;
  }

  private clientY(e: MouseEvent | TouchEvent): number {
    return "touches" in e ? e.touches[0].clientY : e.clientY;
  }

  private onDragStart(e: MouseEvent | TouchEvent) {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    if ("touches" in e) e.preventDefault();
    this.isDragging = true;
    this.dragStartX = this.clientX(e);
    this.dragStartY = this.clientY(e);
    this.panelStartX = this.panelEl.offsetLeft;
    this.panelStartY = this.panelEl.offsetTop;
    this.panelEl.style.cursor = "grabbing";
    this.panelEl.style.opacity = "0.85";
  }

  private onDragMove(e: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;
    if ("touches" in e) e.preventDefault();
    const dx = this.clientX(e) - this.dragStartX;
    const dy = this.clientY(e) - this.dragStartY;
    this.panelEl.style.left = `${this.panelStartX + dx}px`;
    this.panelEl.style.top = `${this.panelStartY + dy}px`;
    this.panelEl.style.right = "auto";
    this.panelEl.style.bottom = "auto";
  }

  private onDragEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.panelEl.style.cursor = "grab";
    this.panelEl.style.opacity = "1";
    try {
      localStorage.setItem(
        FloatingRecorder.POSITION_KEY,
        JSON.stringify({
          left: this.panelEl.style.left,
          top: this.panelEl.style.top,
        })
      );
    } catch {}
  }

  private restorePosition() {
    try {
      const saved = localStorage.getItem(FloatingRecorder.POSITION_KEY);
      if (saved) {
        const pos = JSON.parse(saved);
        if (pos.left) this.panelEl.style.left = pos.left;
        if (pos.top) this.panelEl.style.top = pos.top;
        this.panelEl.style.right = "auto";
        this.panelEl.style.bottom = "auto";
        return;
      }
    } catch {}

    this.panelEl.style.right = "24px";
    this.panelEl.style.bottom = "80px";
    this.panelEl.style.left = "auto";
    this.panelEl.style.top = "auto";
  }

  // ── 计时器 ─────────────────────────────────

  private startDurationTimer() {
    this.durationTimer = window.setInterval(() => {
      const secs = Math.floor((Date.now() - this.recordStartTime) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      this.durationEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
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
    this.micBtn.textContent = "🎤";
    this.micBtn.style.background = "";
    this.micBtn.removeAttribute("disabled");
    this.durationEl.textContent = "";
    this.cleanupDurationTimer();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);

    // 根据当前模式显示状态
    if (this.mode === "note") {
      this.statusEl.textContent = "笔记+音频模式";
    } else {
      this.statusEl.textContent = "点击录音";
    }
  }
}
