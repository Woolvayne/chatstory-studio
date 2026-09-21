"use client";
import { useRef, useCallback, useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { deleteLocalBackgroundClip, saveLocalBackgroundClip } from "@/lib/localClipStorage";
import { Upload, Trash2, Eye, EyeOff, Film, Volume2, Loader2, ShieldCheck } from "lucide-react";
import clsx from "clsx";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".ogv", ".avi"];

function isVideoFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return file.type.startsWith("video/") || VIDEO_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function createClipId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `clip_${crypto.randomUUID()}`;
  return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readVideoDuration(file: File): Promise<number | undefined> {
  const metadataUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = metadataUrl;

  try {
    return await new Promise<number | undefined>((resolve) => {
      const timeout = window.setTimeout(() => resolve(undefined), 10000);
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve(Number.isFinite(video.duration) ? video.duration : undefined);
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        resolve(undefined);
      };
      video.load();
    });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(metadataUrl);
  }
}

export default function BackgroundLibrary() {
  const {
    backgroundClips,
    settings,
    addBackgroundClip,
    removeBackgroundClip,
    toggleBackgroundClip,
    updateBackgroundClip,
  } = useStudioStore();

  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!isVideoFile(file)) {
        setUploadError(`${file.name} is not a supported video file.`);
        return;
      }

      setUploadError("");
      setUploadingCount((count) => count + 1);
      const objectUrl = URL.createObjectURL(file);

      try {
        // We keep the original file locally. The renderer automatically uses
        // only the first targetDuration seconds (and loops shorter clips), so
        // no fragile browser-side transcoding is needed for Safari/MOV files.
        const duration = await readVideoDuration(file);
        const targetDuration = Math.max(1, settings.defaultDuration || 55);
        const clip = {
          id: createClipId(),
          name: file.name.replace(/\.[^.]+$/, ""),
          file,
          objectUrl,
          duration,
          targetDuration,
          active: true,
          volume: 0.3,
        };

        // IndexedDB stores the video locally; it is not sent to the server.
        try {
          await saveLocalBackgroundClip(clip);
          addBackgroundClip(clip);
        } catch (error) {
          // Keep the clip usable for this session if a private browsing mode
          // blocks IndexedDB, while clearly explaining that it cannot survive a reload.
          addBackgroundClip(clip);
          setUploadError(
            error instanceof Error
              ? `${file.name}: ${error.message} The clip is available for this session only.`
              : `${file.name}: Could not save locally. The clip is available for this session only.`
          );
        }
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        setUploadError(
          error instanceof Error
            ? `${file.name}: ${error.message}`
            : `${file.name}: Could not read this video.`
        );
      } finally {
        setUploadingCount((count) => Math.max(0, count - 1));
      }
    },
    [addBackgroundClip, settings.defaultDuration]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      Array.from(event.dataTransfer.files).forEach((file) => void processFile(file));
    },
    [processFile]
  );

  const formatDuration = (seconds?: number) => {
    if (!seconds || !Number.isFinite(seconds)) return "unknown";
    const minutes = Math.floor(seconds / 60);
    const secondsPart = Math.floor(seconds % 60);
    return `${minutes}:${String(secondsPart).padStart(2, "0")}`;
  };

  const handleRemove = async (id: string, objectUrl?: string) => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    removeBackgroundClip(id);
    try {
      await deleteLocalBackgroundClip(id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not remove the local video.");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Background Library</h2>
        <p className="text-gray-500 text-sm mt-1">
          Upload gameplay or background videos (Minecraft, Subway Surfers, GTA, etc.)
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={clsx(
          "border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer",
          isDragging ? "border-blue-500/60 bg-blue-500/5" : "border-white/10 hover:border-white/20"
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          {uploadingCount > 0 ? <Loader2 size={28} className="text-blue-400 animate-spin" /> : <Upload size={28} className="text-gray-400" />}
        </div>
        <h3 className="text-white font-medium mb-1">
          {uploadingCount > 0 ? `Saving ${uploadingCount} video${uploadingCount === 1 ? "" : "s"} locally…` : "Drop video files here"}
        </h3>
        <p className="text-gray-500 text-sm mb-4">MP4, WebM, MOV and M4V supported — Safari compatible</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-all"
        >
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mov,.m4v,.mp4,.webm,.ogv"
          multiple
          className="hidden"
          onChange={(event) => {
            Array.from(event.target.files || []).forEach((file) => void processFile(file));
            event.target.value = "";
          }}
        />
      </div>

      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-gray-500">
        <ShieldCheck size={14} className="text-green-400 shrink-0 mt-0.5" />
        <span>
          Videos are saved only in this browser&apos;s IndexedDB. During rendering, clips longer than the selected video duration are automatically cut from the beginning; shorter clips loop seamlessly to fill the video.
        </span>
      </div>

      {uploadError && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {uploadError}
        </div>
      )}

      {/* Clips Grid */}
      {backgroundClips.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">
              {backgroundClips.length} clip{backgroundClips.length !== 1 ? "s" : ""}
              {" · "}
              <span className="text-green-400">{backgroundClips.filter((clip) => clip.active).length} active</span>
            </h3>
            <button
              onClick={() => backgroundClips.forEach((clip) => !clip.active && toggleBackgroundClip(clip.id))}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Enable all
            </button>
          </div>

          {backgroundClips.map((clip) => (
            <div
              key={clip.id}
              className={clsx(
                "glass-card p-4 flex items-center gap-4 transition-all",
                !clip.active && "opacity-50"
              )}
            >
              {/* Thumbnail / Preview */}
              <div className="w-20 h-14 rounded-lg bg-black/40 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
                {clip.objectUrl ? (
                  <video
                    src={clip.objectUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <Film size={20} className="text-gray-600" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{clip.name}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {formatDuration(clip.duration)} original · auto-fit {formatDuration(clip.targetDuration)}
                </p>

                {/* Volume */}
                <div className="flex items-center gap-2 mt-2">
                  <Volume2 size={12} className="text-gray-600 shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={clip.volume}
                    onChange={(event) => updateBackgroundClip(clip.id, { volume: parseFloat(event.target.value) })}
                    className="w-24 h-1 accent-blue-500"
                    aria-label={`Volume for ${clip.name}`}
                  />
                  <span className="text-[10px] text-gray-600">{Math.round(clip.volume * 100)}%</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleBackgroundClip(clip.id)}
                  className={clsx(
                    "p-2 rounded-lg transition-all",
                    clip.active
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-white/5 text-gray-600 border border-white/10"
                  )}
                  title={clip.active ? "Disable" : "Enable"}
                >
                  {clip.active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={() => void handleRemove(clip.id, clip.objectUrl)}
                  className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-700">
          <Film size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No background clips yet</p>
          <p className="text-xs mt-1">Upload Minecraft, Subway Surfers, GTA or any gameplay video</p>
        </div>
      )}
    </div>
  );
}
