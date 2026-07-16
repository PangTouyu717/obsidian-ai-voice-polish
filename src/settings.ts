import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import AiVoicePolishPlugin from "./main";
import { STTProviderType, STT_PROVIDER_LABELS } from "./services/stt-provider";
import { testDeepSeekConnection } from "./services/ai-service";
import { testVolcengineConnection } from "./services/volcengine-stt";
import { testQwenConnection } from "./services/qwen-stt";

/**
 * 插件设置项
 */
export interface AiVoicePolishSettings {
  // ── STT 服务商 ──
  /** STT 服务商类型 */
  sttProvider: STTProviderType;
  /** 火山引擎 Access Key */
  volcAccessKey: string;
  /** 火山引擎 Secret Key */
  volcSecretKey: string;
  /** 火山引擎 App ID */
  volcAppId: string;
  /** 千问 API Key */
  qwenApiKey: string;
  /** OpenAI API Key */
  openaiApiKey: string;

  // ── 文件存放路径 ──
  /** 音频文件存放文件夹（相对于 vault 根目录） */
  audioFolder: string;
  /** 笔记文件存放文件夹（相对于 vault 根目录） */
  noteFolder: string;

  // ── 文本润色 ──
  /** DeepSeek API Key */
  deepseekApiKey: string;
  /** 润色风格 */
  polishStyle: "formal" | "concise" | "casual" | "raw";
  /** 自定义润色指令（追加到系统 prompt 末尾） */
  customPrompt: string;
  /** 是否自动插入（跳过预览） */
  autoInsert: boolean;
}

export const DEFAULT_SETTINGS: AiVoicePolishSettings = {
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
  autoInsert: true,
};

export class AiVoicePolishSettingTab extends PluginSettingTab {
  plugin: AiVoicePolishPlugin;

  constructor(app: App, plugin: AiVoicePolishPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "AI Voice Polish 设置" });

    // ════════════════════════════════════════════
    //  语音转文字（STT）
    // ════════════════════════════════════════════

    containerEl.createEl("h3", { text: "🎤 语音转文字（STT）" });

    // STT 服务商选择
    new Setting(containerEl)
      .setName("STT 服务商")
      .setDesc("选择语音转文字的服务提供商")
      .addDropdown((dropdown) => {
        const providers: STTProviderType[] = [
          "volcengine",
          "qwen",
          "openai-whisper",
        ];
        for (const p of providers) {
          const label =
            p === "openai-whisper"
              ? `${STT_PROVIDER_LABELS[p]} (即将支持)`
              : STT_PROVIDER_LABELS[p];
          dropdown.addOption(p, label);
        }
        dropdown
          .setValue(this.plugin.settings.sttProvider)
          .onChange(async (value) => {
            this.plugin.settings.sttProvider = value as STTProviderType;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // ── 条件：火山引擎配置 ──
    if (this.plugin.settings.sttProvider === "volcengine") {
      containerEl.createEl("p", {
        text: "在火山引擎控制台创建语音识别应用获取凭证。",
        cls: "setting-item-description",
      });

      new Setting(containerEl)
        .setName("Access Key")
        .setDesc("火山引擎的 Access Key")
        .addText((text) =>
          text
            .setPlaceholder("AK...")
            .setValue(this.plugin.settings.volcAccessKey)
            .onChange(async (value) => {
              this.plugin.settings.volcAccessKey = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Secret Key")
        .setDesc("火山引擎的 Secret Key")
        .addText((text) => {
          text
            .setPlaceholder("SK...")
            .setValue(this.plugin.settings.volcSecretKey)
            .onChange(async (value) => {
              this.plugin.settings.volcSecretKey = value;
              await this.plugin.saveSettings();
            });
          text.inputEl.type = "password";
        });

      new Setting(containerEl)
        .setName("App ID")
        .setDesc("火山引擎语音识别应用的 App ID")
        .addText((text) =>
          text
            .setPlaceholder("4xxxxxxxxxx")
            .setValue(this.plugin.settings.volcAppId)
            .onChange(async (value) => {
              this.plugin.settings.volcAppId = value;
              await this.plugin.saveSettings();
            })
        );

      // 火山引擎测试连接按钮
      this.addTestButton("测试火山引擎连接", async () => {
        const s = this.plugin.settings;
        return testVolcengineConnection(s.volcAccessKey, s.volcSecretKey, s.volcAppId);
      });
    }

    // ── 条件：千问配置 ──
    if (this.plugin.settings.sttProvider === "qwen") {
      containerEl.createEl("p", {
        text: "在阿里云模型服务灵积（DashScope）创建 API Key。",
        cls: "setting-item-description",
      });

      new Setting(containerEl)
        .setName("API Key")
        .setDesc("千问（DashScope）的 API Key，以 sk- 开头")
        .addText((text) => {
          text
            .setPlaceholder("sk-...")
            .setValue(this.plugin.settings.qwenApiKey)
            .onChange(async (value) => {
              this.plugin.settings.qwenApiKey = value;
              await this.plugin.saveSettings();
            });
          text.inputEl.type = "password";
        });

      // 千问测试连接按钮
      this.addTestButton("测试千问连接", async () => {
        return testQwenConnection(this.plugin.settings.qwenApiKey);
      });
    }

    // ── 条件：OpenAI Whisper ──
    if (this.plugin.settings.sttProvider === "openai-whisper") {
      containerEl.createEl("p", {
        text: "OpenAI Whisper 支持尚未完成，敬请期待。",
        cls: "setting-item-description",
      });

      new Setting(containerEl)
        .setName("API Key")
        .setDesc("OpenAI API Key（预留字段）")
        .addText((text) => {
          text
            .setPlaceholder("sk-...")
            .setValue(this.plugin.settings.openaiApiKey)
            .onChange(async (value) => {
              this.plugin.settings.openaiApiKey = value;
              await this.plugin.saveSettings();
            });
          text.inputEl.type = "password";
        });
    }

    // ════════════════════════════════════════════
    //  文件存放路径
    // ════════════════════════════════════════════

    containerEl.createEl("h3", { text: "📂 文件存放路径" });

    containerEl.createEl("p", {
      text: "笔记模式和音频文件的存放位置，相对于 vault 根目录。留空表示 vault 根目录。",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("笔记存放文件夹")
      .setDesc("语音笔记 .md 文件的存放路径")
      .addText((text) =>
        text
          .setPlaceholder("留空 = vault 根目录")
          .setValue(this.plugin.settings.noteFolder)
          .onChange(async (value) => {
            this.plugin.settings.noteFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("音频存放文件夹")
      .setDesc("录音音频 .webm 文件的存放路径")
      .addText((text) =>
        text
          .setPlaceholder('默认 "voice"')
          .setValue(this.plugin.settings.audioFolder)
          .onChange(async (value) => {
            this.plugin.settings.audioFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // ════════════════════════════════════════════
    //  文本润色
    // ════════════════════════════════════════════

    containerEl.createEl("h3", { text: "✍️ 文本润色（DeepSeek）" });

    containerEl.createEl("p", {
      text: "使用 DeepSeek Chat API 对语音转文字结果进行润色。",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("DeepSeek 的 API Key")
      .addText((text) => {
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.deepseekApiKey)
          .onChange(async (value) => {
            this.plugin.settings.deepseekApiKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    // DeepSeek 测试连接按钮
    this.addTestButton("测试 DeepSeek 连接", async () => {
      return testDeepSeekConnection(this.plugin.settings.deepseekApiKey);
    });

    new Setting(containerEl)
      .setName("润色风格")
      .setDesc("选择 AI 润色的默认风格")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("formal", "正式")
          .addOption("concise", "简洁")
          .addOption("casual", "口语化")
          .addOption("raw", "仅修正错误")
          .setValue(this.plugin.settings.polishStyle)
          .onChange(async (value) => {
            this.plugin.settings.polishStyle = value as any;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("自定义润色指令")
      .setDesc(
        "额外的润色要求，会追加到系统 prompt 末尾。例如：请使用 Markdown 格式输出"
      )
      .addTextArea((text) =>
        text
          .setPlaceholder("例如：使用列表形式输出要点...")
          .setValue(this.plugin.settings.customPrompt)
          .onChange(async (value) => {
            this.plugin.settings.customPrompt = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("自动插入")
      .setDesc(
        "开启后，润色完成直接插入笔记，跳过预览确认。关闭则会显示润色结果让你确认。"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoInsert)
          .onChange(async (value) => {
            this.plugin.settings.autoInsert = value;
            await this.plugin.saveSettings();
          })
      );
  }

  /**
   * 添加一个"测试连接"按钮，点击后执行测试并显示结果
   */
  private addTestButton(
    label: string,
    testFn: () => Promise<{ ok: boolean; message: string }>
  ): void {
    const setting = new Setting(this.containerEl)
      .setDesc("")
      .addButton((btn) => {
        btn.setButtonText("测试连接");
        btn.onClick(async () => {
          btn.setButtonText("⏳ 测试中...");
          btn.setDisabled(true);

          try {
            const result = await testFn();
            btn.setButtonText("测试连接");
            btn.setDisabled(false);

            if (result.ok) {
              new Notice(result.message, 3000);
              setting.setDesc(`✅ ${result.message}`);
            } else {
              new Notice(`❌ ${result.message}`, 5000);
              setting.setDesc(`❌ ${result.message}`);
            }
          } catch (err) {
            btn.setButtonText("测试连接");
            btn.setDisabled(false);
            setting.setDesc(`❌ 测试异常: ${err}`);
          }
        });
      });
  }
}
