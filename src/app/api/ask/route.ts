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
  listPortfolioStatusTool,
  getFeedsCapacityTool,
  listFeedsActiveInMonthTool,
  getStandalonesTotalsByYearTool,
  listStandalonesActiveInMonthTool,
} from "@/lib/ai/tools";
import type { ProjectSearchResult, ProjectStatus } from "@/lib/project-status/types";
import {
  tasksToListPayload,
  upcomingToListPayload,
  atRiskToListPayload,
  feedsActiveToListPayload,
  standalonesActiveToListPayload,
} from "@/lib/ai/format";
import { parsePeriod, monthLabel } from "@/lib/ops/period";

const HELP_MESSAGE = `No entendí bien la pregunta. Puedo responder cosas como:
- "¿Cómo está <proyecto>?"
- "¿Qué falta en <proyecto>?"
- "¿Qué está vencido en <proyecto>?"
- "¿Qué está bloqueado en <proyecto>?"
- "¿Cuáles son los próximos deadlines de <proyecto>?"
- "¿Qué proyectos están en riesgo?"
- "¿Qué eventos vienen?"
- "¿Cuál es el pico de feeds en <año>?" / "¿Qué feeds están activos en <mes>?"
- "¿Cuántos standalones hay en <año>?" / "¿Qué standalones están activos en <mes>?"
El nombre del proyecto puede ser parcial (ej. "Telefe" en vez del nombre completo).`;

type Intent =
  | "portfolio_status"
  | "at_risk"
  | "upcoming"
  | "deadlines"
  | "overdue"
  | "blocked"
  | "pending"
  | "status"
  | "feeds"
  | "standalones"
  | "unknown";

interface IntentDef {
  intent: Intent;
  patterns: RegExp[];
}

const INTENT_PATTERNS: IntentDef[] = [
  {
    intent: "portfolio_status",
    patterns: [
      /(?:status|estado)\s+(?:de|del|de los|de las)\s+(realit(?:y|ies)|festivales?|canales?)/i,
      /c[oó]mo\s+(?:vienen|est[aá]n)\s+(?:los|las)?\s*(realit(?:y|ies)|festivales?|canales?)/i,
    ],
  },
  { intent: "feeds", patterns: [/\bfeeds?\b/] },
  { intent: "standalones", patterns: [/\bstandalones?\b/] },
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
    patterns: [
      /qu[eé]\s+est[aá]\s+vencid[oa]s?/,
      /qu[eé]\s+hay\s+vencid[oa]s?/,
      /vencid[oa]s?\s+en/,
      /atrasad[oa]s?\s+en/,
    ],
  },
  {
    intent: "blocked",
    patterns: [
      /qu[eé]\s+est[aá]\s+bloquead[oa]s?/,
      /qu[eé]\s+hay\s+bloquead[oa]s?/,
      /bloquead[oa]s?\s+en/,
      /bloqueos?\s+de/,
    ],
  },
  {
    intent: "pending",
    patterns: [/qu[eé]\s+falta/, /pendientes?\s+de/, /qu[eé]\s+queda/],
  },
  {
    intent: "status",
    patterns: [
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

function cleanProjectQuery(text: string): string {
  return cleanQuery(text)
    .replace(/^(?:en|de|del|para|sobre)\s+/i, "")
    .replace(/\s+(?:ahora|hoy)$/i, "")
    .trim();
}

interface MatchResult {
  intent: Intent;
  projectQuery: string;
}

function matchIntent(text: string): MatchResult {
  const cleaned = text.trim();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match && match.index != null) {
        const remainder = cleaned.slice(0, match.index) + cleaned.slice(match.index + match[0].length);
        return { intent, projectQuery: cleanProjectQuery(remainder) };
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
  const cleanedProjectQuery = cleanProjectQuery(projectQuery);
  if (!cleanedProjectQuery) {
    return { ok: false, reply: "¿De qué proyecto querés saber? Decime el nombre (puede ser parcial)." };
  }
  const { matches } = await searchProjectsTool(cleanedProjectQuery);
  if (matches.length === 0) {
    return { ok: false, reply: `No encontré ningún proyecto que coincida con "${cleanedProjectQuery}".` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reply: `Hay más de un proyecto que coincide con "${cleanedProjectQuery}". ¿Cuál buscabas?`,
      matches,
    };
  }
  return { ok: true, projectName: matches[0].name };
}

async function handleRuleBased(text: string): Promise<NextResponse> {
  const { intent, projectQuery } = matchIntent(text);

  if (intent === "portfolio_status") {
    const normalized = cleanQuery(text).toLowerCase();
    const category = /festival/.test(normalized) ? "Festival" : /canal/.test(normalized) ? "Canal" : "Reality";
    const result = await listPortfolioStatusTool(category);
    if (result.projects.length === 0) {
      return NextResponse.json({ reply: `No encontré ${category === "Reality" ? "realities" : category === "Festival" ? "festivales" : "canales"} pendientes en este momento.` });
    }
    return NextResponse.json({
      reply: `Estado general de ${category === "Reality" ? "realities" : category === "Festival" ? "festivales" : "canales"}:`,
      portfolioStatus: { category, projects: result.projects },
    });
  }

  if (intent === "feeds") {
    const { year, monthIndex } = parsePeriod(text);
    if (monthIndex !== null && year !== null) {
      const result = await listFeedsActiveInMonthTool(text);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      if (result.projects.length === 0) return NextResponse.json({ reply: `No hay feeds activos en ${monthLabel(year, monthIndex)}.` });
      return NextResponse.json({
        reply: `Feeds activos en ${monthLabel(year, monthIndex)}:`,
        list: feedsActiveToListPayload(result.projects, `Feeds activos en ${monthLabel(year, monthIndex)}`),
      });
    }
    if (year !== null) {
      const result = await getFeedsCapacityTool(year);
      const { peakFeeds, peakMonth } = result.capacity;
      return NextResponse.json({
        reply: peakMonth ? `El pico de feeds simultáneos en ${year} es ${peakFeeds} (en ${peakMonth}).` : `No encontré datos de feeds para ${year}.`,
      });
    }
    return NextResponse.json({
      reply: '¿De qué año o mes querés saber la capacidad de feeds? Ejemplo: "pico de feeds en 2026" o "feeds activos en octubre 2026".',
    });
  }

  if (intent === "standalones") {
    const { year, monthIndex } = parsePeriod(text);
    if (monthIndex !== null && year !== null) {
      const result = await listStandalonesActiveInMonthTool(text);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      if (result.events.length === 0) return NextResponse.json({ reply: `No hay standalones activos en ${monthLabel(year, monthIndex)}.` });
      return NextResponse.json({
        reply: `Standalones activos en ${monthLabel(year, monthIndex)}:`,
        list: standalonesActiveToListPayload(result.events, `Standalones activos en ${monthLabel(year, monthIndex)}`),
      });
    }
    if (year !== null) {
      const result = await getStandalonesTotalsByYearTool(year);
      return NextResponse.json({ reply: `En ${year} hay ${result.totals.totalEvents} eventos standalone en total, de ${result.totals.distinctShows} shows/proyectos distintos.` });
    }
    return NextResponse.json({
      reply: '¿De qué año o mes querés saber los standalones? Ejemplo: "standalones en 2026" o "standalones activos en junio 2026".',
    });
  }

  if (intent === "at_risk") {
    const { projects } = await listProjectsAtRiskTool();
    if (projects.length === 0) return NextResponse.json({ reply: "No hay proyectos marcados en riesgo en este momento." });
    return NextResponse.json({ reply: `${projects.length} proyecto${projects.length === 1 ? "" : "s"} en riesgo:`, list: atRiskToListPayload(projects) });
  }

  if (intent === "upcoming") {
    const { projects } = await listUpcomingProjectsTool();
    if (projects.length === 0) return NextResponse.json({ reply: "No encontré proyectos próximos a lanzar." });
    return NextResponse.json({ reply: "Próximos en iniciar:", list: upcomingToListPayload(projects) });
  }

  if (intent === "unknown") {
    const trimmed = cleanQuery(text);
    let { matches } = await searchProjectsTool(trimmed);
    if (matches.length === 0) {
      const stripped = stripQuestionWords(trimmed);
      if (stripped && stripped !== trimmed) matches = (await searchProjectsTool(stripped)).matches;
    }
    if (matches.length === 1) {
      const result = await getProjectStatusTool(matches[0].name);
      if (result.ok) return NextResponse.json({ reply: formatStatus(result.status), status: result.status });
    } else if (matches.length > 1) {
      return NextResponse.json({ reply: `Hay más de un proyecto que coincide con "${trimmed}". ¿Cuál buscabas?`, matches });
    }
    return NextResponse.json({ reply: HELP_MESSAGE });
  }

  const resolved = await resolveProject(projectQuery);
  if (!resolved.ok) return NextResponse.json({ reply: resolved.reply, matches: resolved.matches });
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
      if (result.tasks.length === 0) return NextResponse.json({ reply: `No hay tareas pendientes en ${projectName}.` });
      return NextResponse.json({ reply: `Tareas pendientes en ${projectName}:`, list: tasksToListPayload(result.tasks, `Pendientes en ${projectName}`) });
    }
    case "blocked": {
      const result = await getBlockedTasksTool(projectName);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      if (result.tasks.length === 0) return NextResponse.json({ reply: `No hay tareas bloqueadas en ${projectName}.` });
      return NextResponse.json({ reply: `Tareas bloqueadas en ${projectName}:`, list: tasksToListPayload(result.tasks, `Bloqueadas en ${projectName}`) });
    }
    case "overdue": {
      const result = await getOverdueTasksTool(projectName);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      if (result.tasks.length === 0) return NextResponse.json({ reply: `No hay tareas vencidas en ${projectName}.` });
      return NextResponse.json({ reply: `Tareas vencidas en ${projectName}:`, list: tasksToListPayload(result.tasks, `Vencidas en ${projectName}`) });
    }
    case "deadlines": {
      const result = await getProjectDeadlinesTool(projectName);
      if (!result.ok) return NextResponse.json({ reply: result.message });
      if (result.tasks.length === 0) return NextResponse.json({ reply: `No hay deadlines pendientes en ${projectName}.` });
      return NextResponse.json({ reply: `Próximos deadlines en ${projectName}:`, list: tasksToListPayload(result.tasks, `Deadlines en ${projectName}`) });
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

  try {
    // Known operational intents are deterministic: parse the project name
    // locally and query Airtable directly. This prevents the LLM from sending
    // fragments such as "Qué está Tennis TV" as the project name.
    if (matchIntent(current.content).intent !== "unknown") {
      return await handleRuleBased(current.content);
    }

    if (process.env.GROQ_API_KEY) {
      try {
        const result = await runGroqChat(history);
        return NextResponse.json(result);
      } catch (err) {
        console.error("Groq chat falló, usando el parser basado en reglas:", err);
      }
    }

    return await handleRuleBased(current.content);
  } catch (err) {
    console.error("Error procesando la pregunta:", err);
    return NextResponse.json({ error: "Ocurrió un error procesando la pregunta." }, { status: 500 });
  }
}
