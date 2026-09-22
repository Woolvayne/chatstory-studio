/**
 * Server-side upload providers for rendered videos.
 *
 * Buffer cannot receive file uploads – it needs a public, stable URL from
 * which it downloads the video *at publish time* (which may be hours or days
 * after the post was queued). This module turns a rendered video into such a
 * URL.
 *
 * Providers:
 *  - "catbox"      (default) – catbox.moe, free, anonymous, no account or token.
 *                   Direct links, up to 200 MB per file, files stay online until
 *                   they had no access for 2 years. Anonymous uploads cannot be
 *                   deleted afterwards.
 *  - "litterbox"   – litterbox.catbox.moe, same API but temporary (1h–72h),
 *                   up to 1 GB. Only useful when posting immediately, because
 *                   Buffer fetches the file when the post goes out.
 *  - "vercel-blob" – Vercel Blob, requires BLOB_READ_WRITE_TOKEN.
 *
 * Selection: UPLOAD_PROVIDER env var wins. Without it, Vercel Blob is used only
 * when a token is configured – otherwise Catbox, which needs no configuration.
 *
 * This module must only be imported from server code (API routes).
 */

export type UploadProviderId = "catbox" | "litterbox" | "vercel-blob";

export interface UploadProviderInfo {
  id: UploadProviderId;
  label: string;
  /** Maximum file size accepted by the provider in bytes. */
  maxBytes: number;
  /** Whether uploads can be performed with the current environment. */
  ready: boolean;
  /** Human readable reason when `ready` is false. */
  missingConfig?: string;
  /** Short description of how long files remain available. */
  retention: string;
  /** True when no account/token is needed. */
  anonymous: boolean;
}

export interface UploadResult {
  url: string;
  pathname: string;
  provider: UploadProviderId;
  /** ISO timestamp when the file expires (temporary providers only). */
  expiresAt?: string;
}

const MB = 1024 * 1024;

const CATBOX_API_URL = "https://catbox.moe/user/api.php";
const CATBOX_FILE_HOST = "https://files.catbox.moe/";
const CATBOX_MAX_BYTES = 200 * MB;

const LITTERBOX_API_URL = "https://litterbox.catbox.moe/resources/internals/api.php";
const LITTERBOX_FILE_HOST = "https://litter.catbox.moe/";
const LITTERBOX_MAX_BYTES = 1024 * MB;
const LITTERBOX_TIMES = ["1h", "12h", "24h", "72h"] as const;
type LitterboxTime = (typeof LITTERBOX_TIMES)[number];

/** Vercel Blob accepts far larger files; this is only a sanity limit for this app. */
const VERCEL_BLOB_MAX_BYTES = 500 * MB;

/** Give slow connections enough time to push a ~200 MB video. */
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

/** Identify ourselves honestly towards the free hosts (they ask for a non-browser UA). */
const USER_AGENT = "chatstory-studio/1.0 (+https://github.com/Woolvayne/chatstory-studio)";

export function resolveUploadProvider(): UploadProviderId {
  const configured = (process.env.UPLOAD_PROVIDER || "").trim().toLowerCase();
  if (configured === "catbox" || configured === "litterbox" || configured === "vercel-blob") {
    return configured;
  }
  if (configured) {
    console.warn(`Unknown UPLOAD_PROVIDER "${configured}" – falling back to automatic selection.`);
  }
  return process.env.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : "catbox";
}

function resolveLitterboxTime(): LitterboxTime {
  const configured = (process.env.LITTERBOX_EXPIRY || "").trim().toLowerCase();
  return (LITTERBOX_TIMES as readonly string[]).includes(configured)
    ? (configured as LitterboxTime)
    : "72h";
}

export function getUploadProviderInfo(id: UploadProviderId = resolveUploadProvider()): UploadProviderInfo {
  switch (id) {
    case "catbox":
      return {
        id,
        label: "Catbox.moe",
        maxBytes: CATBOX_MAX_BYTES,
        ready: true,
        retention: "kept until 2 years without access",
        anonymous: true,
      };
    case "litterbox": {
      const time = resolveLitterboxTime();
      return {
        id,
        label: `Litterbox (${time})`,
        maxBytes: LITTERBOX_MAX_BYTES,
        ready: true,
        retention: `deleted after ${time}`,
        anonymous: true,
      };
    }
    case "vercel-blob": {
      const ready = !!process.env.BLOB_READ_WRITE_TOKEN;
      return {
        id,
        label: "Vercel Blob",
        maxBytes: VERCEL_BLOB_MAX_BYTES,
        ready,
        missingConfig: ready ? undefined : "BLOB_READ_WRITE_TOKEN is not configured",
        retention: "permanent",
        anonymous: false,
      };
    }
  }
}

/** Keep only harmless characters and make sure the file keeps a video extension. */
export function sanitizeFilename(filename: string | null | undefined, fallbackType?: string): string {
  const cleaned = (filename || "")
    .trim()
    .replace(/[/\\]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);

  if (cleaned && /\.[a-zA-Z0-9]{2,5}$/.test(cleaned)) return cleaned;

  const extension = fallbackType?.includes("mp4") ? "mp4" : "webm";
  return `${cleaned || `video-${Date.now()}`}.${extension}`;
}

function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`;
}

async function uploadToCatboxFamily(
  file: Blob,
  filename: string,
  options: { apiUrl: string; fileHost: string; label: string; time?: LitterboxTime }
): Promise<string> {
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  if (options.time) formData.append("time", options.time);
  // No "userhash" → anonymous upload, no account required.
  formData.append("fileToUpload", file, filename);

  let response: Response;
  try {
    response = await fetch(options.apiUrl, {
      method: "POST",
      body: formData,
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach ${options.label}: ${reason}`);
  }

  const text = (await response.text()).trim();

  if (!response.ok) {
    throw new Error(`${options.label} rejected the upload (HTTP ${response.status}): ${text || "no details"}`);
  }
  // The API answers with the plain file URL on success and a plain error message otherwise.
  if (!text.startsWith(options.fileHost)) {
    throw new Error(`${options.label} returned an unexpected response: ${text.slice(0, 200) || "empty response"}`);
  }
  return text;
}

async function uploadToVercelBlob(file: Blob, filename: string): Promise<UploadResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");

  const { put } = await import("@vercel/blob");
  const blob = await put(filename, file, { access: "public", token });
  return { url: blob.url, pathname: blob.pathname, provider: "vercel-blob" };
}

/**
 * Uploads a file and returns its public URL.
 * Throws with a human readable message when the provider refuses the file.
 */
export async function uploadPublicFile(
  file: Blob,
  requestedFilename: string | null | undefined,
  providerId: UploadProviderId = resolveUploadProvider()
): Promise<UploadResult> {
  const provider = getUploadProviderInfo(providerId);
  if (!provider.ready) {
    throw new Error(`${provider.label} is not available: ${provider.missingConfig}`);
  }
  if (file.size === 0) {
    throw new Error("The video file is empty");
  }
  if (file.size > provider.maxBytes) {
    throw new Error(
      `The video is ${formatMb(file.size)} but ${provider.label} allows at most ${formatMb(provider.maxBytes)}`
    );
  }

  const filename = sanitizeFilename(requestedFilename, file.type);

  switch (provider.id) {
    case "catbox": {
      const url = await uploadToCatboxFamily(file, filename, {
        apiUrl: CATBOX_API_URL,
        fileHost: CATBOX_FILE_HOST,
        label: "Catbox",
      });
      return { url, pathname: url.slice(CATBOX_FILE_HOST.length), provider: "catbox" };
    }
    case "litterbox": {
      const time = resolveLitterboxTime();
      const url = await uploadToCatboxFamily(file, filename, {
        apiUrl: LITTERBOX_API_URL,
        fileHost: LITTERBOX_FILE_HOST,
        label: "Litterbox",
        time,
      });
      const hours = Number.parseInt(time, 10);
      return {
        url,
        pathname: url.slice(LITTERBOX_FILE_HOST.length),
        provider: "litterbox",
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
      };
    }
    case "vercel-blob":
      return uploadToVercelBlob(file, filename);
  }
}
