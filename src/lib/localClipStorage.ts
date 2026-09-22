import type { BackgroundClip } from "@/types";

const DATABASE_NAME = "chatstory-studio-media";
const DATABASE_VERSION = 1;
const CLIP_STORE = "background-clips";

export interface LocalBackgroundClipRecord {
  id: string;
  name: string;
  file: Blob;
  duration?: number;
  targetDuration: number;
  active: boolean;
  volume: number;
  savedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CLIP_STORE)) {
        database.createObjectStore(CLIP_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local media storage"));
  });
}

export async function saveLocalBackgroundClip(clip: BackgroundClip): Promise<void> {
  const file = clip.file;
  if (!file) throw new Error("The background clip has no file data");

  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CLIP_STORE, "readwrite");
    transaction.objectStore(CLIP_STORE).put({
      id: clip.id,
      name: clip.name,
      file,
      duration: clip.duration,
      targetDuration: clip.targetDuration ?? 55,
      active: clip.active,
      volume: clip.volume,
      savedAt: Date.now(),
    } satisfies LocalBackgroundClipRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not save the background clip"));
    transaction.onabort = () => reject(transaction.error || new Error("Could not save the background clip"));
  }).finally(() => database.close());
}

export async function deleteLocalBackgroundClip(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CLIP_STORE, "readwrite");
    transaction.objectStore(CLIP_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not delete the background clip"));
    transaction.onabort = () => reject(transaction.error || new Error("Could not delete the background clip"));
  }).finally(() => database.close());
}

export async function loadLocalBackgroundClips(): Promise<BackgroundClip[]> {
  const database = await openDatabase();
  const records = await new Promise<LocalBackgroundClipRecord[]>((resolve, reject) => {
    const transaction = database.transaction(CLIP_STORE, "readonly");
    const request = transaction.objectStore(CLIP_STORE).getAll();
    request.onsuccess = () => resolve(request.result as LocalBackgroundClipRecord[]);
    request.onerror = () => reject(request.error || new Error("Could not load local background clips"));
  }).finally(() => database.close());

  return records
    .sort((a, b) => a.savedAt - b.savedAt)
    .map((record) => ({
      id: record.id,
      name: record.name,
      file: record.file,
      objectUrl: URL.createObjectURL(record.file),
      duration: record.duration,
      targetDuration: record.targetDuration,
      active: record.active,
      volume: record.volume,
    }));
}
