/**
 * 音频录制服务
 *
 * 封装浏览器 MediaRecorder API，提供录音和音频数据导出。
 * 手机端（iOS）优先用 mp4，桌面端优先用 webm/opus。
 */

export interface AudioData {
  /** Blob 数据 */
  blob: Blob;
  /** 时长（秒） */
  durationSeconds: number;
  /** MIME 类型 */
  mimeType: string;
}

export type RecordingState = "inactive" | "recording" | "paused";

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private stream: MediaStream | null = null;
  /** 音频管道：将麦克风流接入系统音频输出，阻止 WebView 后台暂停 */
  private audioPipeline: AudioContext | null = null;
  /** 当前录制状态 */
  get state(): RecordingState {
    return this.mediaRecorder?.state ?? "inactive";
  }

  /** 是否有已收集的音频数据（息屏中断后仍有数据） */
  get hasData(): boolean {
    return this.chunks.length > 0;
  }

  /**
   * 将麦克风流接入 AudioContext 并静音输出到扬声器。
   * 系统检测到音频管道活跃 → 后台不暂停 WebView → 录音持续。
   */
  private startAudioPipeline(stream: MediaStream): void {
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      this.audioPipeline = new Ctor();
      const src = this.audioPipeline.createMediaStreamSource(stream);
      const gain = this.audioPipeline.createGain();
      gain.gain.value = 0; // 完全静音
      src.connect(gain);
      gain.connect(this.audioPipeline.destination);
    } catch {}
  }

  /** 关闭音频管道 */
  private stopAudioPipeline(): void {
    if (this.audioPipeline) {
      try { this.audioPipeline.close(); } catch {}
      this.audioPipeline = null;
    }
  }

  /** 当前使用的 MIME 类型（跨 recorder 实例保存） */
  private savedMimeType = "audio/webm";

  /**
   * 静默重启录音：保留已有 chunks，用新 stream 继续录。
   * 用于 App 切回前台时恢复录音。
   */
  async recover(): Promise<void> {
    // 停掉旧的 recorder（触发一次 ondataavailable 收尾）
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }
    // 释放旧 stream
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;

    // 新 stream
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;

    // 新 recorder（沿用之前的 MIME 类型）
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: this.savedMimeType });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.mediaRecorder.start(100);
    this.startAudioPipeline(stream);
  }

  /**
   * 开始录制
   * @throws 如果无法获取麦克风权限
   */
  async start(): Promise<void> {
    // 检查浏览器是否支持麦克风访问
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("当前环境不支持麦克风访问。请使用 Obsidian 桌面版或移动版，并确保已授予麦克风权限。");
    }

    // 不指定音频处理参数——匹配 whisper 插件的设置，
    // 让系统用默认配置处理音频，提高息屏场景的兼容性
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    this.stream = stream;
    this.chunks = [];

    // MIME 类型优先级：mp4 优先，因为它有完整的时长元数据
    // 手机端和桌面端都支持 mp4，且播放器能显示进度条和拖动
    const priority = [
      "audio/mp4",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/aac",
      "audio/wav",
    ];

    const mimeType = priority.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    this.savedMimeType = mimeType;

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    // 麦克风流接入系统音频管道 → 后台不被暂停
    this.startAudioPipeline(stream);

    // 使用 timeslice=100，每 100ms 输出一段数据
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
  stop(): Promise<AudioData> {
    // 先处理"已经没有 recorder 但还有 chunks"的情况
    if (!this.mediaRecorder && this.chunks.length > 0) {
      return this.buildAudioDataFromChunks("已中断");
    }

    if (!this.mediaRecorder) {
      return Promise.reject(new Error("没有录音数据"));
    }

    // —— 正常停止 / 已中断但有数据 ——
    return new Promise((resolve) => {
      if (this.mediaRecorder!.state === "inactive") {
        // 录制已中断（如息屏），取数据后清理资源
        const data = this.buildAudioData("已中断");
        this.cleanup();
        resolve(data);
        return;
      }

      this.mediaRecorder!.onstop = () => {
        const data = this.buildAudioData("正常结束");
        this.cleanup();
        resolve(data);
      };

      this.mediaRecorder!.onerror = () => {
        const data = this.buildAudioData("异常结束");
        this.cleanup();
        resolve(data);
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * 用当前 chunks 拼装 AudioData
   */
  private buildAudioData(_reason: string): AudioData {
    const durationSeconds = (Date.now() - this.startTime) / 1000;
    const blob = new Blob(this.chunks, {
      type: this.mediaRecorder?.mimeType ?? "audio/webm",
    });
    return {
      blob,
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      mimeType: blob.type,
    };
  }

  /**
   * 从已有 chunks 构建 AudioData，不依赖 MediaRecorder 实例
   */
  private buildAudioDataFromChunks(reason: string): Promise<AudioData> {
    this.cleanup();
    const durationSeconds = (Date.now() - this.startTime) / 1000;
    const blob = new Blob(this.chunks, {
      type: "audio/webm",
    });
    return Promise.resolve({
      blob,
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      mimeType: blob.type,
    });
  }

  /**
   * 释放麦克风和音频管道
   */
  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.stopAudioPipeline();
  }

  /** 取消录制（丢弃数据） */
  cancel(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.stopAudioPipeline();
  }
}
