import { NextRequest, NextResponse } from "next/server";
import { getUploadProviderInfo, uploadPublicFile } from "@/lib/uploadProvider";

// Uploads are proxied through the server: the free hosts do not send CORS
// headers, so the browser cannot talk to them directly.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Large videos on slow connections can take a while (only relevant on Vercel).
export const maxDuration = 300;

/** Lets the UI (or a curious developer) see which provider is active. */
export async function GET() {
  return NextResponse.json({ provider: getUploadProviderInfo() });
}

export async function POST(req: NextRequest) {
  const provider = getUploadProviderInfo();

  if (!provider.ready) {
    return NextResponse.json(
      { error: `${provider.label} is not available: ${provider.missingConfig}` },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (error) {
    console.error("Upload request could not be parsed:", error);
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  const file = formData.get("file");
  const filename = formData.get("filename");

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const requestedName =
    typeof filename === "string" && filename.trim()
      ? filename
      : file instanceof File
        ? file.name
        : undefined;

  if (file.size > provider.maxBytes) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    const maxMb = Math.round(provider.maxBytes / 1024 / 1024);
    return NextResponse.json(
      { error: `The video is ${sizeMb} MB but ${provider.label} allows at most ${maxMb} MB` },
      { status: 413 }
    );
  }

  try {
    const result = await uploadPublicFile(file, requestedName, provider.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Upload to ${provider.label} failed:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed", provider: provider.id },
      { status: 502 }
    );
  }
}
