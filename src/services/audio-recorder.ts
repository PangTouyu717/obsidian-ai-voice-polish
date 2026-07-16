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

  /** 当前录制状态 */
  get state(): RecordingState {
    return this.mediaRecorder?.state ?? "inactive";
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

    // 使用 ideal 而非精确值，避免因设备不支持特定采样率而报错
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: { ideal: 16000 },
      },
    });

    this.stream = stream;
    this.chunks = [];

    // 不同平台优先的音频格式：
    // - 桌面端（Electron）：webm/opus → Electron 原生支持
    // - 安卓端：mp4 → 兼容性最好
    // - iOS 端：mp4 → iOS 不支持 webm
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const priority = isAndroid
      ? ["audio/mp4", "audio/webm;codec=opus", "audio/ogg;codec=opus"]
      : isIOS
        ? ["audio/mp4", "audio/webm;codec=opus", "audio/ogg;codec=opus"]
        : ["audio/webm;codec=opus", "audio/webm", "audio/ogg;codec=opus", "audio/mp4"];

    const mimeType = priority.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    this.startTime = Date.now();
  }

  /**
   * 停止录制并返回音频数据
   * @returns 录制完成的音频数据
   */
  stop(): Promise<AudioData> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        reject(new Error("没有正在进行的录制"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const durationSeconds = (Date.now() - this.startTime) / 1000;
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType ?? "audio/webm",
        });

        // 释放麦克风
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.mediaRecorder = null;

        resolve({
          blob,
          durationSeconds: Math.round(durationSeconds * 10) / 10,
          mimeType: blob.type,
        });
      };

      this.mediaRecorder.onerror = () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        reject(new Error("录制过程中发生错误"));
      };

      this.mediaRecorder.stop();
    });
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
  }
}
