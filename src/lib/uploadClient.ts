/**
 * Browser helper: sends a rendered video to our upload API route, which
 * forwards it to the configured public host (Catbox by default) and returns
 * the public URL Buffer can download the video from.
 */

export interface PublicUploadResult {
  url: string;
  provider: string;
  expiresAt?: string;
}

export function getVideoExtension(videoBlob: Blob): "mp4" | "webm" {
  return videoBlob.type.includes("mp4") ? "mp4" : "webm";
}

export async function uploadVideoToPublicHost(videoBlob: Blob, videoId: string): Promise<PublicUploadResult> {
  const safeName = `${videoId.replace(/[^a-zA-Z0-9._-]/g, "_")}.${getVideoExtension(videoBlob)}`;

  const formData = new FormData();
  formData.append("file", videoBlob, safeName);
  formData.append("filename", safeName);

  const res = await fetch("/api/blob/upload", { method: "POST", body: formData });

  let data: { url?: string; provider?: string; expiresAt?: string; error?: string } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Upload failed (HTTP ${res.status})`);
  }
  if (!data?.url) {
    throw new Error("The upload did not return a public URL");
  }

  return { url: data.url, provider: data.provider || "unknown", expiresAt: data.expiresAt };
}
