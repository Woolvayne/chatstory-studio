export type VideoVariant = "emotional" | "dramatic" | "mysterious" | "twist" | "escalation";

export type VideoStatus =
  | "queued"
  | "generating_script"
  | "generating_images"
  | "generating_voice"
  | "rendering"
  | "complete"
  | "error";

export type BufferChannelStatus = "pending" | "uploading" | "uploaded" | "posting" | "posted" | "failed";

export interface Character {
  name: string;
  role: string;
  voice: string;
  color: string;
  avatar: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  delay: number;
  duration: number;
  audioBlob?: string; // base64
}

export interface Scene {
  id: string;
  description: string;
  imagePrompt: string;
  startTime: number;
  endTime: number;
  imageUrl?: string;
}

export interface VideoScript {
  title: string;
  hook: string;
  variant: string;
  characters: Character[];
  messages: ChatMessage[];
  scenes: Scene[];
  ending: string;
  voice_style: string;
  estimated_duration: number;
  caption: string;
  hashtags: string[];
}

export interface VideoJob {
  videoId: string;
  batchId: string;
  index: number;
  title: string;
  variant: VideoVariant;
  script?: VideoScript;
  status: VideoStatus;
  progress: number;
  blobUrl?: string;
  localVideoUrl?: string; // object URL for local preview
  videoBlob?: Blob;
  bufferStatus: Record<string, BufferChannelStatus>;
  bufferPostIds: Record<string, string>;
  error?: string;
  createdAt: Date;
}

export interface Batch {
  batchId: string;
  name: string;
  titles: string[];
  videos: VideoJob[];
  status: "pending" | "processing" | "complete" | "partial";
  createdAt: Date;
}

export interface BackgroundClip {
  id: string;
  name: string;
  file?: File;
  objectUrl?: string;
  duration?: number;
  active: boolean;
  volume: number;
}

export interface BufferChannel {
  id: string;
  service: string;
  service_username: string;
  service_type?: string;
  avatar_https?: string;
  formatted_username: string;
  selected: boolean;
}

export interface AppSettings {
  defaultMistralModel: string;
  defaultImageModel: string;
  defaultVoice: string;
  defaultDuration: number;
  defaultHashtags: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultMistralModel: "mistral-large-latest",
  defaultImageModel: "flux",
  defaultVoice: "german_female",
  defaultDuration: 55,
  defaultHashtags: "#chatstory #viral #shorts #story #tiktok",
};

export const VARIANT_LABELS: Record<VideoVariant, string> = {
  emotional: "Emotional",
  dramatic: "Dramatisch",
  mysterious: "Mysteriös",
  twist: "Unerwarteter Twist",
  escalation: "Schnelle Eskalation",
};

export const VARIANT_COLORS: Record<VideoVariant, string> = {
  emotional: "#EC4899",
  dramatic: "#EF4444",
  mysterious: "#8B5CF6",
  twist: "#F59E0B",
  escalation: "#10B981",
};

export const STATUS_LABELS: Record<VideoStatus, string> = {
  queued: "Queued",
  generating_script: "Generating Script",
  generating_images: "Generating Images",
  generating_voice: "Generating Voice",
  rendering: "Rendering",
  complete: "Complete",
  error: "Error",
};

export const MISTRAL_MODELS = [
  { value: "mistral-large-latest", label: "Mistral Large (Latest)" },
  { value: "mistral-small-latest", label: "Mistral Small (Latest)" },
  { value: "open-mistral-7b", label: "Open Mistral 7B" },
  { value: "open-mixtral-8x7b", label: "Open Mixtral 8x7B" },
  { value: "open-mixtral-8x22b", label: "Open Mixtral 8x22B" },
];

export const IMAGE_MODELS = [
  { value: "flux", label: "FLUX" },
  { value: "dall-e-3", label: "DALL·E 3 (GPT Image)" },
  { value: "stable-diffusion", label: "Stable Diffusion" },
];

export const VOICE_OPTIONS = [
  { value: "de-DE-Standard-A", label: "German Female (Standard)" },
  { value: "de-DE-Standard-B", label: "German Male (Standard)" },
  { value: "de-DE-Standard-C", label: "German Female (Alt)" },
  { value: "de-DE-Standard-D", label: "German Male (Alt)" },
  { value: "en-US-Standard-A", label: "English Female" },
  { value: "en-US-Standard-B", label: "English Male" },
];
