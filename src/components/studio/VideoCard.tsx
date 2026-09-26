"use client";
import { useRef, useState } from "react";
import type { VideoJob } from "@/types";
import { STATUS_LABELS, VARIANT_LABELS, VARIANT_COLORS } from "@/types";
import {
  Play, Pause, Download, RotateCcw, CheckCircle2, XCircle, Clock,
  Loader2, Mic, Image, Film, Cpu, Upload as UploadIcon, ChevronDown, ChevronUp,
} from "lucide-react";
import clsx from "clsx";
import { useStudioStore } from "@/store/useStudioStore";

interface Props {
  video: VideoJob;
  batchId: string;
  onRetry: () => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  queued: <Clock size={14} />,
  generating_script: <Cpu size={14} className="animate-pulse" />,
  generating_images: <Image size={14} className="animate-pulse" />,
  generating_voice: <Mic size={14} className="animate-pulse" />,
  rendering: <Film size={14} className="animate-pulse" />,
  complete: <CheckCircle2 size={14} />,
  error: <XCircle size={14} />,
};

const STATUS_COLORS: Record<string, string> = {
  queued: "text-gray-400 bg-gray-500/10 border-gray-500/20",
  generating_script: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  generating_images: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  generating_voice: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  rendering: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  complete: "text-green-400 bg-green-500/10 border-green-500/20",
  error: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function VideoCard({ video, batchId, onRetry }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [uploadingBlob, setUploadingBlob] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { setVideoBlobUrl, envStatus } = useStudioStore();

  const variantColor = VARIANT_COLORS[video.variant] || "#3B82F6";

  const handlePlayPause = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleDownload = () => {
    const url = video.localVideoUrl || video.blobUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    const safeName = `${String(video.index + 1).padStart(2, "0")}_${video.title
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "_")}.webm`;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleUploadToBlob = async () => {
    if (!video.videoBlob || uploadingBlob) return;
    if (!envStatus.blob) {
      alert("BLOB_READ_WRITE_TOKEN not configured. Add it in Vercel environment variables.");
      return;
    }

    setUploadingBlob(true);
    try {
      const formData = new FormData();
      const safeName = `${video.videoId}.webm`;
      formData.append("file", video.videoBlob, safeName);
      formData.append("filename", safeName);

      const res = await fetch("/api/blob/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setVideoBlobUrl(batchId, video.videoId, data.url);
    } catch (err) {
      console.error("Blob upload failed:", err);
      alert("Blob upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setUploadingBlob(false);
    }
  };

  const isActive = ["generating_script", "generating_images", "generating_voice", "rendering"].includes(video.status);

  return (
    <div className={clsx(
      "glass-card overflow-hidden transition-all",
      isActive && "border-blue-500/30 shadow-blue-500/5 shadow-lg"
    )}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Video number + variant */}
          <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border"
            style={{
              backgroundColor: `${variantColor}18`,
              borderColor: `${variantColor}30`,
              color: variantColor,
            }}>
            {video.index + 1}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-white truncate">{video.title}</h3>
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border"
                style={{ color: variantColor, borderColor: `${variantColor}40`, backgroundColor: `${variantColor}15` }}>
                {VARIANT_LABELS[video.variant]}
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <span className={clsx("status-badge border text-xs", STATUS_COLORS[video.status])}>
                {STATUS_ICONS[video.status]}
                {STATUS_LABELS[video.status]}
              </span>
              {video.script && (
                <span className="text-[10px] text-gray-600">{video.script.estimated_duration}s</span>
              )}
            </div>

            {/* Progress bar */}
            {isActive && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1">
                  <span>{STATUS_LABELS[video.status]}</span>
                  <span>{video.progress}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full progress-bar-shimmer rounded-full transition-all duration-500"
                    style={{ width: `${video.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Blob URL status */}
            {video.blobUrl && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-green-400">
                <UploadIcon size={10} />
                Uploaded to Blob
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {video.status === "complete" && (
              <>
                {video.localVideoUrl && (
                  <button
                    onClick={handlePlayPause}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-all"
                    title="Preview"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                )}
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-all"
                  title="Download"
                >
                  <Download size={16} />
                </button>
                {!video.blobUrl && (
                  <button
                    onClick={handleUploadToBlob}
                    disabled={uploadingBlob}
                    className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-400 transition-all"
                    title="Upload to Vercel Blob"
                  >
                    {uploadingBlob ? <Loader2 size={16} className="animate-spin" /> : <UploadIcon size={16} />}
                  </button>
                )}
              </>
            )}
            {video.status === "error" && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/20 transition-all"
              >
                <RotateCcw size={12} />
                Retry
              </button>
            )}
            {video.script && (
              <button
                onClick={() => setShowScript(!showScript)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-500 transition-all"
                title="View script"
              >
                {showScript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {video.status === "error" && video.error && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {video.error}
          </div>
        )}

        {/* Video preview */}
        {video.localVideoUrl && (
          <div className="mt-4">
            <video
              ref={videoRef}
              src={video.localVideoUrl}
              className="w-full max-h-48 rounded-xl bg-black/50 object-contain"
              onEnded={() => setIsPlaying(false)}
              controls={false}
              playsInline
            />
          </div>
        )}

        {/* Script expand */}
        {showScript && video.script && (
          <div className="mt-4 border-t border-white/5 pt-4 space-y-3 animate-fade-in">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Hook</p>
              <p className="text-sm text-white">{video.script.hook}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Characters</p>
              <div className="flex flex-wrap gap-2">
                {video.script.characters.map((c, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white/5 text-gray-300">
                    {c.avatar} {c.name} — {c.voice}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Caption</p>
              <p className="text-sm text-gray-300">{video.script.caption}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Hashtags</p>
              <p className="text-xs text-blue-400">{video.script.hashtags?.join(" ")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">Chat Messages ({video.script.messages.length})</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {video.script.messages.map((msg) => {
                  const char = video.script!.characters.find((c) => c.name === msg.sender);
                  const isRight = char?.role !== "protagonist";
                  return (
                    <div key={msg.id} className={clsx("flex gap-2", isRight && "flex-row-reverse")}>
                      <span className="text-base">{char?.avatar || "👤"}</span>
                      <div className={clsx(
                        "px-2.5 py-1.5 rounded-xl text-xs max-w-[70%]",
                        isRight ? "bg-blue-500/20 text-blue-100" : "bg-white/10 text-gray-200"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
