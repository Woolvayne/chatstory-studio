import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(settings);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    // Check which env vars are configured (don't expose values)
    return NextResponse.json({
      settings: result,
      envStatus: {
        mistral: !!process.env.MISTRAL_API_KEY,
        buffer: !!process.env.BUFFER_API_KEY,
        blob: !!process.env.BLOB_READ_WRITE_TOKEN,
      },
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    await db
      .insert(settings)
      .values({ key, value: value || "" })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: value || "", updatedAt: new Date() },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}
