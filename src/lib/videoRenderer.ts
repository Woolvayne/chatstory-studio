"use client";

import type { VideoScript } from "@/types";

export interface RenderOptions {
  script: VideoScript;
  backgroundVideoUrl?: string;
  backgroundVolume?: number;
  onProgress?: (pct: number) => void;
}

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

interface FrameState {
  visibleMessages: number;
  typingChar: string | null;
}

function getFrameState(script: VideoScript, timeSeconds: number): FrameState {
  const messages = script.messages;
  let visibleMessages = 0;
  let typingChar: string | null = null;

  let elapsed = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgDelay = Math.max(0.5, msg.delay || 1.5);
    const msgDuration = Math.max(1.5, msg.duration || 2.5);

    if (timeSeconds < elapsed + msgDelay) {
      if (i < messages.length && timeSeconds > elapsed + 0.2) {
        typingChar = messages[i].sender;
      }
      break;
    }
    elapsed += msgDelay;

    if (timeSeconds >= elapsed) {
      visibleMessages = i + 1;
    }
    elapsed += msgDuration;
  }

  return { visibleMessages, typingChar };
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  bgVideo: HTMLVideoElement | null,
  timeSeconds: number
) {
  // Base dark background
  ctx.fillStyle = "#0A0A0F";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (bgVideo && bgVideo.readyState >= 2) {
    const vw = bgVideo.videoWidth || 1;
    const vh = bgVideo.videoHeight || 1;
    const scale = Math.max(CANVAS_WIDTH / vw, CANVAS_HEIGHT / vh);
    const sw = vw * scale;
    const sh = vh * scale;
    const sx = (CANVAS_WIDTH - sw) / 2;
    const sy = (CANVAS_HEIGHT - sh) / 2;

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.drawImage(bgVideo, sx, sy, sw, sh);
    ctx.restore();
  } else {
    // Animated gradient background
    const t = timeSeconds * 0.3;
    const grad = ctx.createRadialGradient(
      CANVAS_WIDTH / 2 + Math.sin(t) * 200,
      CANVAS_HEIGHT * 0.4 + Math.cos(t * 0.7) * 100,
      0,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_HEIGHT * 0.8
    );
    grad.addColorStop(0, "rgba(30, 10, 60, 0.8)");
    grad.addColorStop(0.5, "rgba(10, 5, 30, 0.9)");
    grad.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Dark overlay for readability
  const overlay = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  overlay.addColorStop(0, "rgba(0,0,0,0.75)");
  overlay.addColorStop(0.12, "rgba(0,0,0,0.45)");
  overlay.addColorStop(0.88, "rgba(0,0,0,0.45)");
  overlay.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawHeader(ctx: CanvasRenderingContext2D, script: VideoScript) {
  const headerH = 155;

  // Header background
  ctx.fillStyle = "rgba(10, 10, 18, 0.92)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, headerH);

  // Bottom border glow
  const borderGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
  borderGrad.addColorStop(0, "rgba(59, 130, 246, 0)");
  borderGrad.addColorStop(0.5, "rgba(59, 130, 246, 0.6)");
  borderGrad.addColorStop(1, "rgba(168, 85, 247, 0)");
  ctx.fillStyle = borderGrad;
  ctx.fillRect(0, headerH - 2, CANVAS_WIDTH, 2);

  // App icon circle
  const iconX = 60;
  const iconY = headerH / 2;
  ctx.beginPath();
  ctx.arc(iconX, iconY, 32, 0, Math.PI * 2);
  const iconGrad = ctx.createRadialGradient(iconX - 8, iconY - 8, 0, iconX, iconY, 32);
  iconGrad.addColorStop(0, "#60A5FA");
  iconGrad.addColorStop(1, "#7C3AED");
  ctx.fillStyle = iconGrad;
  ctx.fill();

  ctx.font = "bold 28px serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("💬", iconX, iconY + 10);

  // Title
  const maxTitleWidth = CANVAS_WIDTH - 200;
  ctx.font = "bold 46px -apple-system, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  const title = script.title || "ChatStory";
  const titleShort = title.length > 32 ? title.slice(0, 32) + "…" : title;
  ctx.fillText(titleShort, 110, 75);

  // Online indicator
  ctx.beginPath();
  ctx.arc(115, 105, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#22C55E";
  ctx.fill();

  ctx.font = "28px -apple-system, Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("online", 132, 113);
}

function drawHookScreen(ctx: CanvasRenderingContext2D, script: VideoScript, timeSeconds: number) {
  const alpha = timeSeconds < 1.5 ? timeSeconds / 1.5 : timeSeconds < 2.5 ? 1 : Math.max(0, 1 - (timeSeconds - 2.5) / 0.5);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Hook backdrop
  const hookGrad = ctx.createLinearGradient(0, CANVAS_HEIGHT * 0.3, 0, CANVAS_HEIGHT * 0.75);
  hookGrad.addColorStop(0, "rgba(0,0,0,0)");
  hookGrad.addColorStop(0.2, "rgba(0,0,0,0.6)");
  hookGrad.addColorStop(0.8, "rgba(0,0,0,0.6)");
  hookGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hookGrad;
  ctx.fillRect(0, CANVAS_HEIGHT * 0.3, CANVAS_WIDTH, CANVAS_HEIGHT * 0.45);

  // Scale effect
  const scale = 0.9 + alpha * 0.1;
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.scale(scale, scale);
  ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);

  ctx.font = "bold 76px -apple-system, Arial, sans-serif";
  ctx.textAlign = "center";
  const hookText = script.hook || "Was passiert hier?";
  const lines = wrapText(ctx, hookText, CANVAS_WIDTH - 120);
  const startY = CANVAS_HEIGHT / 2 - (lines.length * 88) / 2 + 20;

  lines.forEach((line, i) => {
    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(line, CANVAS_WIDTH / 2, startY + i * 90);
    ctx.shadowBlur = 0;
  });

  // Emoji indicator below hook
  ctx.font = "56px serif";
  ctx.fillText("👀", CANVAS_WIDTH / 2, startY + lines.length * 90 + 60);

  ctx.restore();
}

function drawChatMessages(
  ctx: CanvasRenderingContext2D,
  script: VideoScript,
  timeSeconds: number,
  frameTime: number
) {
  const { visibleMessages, typingChar } = getFrameState(script, timeSeconds);

  const chatTop = 170;
  const chatBottom = CANVAS_HEIGHT - 200;
  const chatHeight = chatBottom - chatTop;
  const msgMaxWidth = CANVAS_WIDTH - 120;
  const avatarSize = 72;
  const msgPadding = 32;
  const lineH = 46;

  ctx.font = "42px -apple-system, Arial, sans-serif";

  // Build layouts
  type MsgLayout = {
    msg: typeof script.messages[0];
    lines: string[];
    char: typeof script.characters[0] | undefined;
    isRight: boolean;
    bubbleH: number;
    totalH: number;
  };

  const maxToShow = Math.min(visibleMessages, script.messages.length);
  const allLayouts: MsgLayout[] = [];

  for (let i = 0; i < maxToShow; i++) {
    const msg = script.messages[i];
    const char = script.characters.find((c) => c.name === msg.sender);
    const isRight = char?.role !== "protagonist";
    ctx.font = "42px -apple-system, Arial, sans-serif";
    const bubbleMaxW = msgMaxWidth - avatarSize - 32;
    const lines = wrapText(ctx, msg.text, bubbleMaxW - 60);
    const bubbleH = Math.max(avatarSize + 8, lines.length * lineH + 52);
    allLayouts.push({ msg, lines, char, isRight, bubbleH, totalH: bubbleH + 18 });
  }

  const totalH = allLayouts.reduce((s, l) => s + l.totalH, 0);
  let yStart = chatTop + Math.max(20, chatHeight - totalH - 20);
  // Show last messages if overflow
  if (yStart < chatTop) yStart = chatTop;

  // Calculate visible slice
  let cumH = 0;
  let startIdx = 0;
  for (let i = 0; i < allLayouts.length; i++) {
    cumH += allLayouts[i].totalH;
    if (cumH > chatHeight + 20) {
      startIdx = i - 5;
      if (startIdx < 0) startIdx = 0;
      break;
    }
  }

  const visLayouts = allLayouts.slice(startIdx);
  const visTotalH = visLayouts.reduce((s, l) => s + l.totalH, 0);
  let yPos = Math.max(chatTop + 20, chatBottom - visTotalH - 20);

  for (const { msg, lines, char, isRight, bubbleH } of visLayouts) {
    const color = char?.color || "#3B82F6";
    const bubbleMaxW = msgMaxWidth - avatarSize - 32;

    const avatarX = isRight ? CANVAS_WIDTH - msgPadding - avatarSize : msgPadding;
    const bubbleX = isRight ? CANVAS_WIDTH - msgPadding - avatarSize - 24 - bubbleMaxW : msgPadding + avatarSize + 24;

    // Avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, yPos + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, 0.2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexToRgba(color, 0.6);
    ctx.stroke();
    ctx.restore();

    // Avatar emoji
    ctx.font = "38px serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(char?.avatar || "👤", avatarX + avatarSize / 2, yPos + avatarSize / 2 + 13);

    // Name tag
    ctx.font = "bold 28px -apple-system, Arial, sans-serif";
    ctx.fillStyle = hexToRgba(color, 0.8);
    ctx.textAlign = isRight ? "right" : "left";
    const nameX = isRight ? bubbleX + bubbleMaxW : bubbleX;
    ctx.fillText(msg.sender, nameX, yPos - 6);

    // Message bubble
    ctx.save();
    ctx.fillStyle = isRight ? hexToRgba(color, 0.18) : "rgba(255,255,255,0.08)";
    drawRoundedRect(ctx, bubbleX, yPos, bubbleMaxW, bubbleH, 26);
    ctx.fill();

    // Bubble border
    ctx.strokeStyle = hexToRgba(color, 0.35);
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, bubbleX, yPos, bubbleMaxW, bubbleH, 26);
    ctx.stroke();
    ctx.restore();

    // Message text
    ctx.font = "42px -apple-system, Arial, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = isRight ? "right" : "left";
    const textX = isRight ? bubbleX + bubbleMaxW - 26 : bubbleX + 26;

    lines.forEach((line, li) => {
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 4;
      ctx.fillText(line, textX, yPos + 40 + li * lineH);
      ctx.shadowBlur = 0;
    });

    // Timestamp
    ctx.font = "24px -apple-system, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(msg.timestamp, textX, yPos + bubbleH - 14);

    // Read receipt for right-side messages
    if (isRight) {
      ctx.font = "22px serif";
      ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
      ctx.fillText("✓✓", textX - 60, yPos + bubbleH - 14);
    }

    yPos += bubbleH + 18;
  }

  // Typing indicator
  if (typingChar) {
    const typChar = script.characters.find((c) => c.name === typingChar);
    const isRight = typChar?.role !== "protagonist";
    const color = typChar?.color || "#3B82F6";
    const bx = isRight ? CANVAS_WIDTH / 2 + 50 : msgPadding + avatarSize + 24;
    const by = yPos + 10;

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    drawRoundedRect(ctx, bx, by, 110, 52, 26);
    ctx.fill();

    ctx.strokeStyle = hexToRgba(color, 0.3);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, bx, by, 110, 52, 26);
    ctx.stroke();

    for (let d = 0; d < 3; d++) {
      const pulse = Math.sin(frameTime / 350 + d * 1.2) * 0.35 + 0.65;
      ctx.beginPath();
      ctx.arc(bx + 22 + d * 33, by + 26, 9, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, pulse);
      ctx.fill();
    }
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, script: VideoScript, timeSeconds: number) {
  const footerY = CANVAS_HEIGHT - 195;
  const footerH = 195;

  // Footer background
  ctx.fillStyle = "rgba(8, 8, 16, 0.9)";
  ctx.fillRect(0, footerY, CANVAS_WIDTH, footerH);

  // Top glow border
  const topGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
  topGrad.addColorStop(0, "rgba(168, 85, 247, 0)");
  topGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.4)");
  topGrad.addColorStop(1, "rgba(59, 130, 246, 0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, footerY, CANVAS_WIDTH, 2);

  // Hashtags
  const tags = (script.hashtags || []).slice(0, 5).join("  ");
  ctx.font = "30px -apple-system, Arial, sans-serif";
  ctx.fillStyle = "rgba(147, 197, 253, 0.6)";
  ctx.textAlign = "center";
  ctx.fillText(tags, CANVAS_WIDTH / 2, footerY + 52);

  // Brand
  ctx.font = "bold 28px -apple-system, Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText("ChatStory Studio", CANVAS_WIDTH / 2, footerY + 90);

  // Progress bar track
  const barX = 60;
  const barY = footerY + 122;
  const barW = CANVAS_WIDTH - 120;
  const barH = 8;

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  drawRoundedRect(ctx, barX, barY, barW, barH, 4);
  ctx.fill();

  const totalDur = Math.max(1, script.estimated_duration || 55);
  const progress = Math.min(1, timeSeconds / totalDur);

  const progressGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  progressGrad.addColorStop(0, "#3B82F6");
  progressGrad.addColorStop(1, "#7C3AED");
  ctx.fillStyle = progressGrad;
  drawRoundedRect(ctx, barX, barY, barW * progress, barH, 4);
  ctx.fill();

  // Time display
  ctx.font = "22px -apple-system, Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "right";
  ctx.fillText(
    `${Math.floor(timeSeconds)}s / ${Math.floor(totalDur)}s`,
    CANVAS_WIDTH - 60,
    barY + barH + 22
  );
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  script: VideoScript,
  timeSeconds: number,
  frameTime: number,
  bgVideo: HTMLVideoElement | null
) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawBackground(ctx, bgVideo, timeSeconds);

  if (timeSeconds <= 3) {
    drawHookScreen(ctx, script, timeSeconds);
    drawHeader(ctx, script);
    drawFooter(ctx, script, timeSeconds);
    return;
  }

  drawHeader(ctx, script);
  drawChatMessages(ctx, script, timeSeconds, frameTime);
  drawFooter(ctx, script, timeSeconds);
}

export async function renderVideo(options: RenderOptions): Promise<Blob> {
  const { script, backgroundVideoUrl, backgroundVolume = 0.3, onProgress } = options;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const duration = Math.max(30, script.estimated_duration || 55);
  const fps = 24;
  const totalFrames = Math.ceil(duration * fps);

  // Load background video
  let bgVideo: HTMLVideoElement | null = null;
  if (backgroundVideoUrl) {
    bgVideo = document.createElement("video");
    bgVideo.src = backgroundVideoUrl;
    bgVideo.muted = true;
    bgVideo.loop = true;
    bgVideo.playbackRate = 1.0;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 5000);
      bgVideo!.oncanplay = () => { clearTimeout(timeout); resolve(); };
      bgVideo!.onerror = () => { clearTimeout(timeout); resolve(); };
      bgVideo!.load();
    });

    try { await bgVideo.play(); } catch { /* ignore */ }
  }

  // Determine best supported format
  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

  const stream = canvas.captureStream(fps);
  const chunks: BlobPart[] = [];

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_500_000,
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      if (bgVideo) {
        bgVideo.pause();
        bgVideo.src = "";
      }
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };

    recorder.onerror = (e) => {
      reject(new Error(`MediaRecorder error: ${String(e)}`));
    };

    recorder.start(200);

    let frame = 0;
    const startTs = performance.now();

    const renderLoop = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }

      const targetTime = (frame / fps) * 1000;
      const elapsed = performance.now() - startTs;

      if (elapsed < targetTime - 5) {
        // Ahead of schedule, wait
        requestAnimationFrame(renderLoop);
        return;
      }

      const timeSeconds = frame / fps;
      const frameTime = performance.now();

      // Sync background video time
      if (bgVideo && bgVideo.duration > 0 && isFinite(bgVideo.duration)) {
        const targetVideoTime = timeSeconds % bgVideo.duration;
        if (Math.abs(bgVideo.currentTime - targetVideoTime) > 0.2) {
          bgVideo.currentTime = targetVideoTime;
        }
      }

      drawFrame(ctx, script, timeSeconds, frameTime, bgVideo);

      frame++;
      onProgress?.(Math.round((frame / totalFrames) * 100));
      requestAnimationFrame(renderLoop);
    };

    requestAnimationFrame(renderLoop);
  });
}
