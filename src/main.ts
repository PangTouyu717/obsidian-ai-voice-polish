import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  MarkdownView,
  addIcon,
} from "obsidian";
import { VoiceRecorderModal } from "./ui/modal";
import { FloatingRecorder } from "./ui/floating-recorder";
import {
  DEFAULT_SETTINGS,
  AiVoicePolishSettings,
  AiVoicePolishSettingTab,
} from "./settings";

// 插件图标（使用 lucide 内置的 microphone 图标）
const MIC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`;

export default class AiVoicePolishPlugin extends Plugin {
  settings: AiVoicePolishSettings;
  private floatingRecorder: FloatingRecorder | null = null;

  async onload() {
    await this.loadSettings();
    console.log("AI Voice Polish: onload started");

    // 注册自定义麦克风图标（用于命令面板等场景）
    addIcon("avp-mic", MIC_ICON);

    // 创建浮动录音条（单例，只创建一次）
    this.floatingRecorder = new FloatingRecorder(this);

    // 核心命令：打开浮动录音条
    this.addCommand({
      id: "open-voice-recorder",
      name: "打开语音录制器",
      icon: "avp-mic",
      callback: () => {
        this.openRecorder();
      },
    });

    // 命令：使用选区文本进行润色
    this.addCommand({
      id: "polish-selected-text",
      name: "润色选中的文本",
      callback: () => {
        this.polishSelectedText();
      },
    });

    // 功能区图标（左侧 Ribbon）
    const ribbonIcon = this.addRibbonIcon("message-square", "AI Voice Polish", () => {
      this.openRecorder();
    });
    ribbonIcon.setAttribute("data-avp-ribbon", "true");
    console.log("AI Voice Polish: ribbon icon added");

    // 设置面板
    this.addSettingTab(new AiVoicePolishSettingTab(this.app, this));
    console.log("AI Voice Polish: onload complete");
  }

  onunload() {
    // 销毁浮动录音条
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
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!view) {
      new Notice("没有打开的编辑器");
      return;
    }

    const editor = view.editor;
    const selectedText = editor.getSelection();
    if (!selectedText) {
      new Notice("请先选中要润色的文本");
      return;
    }

    new Notice("润色功能将在后续版本实现");
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
}
