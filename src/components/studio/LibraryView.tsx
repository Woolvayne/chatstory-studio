"use client";
import { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import {
  Film, Download, Play, Trash2, Share2, UploadCloud, CheckCircle2,
  Clock, XCircle, Filter, Archive, Eye,
} from "lucide-react";
import clsx from "clsx";
import type { VideoJob } from "@/types";
import { VARIANT_LABELS, VARIANT_COLORS } from "@/types";

type FilterMode = "all" | "complete" | "error" | "uploaded" | "posted";

export default function LibraryView() {
  const { batches, deleteBatch, setActiveBatchId, setActiveView } = useStudioStore();
  const [filter, setFilter] = useState<FilterMode>("all");

  const allVideos: (VideoJob & { batchName: string })[] = batches.flatMap((b) =>
    b.videos.map((v) => ({ ...v, batchName: b.name }))
  );

  const filteredVideos = allVideos.filter((v) => {
    if (filter === "all") return true;
    if (filter === "complete") return v.status === "complete";
    if (filter === "error") return v.status === "error";
    if (filter === "uploaded") return !!v.blobUrl;
    if (filter === "posted") return Object.values(v.bufferStatus || {}).some((s) => s === "posted");
    return true;
  });

  const filters: { id: FilterMode; label: string; count: number }[] = [
    { id: "all", label: "All", count: allVideos.length },
    { id: "complete", label: "Ready", count: allVideos.filter((v) => v.status === "complete").length },
    { id: "error", label: "Failed", count: allVideos.filter((v) => v.status === "error").length },
    { id: "uploaded", label: "Uploaded", count: allVideos.filter((v) => v.blobUrl).length },
    { id: "posted", label: "Posted", count: allVideos.filter((v) => Object.values(v.bufferStatus || {}).some((s) => s === "posted")).length },
  ];

  const handleDownload = (video: VideoJob) => {
    const url = video.localVideoUrl || video.blobUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(video.index + 1).padStart(2, "0")}_${video.title.slice(0, 40).replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_")}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenBatch = (batchId: string) => {
    setActiveBatchId(batchId);
    setActiveView("batch" as Parameters<typeof setActiveView>[0]);
  };

  if (allVideos.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-20 h-20 rounded-2xl bg-white/3 flex items-center justify-center mb-4">
          <Film size={36} className="text-gray-700" />
        </div>
        <h3 className="text-white font-semibold mb-2">No videos yet</h3>
        <p className="text-gray-600 text-sm mb-6">Generate your first batch of viral short-form videos</p>
        <button
          onClick={() => setActiveView("dashboard")}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all"
        >
          Create Batch
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Generated Videos</h2>
          <p className="text-gray-500 text-sm mt-1">{allVideos.length} videos across {batches.length} batches</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="text-gray-600 shrink-0" />
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border",
              filter === f.id
                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                : "bg-white/3 text-gray-500 border-white/5 hover:text-white hover:bg-white/8"
            )}
          >
            {f.label}
            {f.count > 0 && (
              <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Batches */}
      {batches.map((batch) => {
        const batchVideos = filteredVideos.filter((v) => v.batchId === batch.batchId);
        if (batchVideos.length === 0) return null;

        return (
          <div key={batch.batchId} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">{batch.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  {new Date(batch.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleOpenBatch(batch.batchId)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  Open <Eye size={10} />
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              {batchVideos.map((video) => {
                const variantColor = VARIANT_COLORS[video.variant] || "#3B82F6";
                const hasVideo = video.status === "complete" && (video.localVideoUrl || video.blobUrl);

                return (
                  <div key={video.videoId} className="glass-card p-4 flex items-center gap-4">
                    {/* Thumbnail */}
                    <div
                      className="w-16 h-24 rounded-xl shrink-0 flex items-center justify-center border overflow-hidden"
                      style={{ borderColor: `${variantColor}30`, backgroundColor: `${variantColor}10` }}
                    >
                      {video.localVideoUrl ? (
                        <video
                          src={video.localVideoUrl}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <span className="text-2xl">{["❤️", "🎭", "🔮", "🌀", "⚡"][video.index % 5]}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{video.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full border"
                          style={{ color: variantColor, borderColor: `${variantColor}40`, backgroundColor: `${variantColor}15` }}>
                          {VARIANT_LABELS[video.variant]}
                        </span>
                        <span className={clsx(
                          "text-[10px] flex items-center gap-1",
                          video.status === "complete" ? "text-green-400" :
                          video.status === "error" ? "text-red-400" :
                          "text-gray-500"
                        )}>
                          {video.status === "complete" ? <CheckCircle2 size={9} /> :
                           video.status === "error" ? <XCircle size={9} /> :
                           <Clock size={9} />}
                          {video.status === "complete" ? "Ready" : video.status === "error" ? "Failed" : "Processing"}
                        </span>
                        {video.blobUrl && (
                          <span className="text-[10px] text-purple-400 flex items-center gap-1">
                            <UploadCloud size={9} /> Uploaded
                          </span>
                        )}
                        {Object.values(video.bufferStatus || {}).some((s) => s === "posted") && (
                          <span className="text-[10px] text-blue-400 flex items-center gap-1">
                            <Share2 size={9} /> Posted
                          </span>
                        )}
                      </div>
                      {video.script && (
                        <p className="text-xs text-gray-600 mt-1 truncate">{video.script.caption}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasVideo && (
                        <button
                          onClick={() => handleDownload(video)}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                      )}
                      {video.blobUrl && (
                        <a
                          href={video.blobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                          title="Open Blob URL"
                        >
                          <UploadCloud size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filteredVideos.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          <p>No videos match this filter</p>
        </div>
      )}
    </div>
  );
}
