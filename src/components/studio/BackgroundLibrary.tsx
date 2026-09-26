"use client";
import { useRef, useCallback, useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Upload, Trash2, Eye, EyeOff, Film, Volume2 } from "lucide-react";
import clsx from "clsx";

export default function BackgroundLibrary() {
  const { backgroundClips, addBackgroundClip, removeBackgroundClip, toggleBackgroundClip, updateBackgroundClip } =
    useStudioStore();

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) return;
      const objectUrl = URL.createObjectURL(file);

      // Get video duration
      const vid = document.createElement("video");
      vid.src = objectUrl;
      vid.onloadedmetadata = () => {
        const clip = {
          id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          file,
          objectUrl,
          duration: vid.duration,
          active: true,
          volume: 0.3,
        };
        addBackgroundClip(clip);
      };
      vid.onerror = () => {
        const clip = {
          id: `clip_${Date.now()}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          file,
          objectUrl,
          active: true,
          volume: 0.3,
        };
        addBackgroundClip(clip);
      };
    },
    [addBackgroundClip]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      Array.from(e.dataTransfer.files).forEach(processFile);
    },
    [processFile]
  );

  const formatDuration = (s?: number) => {
    if (!s) return "??:??";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
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
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          <Upload size={28} className="text-gray-400" />
        </div>
        <h3 className="text-white font-medium mb-1">Drop video files here</h3>
        <p className="text-gray-500 text-sm mb-4">MP4, WebM, MOV supported</p>
        <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-all">
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => {
            Array.from(e.target.files || []).forEach(processFile);
            e.target.value = "";
          }}
        />
      </div>

      {/* Clips Grid */}
      {backgroundClips.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">
              {backgroundClips.length} clip{backgroundClips.length !== 1 ? "s" : ""}
              {" · "}
              <span className="text-green-400">{backgroundClips.filter((c) => c.active).length} active</span>
            </h3>
            <button
              onClick={() => backgroundClips.forEach((c) => !c.active && toggleBackgroundClip(c.id))}
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
                  />
                ) : (
                  <Film size={20} className="text-gray-600" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{clip.name}</p>
                <p className="text-xs text-gray-600 mt-0.5">{formatDuration(clip.duration)}</p>

                {/* Volume */}
                <div className="flex items-center gap-2 mt-2">
                  <Volume2 size={12} className="text-gray-600 shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={clip.volume}
                    onChange={(e) => updateBackgroundClip(clip.id, { volume: parseFloat(e.target.value) })}
                    className="w-24 h-1 accent-blue-500"
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
                  onClick={() => {
                    if (clip.objectUrl) URL.revokeObjectURL(clip.objectUrl);
                    removeBackgroundClip(clip.id);
                  }}
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
          <Fill size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No background clips yet</p>
          <p className="text-xs mt-1">Upload Minecraft, Subway Surfers, GTA or any gameplay video</p>
        </div>
      )}
    </div>
  );
}
