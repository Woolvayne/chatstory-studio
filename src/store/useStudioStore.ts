"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Batch,
  VideoJob,
  VideoStatus,
  VideoVariant,
  BackgroundClip,
  BufferChannel,
  AppSettings,
  VideoScript,
} from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

export type ActiveView = "dashboard" | "batch" | "library" | "settings";

interface StudioState {
  // Navigation
  activeView: ActiveView;
  activeBatchId: string | null;

  // Settings
  settings: AppSettings;

  // Batches
  batches: Batch[];
  batchCounter: number;

  // Background clips
  backgroundClips: BackgroundClip[];

  // Buffer
  bufferChannels: BufferChannel[];
  bufferConnected: boolean;

  // Env status
  envStatus: { mistral: boolean; buffer: boolean; blob: boolean };

  // Actions
  setActiveView: (view: ActiveView) => void;
  setActiveBatchId: (id: string | null) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;

  createBatch: (name: string, titles: string[]) => string;
  updateBatch: (batchId: string, updates: Partial<Batch>) => void;
  deleteBatch: (batchId: string) => void;
  getBatch: (batchId: string) => Batch | undefined;

  updateVideo: (batchId: string, videoId: string, updates: Partial<VideoJob>) => void;
  setVideoScript: (batchId: string, videoId: string, script: VideoScript) => void;
  setVideoStatus: (batchId: string, videoId: string, status: VideoStatus, progress?: number, error?: string) => void;
  setVideoBlob: (batchId: string, videoId: string, blob: Blob, localUrl: string) => void;
  setVideoBlobUrl: (batchId: string, videoId: string, blobUrl: string) => void;
  setVideoBufferStatus: (batchId: string, videoId: string, channelId: string, status: string, postId?: string) => void;

  addBackgroundClip: (clip: BackgroundClip) => void;
  updateBackgroundClip: (id: string, updates: Partial<BackgroundClip>) => void;
  removeBackgroundClip: (id: string) => void;
  toggleBackgroundClip: (id: string) => void;

  setBufferChannels: (channels: BufferChannel[]) => void;
  toggleBufferChannel: (channelId: string) => void;
  setBufferConnected: (connected: boolean) => void;

  setEnvStatus: (status: { mistral: boolean; buffer: boolean; blob: boolean }) => void;

  getActiveBackgroundClips: () => BackgroundClip[];
  getAllVideos: () => VideoJob[];
}

function generateBatchId(counter: number): string {
  return `batch_${String(counter).padStart(3, "0")}`;
}

function generateVideoId(): string {
  return `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const VARIANTS: VideoVariant[] = ["emotional", "dramatic", "mysterious", "twist", "escalation"];

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      activeView: "dashboard",
      activeBatchId: null,
      settings: DEFAULT_SETTINGS,
      batches: [],
      batchCounter: 0,
      backgroundClips: [],
      bufferChannels: [],
      bufferConnected: false,
      envStatus: { mistral: false, buffer: false, blob: false },

      setActiveView: (view) => set({ activeView: view }),
      setActiveBatchId: (id) => set({ activeBatchId: id }),

      updateSettings: (updates) =>
        set((state) => ({ settings: { ...state.settings, ...updates } })),

      createBatch: (name, titles) => {
        const counter = get().batchCounter + 1;
        const batchId = generateBatchId(counter);
        const selectedTitles = titles.slice(0, 5);

        const videos: VideoJob[] = selectedTitles.map((title, i) => ({
          videoId: generateVideoId(),
          batchId,
          index: i,
          title,
          variant: VARIANTS[i % VARIANTS.length],
          status: "queued",
          progress: 0,
          bufferStatus: {},
          bufferPostIds: {},
          createdAt: new Date(),
        }));

        const batch: Batch = {
          batchId,
          name: name || `Batch #${String(counter).padStart(3, "0")}`,
          titles: selectedTitles,
          videos,
          status: "pending",
          createdAt: new Date(),
        };

        set((state) => ({
          batches: [batch, ...state.batches],
          batchCounter: counter,
        }));

        return batchId;
      },

      updateBatch: (batchId, updates) =>
        set((state) => ({
          batches: state.batches.map((b) =>
            b.batchId === batchId ? { ...b, ...updates } : b
          ),
        })),

      deleteBatch: (batchId) =>
        set((state) => ({
          batches: state.batches.filter((b) => b.batchId !== batchId),
        })),

      getBatch: (batchId) => get().batches.find((b) => b.batchId === batchId),

      updateVideo: (batchId, videoId, updates) =>
        set((state) => ({
          batches: state.batches.map((b) =>
            b.batchId === batchId
              ? {
                  ...b,
                  videos: b.videos.map((v) =>
                    v.videoId === videoId ? { ...v, ...updates } : v
                  ),
                }
              : b
          ),
        })),

      setVideoScript: (batchId, videoId, script) =>
        get().updateVideo(batchId, videoId, { script }),

      setVideoStatus: (batchId, videoId, status, progress, error) =>
        get().updateVideo(batchId, videoId, {
          status,
          progress: progress ?? get().getBatch(batchId)?.videos.find((v) => v.videoId === videoId)?.progress ?? 0,
          ...(error !== undefined ? { error } : {}),
        }),

      setVideoBlob: (batchId, videoId, blob, localUrl) =>
        get().updateVideo(batchId, videoId, { videoBlob: blob, localVideoUrl: localUrl }),

      setVideoBlobUrl: (batchId, videoId, blobUrl) =>
        get().updateVideo(batchId, videoId, { blobUrl }),

      setVideoBufferStatus: (batchId, videoId, channelId, status, postId) =>
        set((state) => ({
          batches: state.batches.map((b) =>
            b.batchId === batchId
              ? {
                  ...b,
                  videos: b.videos.map((v) =>
                    v.videoId === videoId
                      ? {
                          ...v,
                          bufferStatus: { ...v.bufferStatus, [channelId]: status as import("@/types").BufferChannelStatus },
                          bufferPostIds: postId
                            ? { ...v.bufferPostIds, [channelId]: postId }
                            : v.bufferPostIds,
                        }
                      : v
                  ),
                }
              : b
          ),
        })),

      addBackgroundClip: (clip) =>
        set((state) => ({ backgroundClips: [...state.backgroundClips, clip] })),

      updateBackgroundClip: (id, updates) =>
        set((state) => ({
          backgroundClips: state.backgroundClips.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      removeBackgroundClip: (id) =>
        set((state) => ({
          backgroundClips: state.backgroundClips.filter((c) => c.id !== id),
        })),

      toggleBackgroundClip: (id) =>
        set((state) => ({
          backgroundClips: state.backgroundClips.map((c) =>
            c.id === id ? { ...c, active: !c.active } : c
          ),
        })),

      setBufferChannels: (channels) => set({ bufferChannels: channels }),

      toggleBufferChannel: (channelId) =>
        set((state) => ({
          bufferChannels: state.bufferChannels.map((c) =>
            c.id === channelId ? { ...c, selected: !c.selected } : c
          ),
        })),

      setBufferConnected: (connected) => set({ bufferConnected: connected }),

      setEnvStatus: (status) => set({ envStatus: status }),

      getActiveBackgroundClips: () =>
        get().backgroundClips.filter((c) => c.active && c.objectUrl),

      getAllVideos: () => get().batches.flatMap((b) => b.videos),
    }),
    {
      name: "chatstory-studio",
      // Don't persist blobs or files
      partialize: (state) => ({
        settings: state.settings,
        batches: state.batches.map((b) => ({
          ...b,
          videos: b.videos.map((v) => ({
            ...v,
            videoBlob: undefined,
            localVideoUrl: v.blobUrl ? undefined : v.localVideoUrl,
          })),
        })),
        batchCounter: state.batchCounter,
        backgroundClips: state.backgroundClips.map((c) => ({
          ...c,
          file: undefined,
          objectUrl: undefined,
        })),
        bufferChannels: state.bufferChannels,
        bufferConnected: state.bufferConnected,
        envStatus: state.envStatus,
      }),
    }
  )
);
