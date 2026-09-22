import { NextRequest, NextResponse } from "next/server";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function extractJsonCandidate(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  return start >= 0 ? trimmed.slice(start) : trimmed;
}

function repairTruncatedJson(text: string): string {
  let source = text.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
  let inString = false;
  let escaped = false;
  const stack: Array<"}" | "]"> = [];

  for (const ch of source) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") inString = false;
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if ((ch === "}" || ch === "]") && stack[stack.length - 1] === ch) stack.pop();
  }

  if (escaped) source = source.slice(0, -1);
  if (inString) source += "\"";
  source = source.replace(/,\s*$/, "");
  while (stack.length) source += stack.pop();
  return source;
}

function parseJsonObject(content: string): Record<string, unknown> {
  const candidate = extractJsonCandidate(content);
  const direct = tryParseJson(candidate);
  if (direct) return direct;

  const repaired = tryParseJson(repairTruncatedJson(candidate));
  if (repaired) return repaired;

  const cutPoints = [
    candidate.lastIndexOf("},"),
    candidate.lastIndexOf("],"),
    candidate.lastIndexOf("}"),
    candidate.lastIndexOf(","),
    candidate.lastIndexOf("\n"),
  ].filter((index) => index > 20);

  for (const cut of cutPoints) {
    const sliced = tryParseJson(repairTruncatedJson(candidate.slice(0, cut)));
    if (sliced) return sliced;
  }

  throw new Error("Mistral returned incomplete JSON");
}

function buildPrompt(title: string, variant: string, compact: boolean): { systemPrompt: string; userPrompt: string } {
  const variantPrompts: Record<string, string> = {
    emotional: "Make the story deeply emotional with strong feelings, personal vulnerability, and heartfelt moments.",
    dramatic: "Make the story highly dramatic with intense confrontations, raised stakes, and theatrical dialogue.",
    mysterious: "Make the story mysterious and suspenseful with hidden motives, cryptic messages, and an eerie atmosphere.",
    twist: "Build toward a shocking, unexpected twist that completely reframes everything that came before.",
    escalation: "Create rapid escalation where each message raises the tension faster and faster until a breaking point.",
  };
  const variantInstruction = variantPrompts[variant] || variantPrompts.emotional;
  const messageCount = compact ? "exactly 8" : "8-10";

  const systemPrompt = `You are an expert viral short-form video script writer for TikTok, Instagram Reels, and YouTube Shorts.
Always respond with a single complete, valid JSON object. No markdown, no code fences, no trailing commentary.`;

  const userPrompt = `Create a complete chat story script for: "${title}"

Variant: ${variant} - ${variantInstruction}

Return ONLY this JSON object, fully closed:
{
  "title": "story title",
  "hook": "short opening hook",
  "variant": "${variant}",
  "characters": [
    {"name": "Person A", "role": "protagonist", "voice": "german_female", "color": "#3B82F6", "avatar": "😊"},
    {"name": "Person B", "role": "antagonist", "voice": "german_male", "color": "#EF4444", "avatar": "😤"}
  ],
  "messages": [
    {"id": "1", "sender": "Person A", "text": "message text", "timestamp": "14:23", "delay": 0.8, "duration": 2.5}
  ],
  "scenes": [
    {"id": "s1", "description": "short scene", "imagePrompt": "short visual prompt", "startTime": 0, "endTime": 20}
  ],
  "ending": "how the story ends",
  "voice_style": "conversational",
  "estimated_duration": 55,
  "caption": "short social caption",
  "hashtags": ["#chatstory", "#viral", "#shorts", "#story"]
}

Rules:
- Messages must be in German and sound authentic
- Create ${messageCount} messages; each text under 120 characters
- Include exactly 2 scenes; each imagePrompt under 20 words
- Keep hook, caption and ending under 160 characters
- The JSON MUST be complete. Never cut a string or omit closing braces`;

  return { systemPrompt, userPrompt };
}

async function requestScript(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<{ content: string; finishReason: string }> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw Object.assign(new Error(`Mistral API error: ${err}`), { status: response.status });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from Mistral");
  }

  return {
    content: typeof content === "string" ? content : JSON.stringify(content),
    finishReason: String(data.choices?.[0]?.finish_reason || ""),
  };
}

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

  try {
    const attempts: Array<{ compact: boolean; maxTokens: number }> = [
      { compact: false, maxTokens: 8192 },
      { compact: true, maxTokens: 8192 },
    ];

    let lastError: unknown;
    for (const attempt of attempts) {
      const { systemPrompt, userPrompt } = buildPrompt(title, variant, attempt.compact);
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      try {
        const first = await requestScript(apiKey, model, messages, attempt.maxTokens);
        let script = tryParseJson(extractJsonCandidate(first.content))
          || tryParseJson(repairTruncatedJson(extractJsonCandidate(first.content)));

        if (!script && first.finishReason === "length") {
          const continuation = await requestScript(
            apiKey,
            model,
            [
              ...messages,
              { role: "assistant", content: first.content },
              {
                role: "user",
                content:
                  "The JSON was cut off. Continue from the exact cutoff point and output only the remaining JSON characters needed to make it valid. Do not restart the object.",
              },
            ],
            attempt.maxTokens
          );
          const rest = continuation.content.trim();
          const combined = rest.startsWith("{") ? rest : `${first.content}${continuation.content}`;
          script = parseJsonObject(combined);
        } else if (!script) {
          script = parseJsonObject(first.content);
        }

        return NextResponse.json({ script });
      } catch (error) {
        lastError = error;
        if (error && typeof error === "object" && "status" in error) {
          const status = Number((error as { status?: number }).status);
          if (status && status !== 500) {
            return NextResponse.json(
              { error: error instanceof Error ? error.message : "Mistral API error" },
              { status }
            );
          }
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Script generation failed");
  } catch (error) {
    console.error("Mistral error:", error);
    const status = error && typeof error === "object" && "status" in error
      ? Number((error as { status?: number }).status) || 500
      : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Script generation failed" },
      { status }
    );
  }
}
