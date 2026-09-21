"use client";
import { useEffect, useState, useRef } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import {
  Play, Download, Zap, CheckCircle2, XCircle, Clock, Loader2,
  RotateCcw, Archive, Share2, ChevronDown, ChevronUp, Eye, Image,
  Mic, Film, Cpu, Upload as UploadIcon,
} from "lucide-react";
import clsx from "clsx";
import type { VideoJob, VideoScript, VideoStatus } from "@/types";
import { STATUS_LABELS, VARIANT_LABELS, VARIANT_COLORS } from "@/types";
import VideoCard from "./VideoCard";
import BufferPanel from "./BufferPanel";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    puter?: any;
  }
}

const QUEUE_CONCURRENCY = 3;

async function generateScript(title: string, variant: string, model: string): Promise<VideoScript> {
  const res = await fetch("/api/mistral", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, variant, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Script generation failed");
  }
  const data = await res.json();
  return data.script as VideoScript;
}

async function generateImageWithPuter(prompt: string, model: string): Promise<string> {
  if (!window.puter?.ai) throw new Error("Puter.js not available");
  const img = await window.puter.ai.txt2img(prompt, { model: model || "flux" });
  // Convert img element src to data URL
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 512;
  canvas.height = img.naturalHeight || 512;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function generateVoiceWithPuter(text: string, lang: string): Promise<string> {
  if (!window.puter?.ai) {
    console.warn("Puter.js not available, skipping TTS");
    return "";
  }
  try {
    // Use language code format for Puter TTS (e.g., "de-DE" for German)
    const langCode = lang.includes("-") ? lang : "de-DE";
    const audio = await window.puter.ai.txt2speech(text, langCode);
    return audio.src || "";
  } catch (err) {
    console.warn("Puter TTS failed, using Web Speech API:", err);
    return "";
  }
}

export default function BatchView() {
  const {
    activeBatchId,
    getBatch,
    settings,
    getActiveBackgroundClips,
    setVideoStatus,
    setVideoScript,
    setVideoBlob,
    setVideoBlobUrl,
    updateBatch,
    envStatus,
  } = useStudioStore();

  const batch = activeBatchId ? getBatch(activeBatchId) : null;
  const [showBuffer, setShowBuffer] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const processingRef = useRef<Set<string>>(new Set());

  // Auto-start generation when batch is created fresh
  useEffect(() => {
    if (batch && batch.status === "pending" && !generatingAll) {
      handleGenerateAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.batchId]);

  const processVideo = async (video: VideoJob) => {
    const { batchId, videoId, title, variant } = video;

    try {
      // Step 1: Generate script
      setVideoStatus(batchId, videoId, "generating_script", 10);
      const script = await generateScript(title, variant, settings.defaultMistralModel);
      setVideoScript(batchId, videoId, script);
      setVideoStatus(batchId, videoId, "generating_images", 25);

      // Step 2: Generate scene images (first 2 scenes for speed)
      const updatedScript = { ...script };
      for (let i = 0; i < Math.min(2, script.scenes.length); i++) {
        try {
          const imageUrl = await generateImageWithPuter(
            script.scenes[i].imagePrompt,
            settings.defaultImageModel
          );
          updatedScript.scenes[i] = { ...updatedScript.scenes[i], imageUrl };
        } catch {
          console.warn("Image generation failed for scene", i);
        }
        setVideoStatus(batchId, videoId, "generating_images", 25 + i * 10);
      }

      // Step 3: Generate voice (optional, Puter TTS)
      setVideoStatus(batchId, videoId, "generating_voice", 50);
      // We do TTS inline during render for speed

      // Step 4: Render video
      setVideoStatus(batchId, videoId, "rendering", 60);

      const bgClips = getActiveBackgroundClips();
      const batchIndex = video.index;
      const bgClip = bgClips.length > 0 ? bgClips[batchIndex % bgClips.length] : null;

      const { renderVideo } = await import("@/lib/videoRenderer");
      const videoBlob = await renderVideo({
        script: updatedScript,
        backgroundVideoUrl: bgClip?.objectUrl,
        backgroundVolume: bgClip?.volume ?? 0.3,
        onProgress: (pct) => setVideoStatus(batchId, videoId, "rendering", 60 + Math.floor(pct * 0.35)),
      });

      const localUrl = URL.createObjectURL(videoBlob);
      setVideoBlob(batchId, videoId, videoBlob, localUrl);
      setVideoStatus(batchId, videoId, "complete", 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setVideoStatus(batchId, videoId, "error", 0, message);
    } finally {
      processingRef.current.delete(videoId);
    }
  };

  const handleGenerateAll = async () => {
    if (!batch || generatingAll) return;
    setGeneratingAll(true);
    updateBatch(batch.batchId, { status: "processing" });

    const videos = batch.videos.filter(
      (v) => v.status === "queued" || v.status === "error"
    );

    // Process with concurrency limit
    const queue = [...videos];
    const running: Promise<void>[] = [];

    const processNext = async () => {
      const video = queue.shift();
      if (!video) return;
      processingRef.current.add(video.videoId);
      await processVideo(video);
      if (queue.length > 0) await processNext();
    };

    for (let i = 0; i < Math.min(QUEUE_CONCURRENCY, queue.length); i++) {
      running.push(processNext());
    }

    await Promise.all(running);

    const currentBatch = getBatch(batch.batchId);
    if (currentBatch) {
      const allDone = currentBatch.videos.every((v) => v.status === "complete" || v.status === "error");
      if (allDone) {
        const anyError = currentBatch.videos.some((v) => v.status === "error");
        updateBatch(batch.batchId, { status: anyError ? "partial" : "complete" });
      }
    }
    setGeneratingAll(false);
  };

  const handleRetry = async (video: VideoJob) => {
    if (!batch) return;
    setVideoStatus(batch.batchId, video.videoId, "queued", 0);
    await processVideo({ ...video, status: "queued" });
  };

  const handleDownloadAll = async () => {
    if (!batch) return;
    const completedVideos = batch.videos.filter((v) => v.status === "complete" && v.videoBlob);
    if (completedVideos.length === 0) return;

    // Load JSZip dynamically
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    for (const video of completedVideos) {
      if (video.videoBlob) {
        const filename = `${String(video.index + 1).padStart(2, "0")}_${video.title
          .slice(0, 40)
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .replace(/\s+/g, "_")}.webm`;
        zip.file(filename, video.videoBlob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const batchName = (batch.name || "ChatStory_Batch")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "_");
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batchName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  if (!batch) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        <div className="text-center">
          <Film size={40} className="mx-auto mb-3 opacity-30" />
          <p>No batch selected</p>
        </div>
      </div>
    );
  }

  const completedCount = batch.videos.filter((v) => v.status === "complete").length;
  const failedCount = batch.videos.filter((v) => v.status === "error").length;
  const totalProgress = batch.videos.reduce((sum, v) => sum + (v.progress || 0), 0) / batch.videos.length;

  return (
    <div className="p-6 space-y-6">
      {/* Batch Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">{batch.name}</h2>
            <span className={clsx(
              "status-badge text-xs",
              batch.status === "complete" ? "bg-green-500/15 text-green-400 border border-green-500/20" :
              batch.status === "processing" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" :
              batch.status === "partial" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
              "bg-gray-500/15 text-gray-400 border border-gray-500/20"
            )}>
              {batch.status === "complete" ? "✓ Complete" :
               batch.status === "processing" ? "⟳ Processing" :
               batch.status === "partial" ? "⚠ Partial" : "◷ Pending"}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {completedCount}/{batch.videos.length} videos complete
            {failedCount > 0 && ` · ${failedCount} failed`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {generatingAll && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
              <Loader2 size={12} className="animate-spin" />
              Processing...
            </div>
          )}
          {!generatingAll && batch.videos.some((v) => v.status === "queued" || v.status === "error") && (
            <button
              onClick={handleGenerateAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all"
            >
              <Zap size={14} />
              Generate All
            </button>
          )}
          {completedCount > 0 && (
            <>
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm transition-all"
              >
                <Archive size={14} />
                Download ZIP
              </button>
              <button
                onClick={() => setShowBuffer(!showBuffer)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  showBuffer
                    ? "bg-purple-600 text-white"
                    : "bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                )}
              >
                <Share2 size={14} />
                Post to Buffer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Overall progress */}
      {generatingAll && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Overall Progress</span>
            <span>{Math.round(totalProgress)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full progress-bar-shimmer rounded-full transition-all duration-300"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Videos Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          Generating 5 Videos
        </h3>
        {batch.videos.map((video) => (
          <VideoCard
            key={video.videoId}
            video={video}
            batchId={batch.batchId}
            onRetry={() => handleRetry(video)}
          />
        ))}
      </div>

      {/* Buffer Panel */}
      {showBuffer && completedCount > 0 && (
        <BufferPanel batch={batch} />
      )}

      {/* Download All Banner */}
      {completedCount > 0 && (
        <div className="glass-card p-5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-lg">
                🎉 {completedCount} Video{completedCount !== 1 ? "s" : ""} Ready
              </h3>
              <p className="text-gray-500 text-sm mt-1">Download individually or as a ZIP archive</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                <Archive size={16} />
                Download All as ZIP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
