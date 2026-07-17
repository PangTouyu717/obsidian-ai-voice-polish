import {
  Plugin,
  Notice,
  addIcon,
} from "obsidian";
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
  /** 状态栏文本元素 */
  statusBarItem: HTMLElement;

  async onload() {
    await this.loadSettings();

    // 状态栏指示器
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass("avp-status-bar-idle");
    this.statusBarItem.textContent = "🎙 待命";

    // 注册自定义麦克风图标
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

    // 功能区图标（左侧 Ribbon）
    const ribbonIcon = this.addRibbonIcon("message-square", "AI Voice Polish", () => {
      this.openRecorder();
    });
    ribbonIcon.setAttribute("data-avp-ribbon", "true");

    // 设置面板
    this.addSettingTab(new AiVoicePolishSettingTab(this.app, this));
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

  /** 更新状态栏文本 */
  setStatusBar(text: string, isRecording: boolean) {
    if (!this.statusBarItem) return;
    this.statusBarItem.textContent = text;
    this.statusBarItem.removeClass("avp-status-bar-idle", "avp-status-bar-recording");
    this.statusBarItem.addClass(isRecording ? "avp-status-bar-recording" : "avp-status-bar-idle");
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
