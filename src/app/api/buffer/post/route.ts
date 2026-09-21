import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "BUFFER_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { profileId, videoUrl, text, scheduledAt, now: postNow } = body;

  if (!profileId || !videoUrl) {
    return NextResponse.json({ error: "profileId and videoUrl are required" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams();
    params.append("profile_ids[]", profileId);
    params.append("text", text || "");
    params.append("media[video]", videoUrl);
    params.append("media[thumbnail]", videoUrl);

    if (postNow) {
      params.append("now", "true");
    } else if (scheduledAt) {
      params.append("scheduled_at", scheduledAt);
    } else {
      params.append("top", "true");
    }

    const response = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Buffer API error: ${err}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, postId: data.updates?.[0]?.id, data });
  } catch (error) {
    console.error("Buffer post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post to Buffer" },
      { status: 500 }
    );
  }
}
