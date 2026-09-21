"use client";
import { useState, useEffect } from "react";
import type { Batch, BufferChannel } from "@/types";
import { useStudioStore } from "@/store/useStudioStore";
import {
  Share2, Loader2, CheckCircle2, XCircle, RotateCcw, Send,
  Calendar, Clock, ExternalLink,
} from "lucide-react";
import clsx from "clsx";

interface Props {
  batch: Batch;
}

type PostMode = "now" | "schedule" | "queue";

const SERVICE_ICONS: Record<string, string> = {
  tiktok: "🎵",
  instagram: "📸",
  youtube: "▶️",
  facebook: "👍",
  twitter: "🐦",
  linkedin: "💼",
  pinterest: "📌",
};

export default function BufferPanel({ batch }: Props) {
  const {
    bufferChannels,
    bufferConnected,
    setBufferChannels,
    toggleBufferChannel,
    setBufferConnected,
    setVideoBufferStatus,
    envStatus,
  } = useStudioStore();

  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelError, setChannelError] = useState("");
  const [postMode, setPostMode] = useState<PostMode>("queue");
  const [scheduledAt, setScheduledAt] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResults, setPostResults] = useState<Record<string, string>>({});
  const [customCaptions, setCustomCaptions] = useState<Record<string, string>>({});

  const selectedChannels = bufferChannels.filter((c) => c.selected);
  const completedVideos = batch.videos.filter(
    (v) => v.status === "complete" && (v.blobUrl || v.localVideoUrl)
  );

  const loadChannels = async () => {
    if (!envStatus.buffer) {
      setChannelError("BUFFER_API_KEY not configured in environment variables.");
      return;
    }
    setLoadingChannels(true);
    setChannelError("");
    try {
      const res = await fetch("/api/buffer/channels");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load channels");
      }
      const data = await res.json();
      const channels: BufferChannel[] = (data.channels || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        service: p.service as string,
        service_username: p.service_username as string,
        service_type: p.service_type as string | undefined,
        avatar_https: p.avatar_https as string | undefined,
        formatted_username: `@${p.service_username as string}`,
        selected: false,
      }));
      setBufferChannels(channels);
      setBufferConnected(true);
    } catch (err) {
      setChannelError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoadingChannels(false);
    }
  };

  const handlePost = async () => {
    if (selectedChannels.length === 0 || completedVideos.length === 0) return;
    setPosting(true);

    for (const video of completedVideos) {
      const videoUrl = video.blobUrl || "";
      if (!videoUrl) {
        // Need blob URL for Buffer
        setPostResults((prev) => ({
          ...prev,
          [video.videoId]: "error:Need to upload to Blob first",
        }));
        continue;
      }

      for (const channel of selectedChannels) {
        const key = `${video.videoId}_${channel.id}`;
        setVideoBufferStatus(batch.batchId, video.videoId, channel.id, "posting");

        const caption =
          customCaptions[video.videoId] ||
          `${video.script?.caption || video.title}\n\n${video.script?.hashtags?.join(" ") || ""}`;

        try {
          const res = await fetch("/api/buffer/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileId: channel.id,
              videoUrl,
              text: caption,
              now: postMode === "now",
              scheduledAt: postMode === "schedule" ? scheduledAt : undefined,
            }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Post failed");
          }

          const data = await res.json();
          setVideoBufferStatus(batch.batchId, video.videoId, channel.id, "posted", data.postId);
          setPostResults((prev) => ({ ...prev, [key]: "success" }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          setVideoBufferStatus(batch.batchId, video.videoId, channel.id, "failed");
          setPostResults((prev) => ({ ...prev, [key]: `error:${msg}` }));
        }
      }
    }

    setPosting(false);
  };

  const totalPosts = completedVideos.length * selectedChannels.length;
  const needsBlobUpload = completedVideos.some((v) => !v.blobUrl);

  return (
    <div className="glass-card p-6 space-y-6 border-purple-500/20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Share2 size={18} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-white font-bold">Publish to Buffer</h3>
          <p className="text-gray-500 text-xs">Post your videos to social media channels</p>
        </div>
      </div>

      {/* Connect Buffer */}
      {!bufferConnected ? (
        <div className="text-center py-6">
          {!envStatus.buffer && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              ⚠️ BUFFER_API_KEY not configured in environment variables
            </div>
          )}
          <button
            onClick={loadChannels}
            disabled={loadingChannels}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all mx-auto"
          >
            {loadingChannels ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            Connect Buffer & Load Channels
          </button>
          {channelError && (
            <p className="mt-3 text-red-400 text-xs">{channelError}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Channel selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-300">Select Channels</h4>
              <button
                onClick={loadChannels}
                className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <RotateCcw size={10} />
                Refresh
              </button>
            </div>
            {bufferChannels.length === 0 ? (
              <p className="text-gray-600 text-sm">No channels found. Check your Buffer API key.</p>
            ) : (
              <div className="space-y-2">
                {bufferChannels.map((channel) => (
                  <label
                    key={channel.id}
                    className={clsx(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all",
                      channel.selected
                        ? "border-purple-500/40 bg-purple-500/10"
                        : "border-white/5 bg-white/2 hover:bg-white/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={channel.selected}
                      onChange={() => toggleBufferChannel(channel.id)}
                      className="accent-purple-500"
                    />
                    <span className="text-xl">{SERVICE_ICONS[channel.service] || "📱"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white capitalize">{channel.service}</p>
                      <p className="text-xs text-gray-500">{channel.formatted_username}</p>
                    </div>
                    {channel.selected && (
                      <CheckCircle2 size={14} className="text-purple-400 shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Captions per video */}
          {completedVideos.length > 0 && selectedChannels.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">Captions</h4>
              <div className="space-y-3">
                {completedVideos.map((video) => (
                  <div key={video.videoId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Video {video.index + 1}: {video.title.slice(0, 35)}...
                      </p>
                      {!video.blobUrl && (
                        <span className="text-[10px] text-amber-400">⚠ Upload to Blob first</span>
                      )}
                      {video.blobUrl && (
                        <span className="text-[10px] text-green-400">✓ Ready</span>
                      )}
                    </div>
                    <textarea
                      value={
                        customCaptions[video.videoId] !== undefined
                          ? customCaptions[video.videoId]
                          : `${video.script?.caption || video.title}\n\n${video.script?.hashtags?.join(" ") || ""}`
                      }
                      onChange={(e) =>
                        setCustomCaptions((prev) => ({
                          ...prev,
                          [video.videoId]: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post mode */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Post Timing</h4>
            <div className="flex gap-2">
              {(["now", "queue", "schedule"] as PostMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPostMode(mode)}
                  className={clsx(
                    "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                    postMode === mode
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                  )}
                >
                  {mode === "now" ? "🔴 Post Now" : mode === "queue" ? "📋 Add to Queue" : "📅 Schedule"}
                </button>
              ))}
            </div>
            {postMode === "schedule" && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              />
            )}
          </div>

          {/* Blob warning */}
          {needsBlobUpload && (
            <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              ⚠️ Some videos need to be uploaded to Vercel Blob before posting. Click the upload button (↑) on each video card.
            </div>
          )}

          {/* Preview & Post */}
          {selectedChannels.length > 0 && completedVideos.length > 0 && (
            <div className="border-t border-white/5 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-400">
                  Publishing <strong className="text-white">{totalPosts}</strong> posts
                  ({completedVideos.length} videos × {selectedChannels.length} channels)
                </p>
              </div>

              {/* Status grid */}
              {Object.keys(postResults).length > 0 && (
                <div className="mb-4 space-y-2">
                  {completedVideos.map((video) =>
                    selectedChannels.map((channel) => {
                      const key = `${video.videoId}_${channel.id}`;
                      const result = postResults[key];
                      const bufStatus = video.bufferStatus?.[channel.id];
                      return (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            {SERVICE_ICONS[channel.service]} {channel.formatted_username} ← Video {video.index + 1}
                          </span>
                          <span className={clsx(
                            "flex items-center gap-1",
                            result?.startsWith("error") ? "text-red-400" :
                            result === "success" ? "text-green-400" :
                            "text-gray-500"
                          )}>
                            {result?.startsWith("error") ? (
                              <><XCircle size={10} /> Failed</>
                            ) : result === "success" ? (
                              <><CheckCircle2 size={10} /> Posted</>
                            ) : bufStatus === "posting" ? (
                              <><Loader2 size={10} className="animate-spin" /> Posting...</>
                            ) : null}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              <button
                onClick={handlePost}
                disabled={posting || needsBlobUpload}
                className={clsx(
                  "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                  posting || needsBlobUpload
                    ? "bg-white/5 text-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg"
                )}
              >
                {posting ? (
                  <><Loader2 size={16} className="animate-spin" /> Posting...</>
                ) : (
                  <><Send size={16} /> Publish {totalPosts} Post{totalPosts !== 1 ? "s" : ""}</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
