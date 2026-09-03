import { NextRequest, NextResponse } from "next/server";

// Speech-to-text for the unified search/chat box. Records audio client-side
// (MediaRecorder) and sends the blob here, which forwards it to Groq's
// OpenAI-compatible audio transcription endpoint (Whisper). Uses the same
// GROQ_API_KEY already configured for the chat assistant — no extra setup.
// Never falls back to browser-native speech recognition here; if Groq isn't
// configured we just tell the caller so the UI can disable the mic.
const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_STT_MODEL = "whisper-large-v3-turbo";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "El reconocimiento de voz no está configurado (falta GROQ_API_KEY)." },
      { status: 503 }
    );
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const audio = incoming.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Falta el audio." }, { status: 400 });
  }

  const model = process.env.GROQ_STT_MODEL || DEFAULT_STT_MODEL;
  const forward = new FormData();
  forward.append("file", audio, "audio.webm");
  forward.append("model", model);
  forward.append("language", "es");
  forward.append("response_format", "json");

  try {
    const res = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: forward,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Groq transcription respondió ${res.status}: ${text.slice(0, 200)}`);
      return NextResponse.json({ error: "No se pudo transcribir el audio." }, { status: 502 });
    }

    const body = await res.json();
    const text = (body.text as string | undefined)?.trim() ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Error llamando a Groq transcription:", err);
    return NextResponse.json({ error: "No se pudo transcribir el audio." }, { status: 502 });
  }
}
