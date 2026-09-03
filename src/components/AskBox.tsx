"use client";

import { useEffect, useRef, useState } from "react";
import ProjectBrief from "@/components/ProjectBrief";
import ProjectStatusDashboard from "@/components/ProjectStatusDashboard";
import TaskTable from "@/components/TaskTable";
import ListCards from "@/components/ListCards";
import type { ListPayload, ProjectSearchResult, ProjectStatus } from "@/lib/project-status/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  matches?: ProjectSearchResult[];
  status?: ProjectStatus;
  list?: ListPayload;
}

/** Contextual follow-up chips shown under the latest assistant answer. */
function suggestionsFor(m: ChatMessage): string[] {
  if (m.status) {
    const name = m.status.project.name;
    return [`¿Qué falta en ${name}?`, `¿Qué está vencido en ${name}?`, `Próximos deadlines de ${name}`];
  }
  if (m.list) {
    return ["¿Qué proyectos están en riesgo?", "¿Qué eventos vienen?"];
  }
  return [];
}

const EXAMPLES = [
  "¿Cómo está Telefe?",
  "¿Qué eventos vienen?",
  "¿Qué proyectos están en riesgo?",
  "¿Qué está vencido en La Granja VIP 2?",
];

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0M12 18v3"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  );
}

/** Picks a MediaRecorder mime type the current browser actually supports. */
function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
}

export default function AskBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [micSupported, setMicSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMicSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, transcribing]);

  async function sendText(text: string) {
    if (!text || loading) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Error desconocido");
      }
      setMessages([
        ...next,
        {
          role: "assistant",
          content: body.reply as string,
          matches: body.matches as ProjectSearchResult[] | undefined,
          status: body.status as ProjectStatus | undefined,
          list: body.list as ListPayload | undefined,
        },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText(input.trim());
    }
  }

  async function startRecording() {
    if (recording || transcribing) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        await transcribeAndFill(blob);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("No pude acceder al micrófono. Revisá los permisos del navegador.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function transcribeAndFill(blob: Blob) {
    setTranscribing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "audio.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "No se pudo transcribir el audio.");
      }
      const text = (body.text as string) ?? "";
      if (text) {
        sendText(text);
      } else {
        setError("No entendí el audio, ¿podés intentar de nuevo?");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTranscribing(false);
    }
  }

  function toggleRecording() {
    if (recording) stopRecording();
    else startRecording();
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col">
      {empty ? (
        <div className="py-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Preguntame sobre un proyecto</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Escribí o dictá el nombre de un proyecto (puede ser parcial) o hacé una pregunta con tus
            propias palabras.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => sendText(ex)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col gap-3"}>
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white dark:bg-indigo-600">
                  {m.content}
                </div>
              ) : (
                <>
                  <div
                    className="max-w-[85%] rounded-2xl bg-white px-4 py-2 text-sm text-slate-800 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {m.content}
                  </div>
                  {m.matches && m.matches.length > 0 && (
                    <div className="flex max-w-[85%] flex-wrap gap-2">
                      {m.matches.map((match) => (
                        <button
                          key={match.id}
                          onClick={() => sendText(match.name)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                        >
                          {match.name}
                          {match.status && <span className="ml-1.5 text-slate-400 dark:text-slate-500">({match.status})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.list && <ListCards list={m.list} />}
                  {m.status && (
                    <div className="max-w-full space-y-4">
                      <ProjectBrief status={m.status} />
                      <ProjectStatusDashboard status={m.status} />
                      <TaskTable tasks={m.status.tasks} />
                    </div>
                  )}
                  {i === messages.length - 1 &&
                    !loading &&
                    (() => {
                      const suggestions = suggestionsFor(m);
                      return suggestions.length > 0 ? (
                        <div className="flex max-w-[85%] flex-wrap gap-2">
                          {suggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => sendText(s)}
                              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}
                </>
              )}
            </div>
          ))}
          {loading && <p className="text-sm text-slate-400 dark:text-slate-500">Pensando...</p>}
          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">{error}</p>
      )}

      <div className="sticky bottom-0 flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={recording ? "Escuchando..." : transcribing ? "Transcribiendo..." : "Ej: La Granja VIP 2: México, o \"qué falta en Telefe\"..."}
          disabled={recording || transcribing}
          className="max-h-32 flex-1 resize-none rounded-xl border-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        {micSupported && (
          <button
            onClick={toggleRecording}
            disabled={transcribing || loading}
            title={recording ? "Detener grabación" : "Preguntar por voz"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${
              recording
                ? "animate-pulse bg-red-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <MicIcon />
          </button>
        )}
        <button
          onClick={() => sendText(input.trim())}
          disabled={loading || recording || transcribing || !input.trim()}
          title="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
