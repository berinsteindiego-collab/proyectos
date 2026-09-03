import { NextRequest, NextResponse } from "next/server";
import { runGroqChat } from "@/lib/ai/groq";
import {
  getProjectStatusTool,
  getPendingTasksTool,
  getBlockedTasksTool,
  getOverdueTasksTool,
  getProjectDeadlinesTool,
  searchProjectsTool,
  listUpcomingProjectsTool,
  listProjectsAtRiskTool,
} from "@/lib/ai/tools";
import type { ProjectSearchResult, ProjectStatus } from "@/lib/project-status/types";
import { tasksToListPayload, upcomingToListPayload, atRiskToListPayload } from "@/lib/ai/format";

// Rule-based question parser for /api/ask, used whenever GROQ_API_KEY isn't
// configured or the Groq call throws (see src/lib/ai/groq.ts). Airtable is
// the only source of truth here too: every branch below resolves a project
// via the same read-only tools the Groq assistant uses, and never invents or
// recomputes a value Airtable already owns.

const HELP_MESSAGE = `No entendí bien la pregunta. Puedo responder cosas como:
- "¿Cómo está <proyecto>?"
- "¿Qué falta en <proyecto>?"
- "¿Qué está vencido en <proyecto>?"
- "¿Qué está bloqueado en <proyecto>?"
- "¿Cuáles son los próximos deadlines de <proyecto>?"
- "¿Qué proyectos están en riesgo?"
- "¿Qué eventos vienen?"
El nombre del proyecto puede ser parcial (ej. "Telefe" en vez del nombre completo).`;

type Intent =
  | "at_risk"
  | "upcoming"
  | "deadlines"
  | "overdue"
  | "blocked"
  | "pending"
  | "status"
  | "unknown";

interface IntentDef {
  intent: Intent;
  patterns: RegExp[];
}

// Checked in order — project-independent intents and the more specific
// task-list intents come first, "status" is the broadest catch-all so it's
// checked last (otherwise it would swallow phrasings meant for the others).
const INTENT_PATTERNS: IntentDef[] = [
  {
    intent: "at_risk",
    patterns: [/proyectos?\s+(est[aá]n\s+)?en\s+riesgo/, /qu[eé]\s+est[aá]\s+en\s+riesgo/],
  },
  {
    intent: "upcoming",
    patterns: [
      /qu[eé]\s+eventos?\s+vienen/,
      /pr[oó]ximos?\s+eventos?/,
      /pr[oó]ximo\s+(proyecto\s+)?en\s+(iniciar|empezar|arrancar|lanzar)/,
      /qu[eé]\s+viene/,
    ],
  },
  {
    intent: "deadlines",
    patterns: [/pr[oó]ximos?\s+deadlines?/, /cu[aá]ndo\s+vence/, /deadlines?\s+de/],
  },
  {
    intent: "overdue",
    patterns: [/qu[eé]\s+est[aá]\s+vencido/, /vencid[oa]s?\s+en/, /atrasad[oa]s?\s+en/],
  },
  {
    intent: "blocked",
    patterns: [/qu[eé]\s+est[aá]\s+bloqueado/, /bloque[ao]d[oa]s?\s+en/, /bloqueos?\s+de/],
  },
  {
    intent: "pending",
    patterns: [/qu[eé]\s+falta/, /pendientes?\s+de/, /qu[eé]\s+queda/],
  },
  {
    intent: "status",
    patterns: [
      // Full-phrase variants first so the matched span swallows filler words
      // ("en qué", "cuál es el") and leaves a clean project name behind.
      /en\s+qu[eé]\s+estado\s+est[aá]/,
      /en\s+qu[eé]\s+estado\s+se\s+encuentra/,
      /cu[aá]l\s+es\s+el\s+estado\s+de/,
      /cu[aá]l\s+es\s+el\s+estado\s+del/,
      /c[oó]mo\s+est[aá]/,
      /c[oó]mo\s+viene/,
      /c[oó]mo\s+va/,
      /estado\s+de/,
      /estado\s+del/,
      /estado\s+actual/,
    ],
  },
];

// Common Spanish question filler words that never appear inside a project
// name — stripped as a last resort when no intent regex matched, so a
// phrasing we didn't anticipate still has a chance of resolving to a
// project instead of falling straight to the help message.
const QUESTION_STOPWORDS =
  /\b(en|qu[eé]|c[oó]mo|cu[aá]l|cu[aá]les|es|est[aá]|est[aá]n|se|encuentra|de|del|para|el|la|los|las|un|una|hay|tiene|sobre)\b/gi;

function stripQuestionWords(text: string): string {
  return text
    .replace(/[¿?¡!.,]/g, " ")
    .replace(QUESTION_STOPWORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanQuery(text: string): string {
  return text
    .replace(/[¿?¡!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface MatchResult {
  intent: Intent;
  projectQuery: string;
}

/**
 * Finds the first intent whose pattern matches `text`, and returns whatever
 * is left of the sentence after removing the matched phrase — that leftover
 * is what we search Airtable project names against.
 */
function matchIntent(text: string): MatchResult {
  const cleaned = text.trim();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match && match.index != null) {
        const remainder = cleaned.slice(0, match.index) + cleaned.slice(match.index + match[0].length);
        return { intent, projectQuery: cleanQuery(remainder) };
      }
    }
  }
  return { intent: "unknown", projectQuery: cleanQuery(cleaned) };
}

function formatStatus(status: ProjectStatus): string {
  const { project, summary } = status;
  const parts = [
    `${project.name}: ${project.status ?? "estado no informado"}.`,
    project.readiness != null ? `Launch Readiness ${project.readiness}%.` : null,
    project.daysToLaunch != null ? `${project.daysToLaunch} días para lanzamiento.` : null,
    `${summary.pendingTasks} tareas pendientes de ${summary.totalTasks}.`,
    summary.openBlockers ? `${summary.openBlockers} bloqueos abiertos.` : null,
    summary.overdueBlockers ? `${summary.overdueBlockers} bloqueos vencidos.` : null,
  ].filter(Boolean);
  return parts.join(" ");
}


async function resolveProject(
  projectQuery: string
): Promise<{ ok: true; projectName: string } | { ok: false; reply: string; matches?: ProjectSearchResult[] }> {
  if (!projectQuery) {
    return { ok: false, reply: "¿De qué proyecto querés saber? Decime el nombre (puede ser parcial)." };
  }
  const { matches } = await searchProjectsTool(projectQuery);
  if (matches.length === 0) {
    return { ok: false, reply: `No encontré ningún proyecto que coincida con "${projectQuery}".` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reply: `Hay más de un proyecto que coincide con "${projectQuery}". ¿Cuál buscabas?`,
      matches,
    };
  }
  return { ok: true, projectName: matches[0].name };
}

async function handleRuleBased(text: string): Promise<NextResponse> {
  const { intent, projectQuery } = matchIntent(text);

  if (intent === "at_risk") {
    const { projects } = await listProjectsAtRiskTool();
    if (projects.length === 0) {
      return NextResponse.json({ reply: "No hay proyectos marcados en riesgo en este momento." });
    }
    return NextResponse.json({
      reply: `${projects.length} proyecto${projects.length === 1 ? "" : "s"} en riesgo:`,
      list: atRiskToListPayload(projects),
    });
  }

  if (intent === "upcoming") {
    const { projects } = await listUpcomingProjectsTool();
    if (projects.length === 0) {
      return NextResponse.json({ reply: "No encontré proyectos próximos a lanzar." });
    }
    return NextResponse.json({ reply: "Próximos en iniciar:", list: upcomingToListPayload(projects) });
  }

  if (intent === "unknown") {
    const trimmed = cleanQuery(text);
    let { matches } = await searchProjectsTool(trimmed);
    // The raw sentence rarely matches a short project name directly (it
    // checks whether the name *contains* the query). Retry with question
    // filler words stripped before giving up — this is what lets
    // unanticipated phrasings like "en qué estado está X" still resolve.
    if (matches.length === 0) {
      const stripped = stripQuestionWords(trimmed);
      if (stripped && stripped !== trimmed) {
        matches = (await searchProjectsTool(stripped)).matches;
      }
    }
    if (matches.length === 1) {
      const result = await getProjectStatusTool(matches[0].name);
      if (result.ok) {
        return NextResponse.json({ reply: formatStatus(result.status), status: result.status });
      }
    } else if (matches.length > 1) {
      return NextResponse.json({
        reply: `Hay más de un proyecto que coincide con "${trimmed}". ¿Cuál buscabas?`,
        matches,
      });
    }
    return NextResponse.json({ reply: HELP_MESSAGE });
  }

  const resolved = await resolveProject(projectQuery);
  if (!resolved.ok) {
    return NextResponse.json({ reply: resolved.reply, matches: resolved.matches });
  }
  const projectName = resolved.projectName;

  switch (intent) {
    case "status": {
      const result = await getProjectStatusTool(projectName);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      return NextResponse.json({ reply: formatStatus(result.status), status: result.status });
    }
    case "pending": {
      const result = await getPendingTasksTool(projectName);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      if (result.tasks.length === 0) {
        return NextResponse.json({ reply: `No hay tareas pendientes en ${projectName}.` });
      }
      return NextResponse.json({
        reply: `Tareas pendientes en ${projectName}:`,
        list: tasksToListPayload(result.tasks, `Pendientes en ${projectName}`),
      });
    }
    case "blocked": {
      const result = await getBlockedTasksTool(projectName);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      if (result.tasks.length === 0) {
        return NextResponse.json({ reply: `No hay tareas bloqueadas en ${projectName}.` });
      }
      return NextResponse.json({
        reply: `Tareas bloqueadas en ${projectName}:`,
        list: tasksToListPayload(result.tasks, `Bloqueadas en ${projectName}`),
      });
    }
    case "overdue": {
      const result = await getOverdueTasksTool(projectName);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      if (result.tasks.length === 0) {
        return NextResponse.json({ reply: `No hay tareas vencidas en ${projectName}.` });
      }
      return NextResponse.json({
        reply: `Tareas vencidas en ${projectName}:`,
        list: tasksToListPayload(result.tasks, `Vencidas en ${projectName}`),
      });
    }
    case "deadlines": {
      const result = await getProjectDeadlinesTool(projectName);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      if (result.tasks.length === 0) {
        return NextResponse.json({ reply: `No hay deadlines pendientes en ${projectName}.` });
      }
      return NextResponse.json({
        reply: `Próximos deadlines en ${projectName}:`,
        list: tasksToListPayload(result.tasks, `Deadlines en ${projectName}`),
      });
    }
    default:
      return NextResponse.json({ reply: HELP_MESSAGE });
  }
}

export async function POST(req: NextRequest) {
  let body: { messages?: { role: "user" | "assistant"; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const history = body.messages ?? [];
  const current = history[history.length - 1];
  if (!current || current.role !== "user" || !current.content?.trim()) {
    return NextResponse.json({ error: "Falta el mensaje del usuario." }, { status: 400 });
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const result = await runGroqChat(history);
      return NextResponse.json(result);
    } catch (err) {
      // Falls through to the rule-based parser below — Groq being
      // unavailable/misconfigured should never break the assistant.
      console.error("Groq chat falló, usando el parser basado en reglas:", err);
    }
  }

  try {
    return await handleRuleBased(current.content);
  } catch (err) {
    console.error("Error en el parser basado en reglas:", err);
    return NextResponse.json({ error: "Ocurrió un error procesando la pregunta." }, { status: 500 });
  }
}
