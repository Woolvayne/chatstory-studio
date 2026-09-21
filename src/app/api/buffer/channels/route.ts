import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "BUFFER_API_KEY not configured" }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.bufferapp.com/1/profiles.json", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Buffer API error: ${err}` }, { status: response.status });
    }

    const profiles = await response.json();
    return NextResponse.json({ channels: profiles });
  } catch (error) {
    console.error("Buffer channels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Buffer channels" },
      { status: 500 }
    );
  }
}
