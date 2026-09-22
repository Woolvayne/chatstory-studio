import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, variant, model = "mistral-large-latest" } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // A browser-provided key is intentionally used for this request only. It is
  // never written to the database or an environment variable. The environment
  // value remains a backwards-compatible server-side fallback.
  const browserApiKey = req.headers.get("x-mistral-api-key")?.trim();
  const apiKey = browserApiKey || process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Mistral API key configured. Add one in Settings." },
      { status: 401 }
    );
  }

  const variantPrompts: Record<string, string> = {
    emotional: "Make the story deeply emotional with strong feelings, personal vulnerability, and heartfelt moments.",
    dramatic: "Make the story highly dramatic with intense confrontations, raised stakes, and theatrical dialogue.",
    mysterious: "Make the story mysterious and suspenseful with hidden motives, cryptic messages, and an eerie atmosphere.",
    twist: "Build toward a shocking, unexpected twist that completely reframes everything that came before.",
    escalation: "Create rapid escalation where each message raises the tension faster and faster until a breaking point.",
  };

  const variantInstruction = variantPrompts[variant] || variantPrompts.emotional;

  const systemPrompt = `You are an expert viral short-form video script writer specializing in chat story videos for TikTok, Instagram Reels, and YouTube Shorts. 
You create highly engaging, authentic-feeling chat conversations that keep viewers watching until the end.
Always respond with valid JSON only, no markdown, no code blocks.`;

  const userPrompt = `Create a complete chat story script for: "${title}"

Variant: ${variant} - ${variantInstruction}

The video should be 45-60 seconds long with this structure:
- HOOK (0-3s): Shocking first message that grabs attention
- SETUP (3-10s): Establish context and characters
- PROBLEM (10-25s): The central conflict emerges
- ESCALATION (25-40s): Tension builds rapidly
- TWIST (40-52s): Unexpected revelation or turn
- ENDING (52-60s): Resolution or cliffhanger

Return ONLY this JSON structure:
{
  "title": "story title",
  "hook": "the opening hook text",
  "variant": "${variant}",
  "characters": [
    {"name": "Person A", "role": "protagonist", "voice": "german_female", "color": "#3B82F6", "avatar": "😊"},
    {"name": "Person B", "role": "antagonist", "voice": "german_male", "color": "#EF4444", "avatar": "😤"}
  ],
  "messages": [
    {"id": "1", "sender": "Person A", "text": "message text", "timestamp": "14:23", "delay": 0, "duration": 2.5},
    {"id": "2", "sender": "Person B", "text": "reply text", "timestamp": "14:24", "delay": 2.5, "duration": 3.0}
  ],
  "scenes": [
    {"id": "s1", "description": "scene description", "imagePrompt": "detailed image generation prompt for this scene", "startTime": 0, "endTime": 10},
    {"id": "s2", "description": "scene 2 description", "imagePrompt": "another detailed prompt", "startTime": 10, "endTime": 25}
  ],
  "ending": "how the story ends",
  "voice_style": "conversational",
  "estimated_duration": 55,
  "caption": "engaging caption for social media",
  "hashtags": ["#chatstory", "#viral", "#shorts", "#story"]
}

Important:
- Messages must be in German (realistic, authentic)
- Create 8-14 messages total for proper pacing
- Each message delay should add up to roughly the estimated_duration
- Make the hook absolutely compelling - first 3 seconds determine if viewers stay
- Characters should feel real and relatable
- The ${variant} variant must be clearly distinct`;

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Mistral API error: ${err}` }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "No content returned from Mistral" }, { status: 500 });
    }

    const script = JSON.parse(content);
    return NextResponse.json({ script });
  } catch (error) {
    console.error("Mistral error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Script generation failed" },
      { status: 500 }
    );
  }
}
