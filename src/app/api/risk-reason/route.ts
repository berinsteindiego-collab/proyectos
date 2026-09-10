import { NextRequest, NextResponse } from "next/server";
import { getProjectStatusTool, searchProjectsTool } from "@/lib/ai/tools";
import { tasksToListPayload } from "@/lib/ai/format";
import type { ProjectSearchResult, ProjectStatus, ProjectTask } from "@/lib/project-status/types";

function cleanProjectQuery(text: string): string {
  return text
    .replace(/[¿?¡!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProjectQuery(text: string): string {
  const cleaned = cleanProjectQuery(text);
  const patterns = [
    /^por\s+qu[eé]\s+(?:est[aá]|figura|aparece)\s+(?:el\s+proyecto\s+)?(?:en\s+)?(?:riesgo|risk)\s+(.+)$/i,
    /^por\s+qu[eé]\s+(.+?)\s+(?:est[aá]|figura|aparece)\s+(?:en\s+)?(?:riesgo|risk)$/i,
    /^(?:por\s+qu[eé]|porque)\s+(?:est[aá]|figura|aparece)\s+(?:en\s+)?(?:riesgo|risk)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return cleaned
    .replace(/^(?:por\s+qu[eé]|porque)\s+/i, "")
    .replace(/\b(?:est[aá]|figura|aparece)\b/gi, " ")
    .replace(/\b(?:en\s+)?(?:riesgo|risk)\b/gi, " ")
    .replace(/^(?:el\s+proyecto|proyecto)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveProject(projectQuery: string): Promise<
  | { ok: true; projectName: string }
  | { ok: false; reply: string; matches?: ProjectSearchResult[] }
> {
  if (!projectQuery) {
    return { ok: false, reply: "¿De qué proyecto querés saber por qué está en riesgo?" };
  }

  const { matches } = await searchProjectsTool(projectQuery);
  if (matches.length === 0) {
    return { ok: false, reply: `No encontré ningún proyecto que coincida con “${projectQuery}”.` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reply: `Hay más de un proyecto que coincide con “${projectQuery}”. ¿Cuál buscabas?`,
      matches,
    };
  }
  return { ok: true, projectName: matches[0].name };
}

function statusHas(status: string | undefined, value: "risk" | "at risk"): boolean {
  const normalized = (status ?? "").toLowerCase();
  return value === "at risk" ? normalized.includes("at risk") : normalized.includes("risk") && !normalized.includes("at risk");
}

function buildReason(status: ProjectStatus): { reply: string; tasks: ProjectTask[]; heading: string } {
  const { project, summary } = status;
  const name = project.name;

  if (statusHas(project.status, "risk")) {
    if ((summary.overdueBlockers ?? 0) > 0) {
      const tasks = status.tasks.filter((task) => task.overdueBlocker);
      const count = summary.overdueBlockers ?? tasks.length;
      return {
        reply: `${name} está en riesgo porque tiene ${count} ${count === 1 ? "tarea bloqueante vencida" : "tareas bloqueantes vencidas"}.`,
        tasks,
        heading: `Qué provoca el riesgo en ${name}`,
      };
    }

    if ((project.daysToLaunch ?? Infinity) <= 7 && (summary.openBlockers ?? 0) > 0) {
      const tasks = status.tasks.filter((task) => task.openBlocker);
      const count = summary.openBlockers ?? tasks.length;
      return {
        reply: `${name} está en riesgo porque faltan ${project.daysToLaunch} días para el lanzamiento y tiene ${count} ${count === 1 ? "bloqueante pendiente" : "bloqueantes pendientes"}.`,
        tasks,
        heading: `Qué provoca el riesgo en ${name}`,
      };
    }
  }

  if (statusHas(project.status, "at risk") && (project.daysToLaunch ?? Infinity) <= 14 && (summary.openBlockers ?? 0) > 0) {
    const tasks = status.tasks.filter((task) => task.openBlocker);
    const count = summary.openBlockers ?? tasks.length;
    return {
      reply: `${name} está At Risk porque faltan ${project.daysToLaunch} días para el lanzamiento y tiene ${count} ${count === 1 ? "bloqueante pendiente" : "bloqueantes pendientes"}.`,
      tasks,
      heading: `Qué provoca el riesgo en ${name}`,
    };
  }

  return {
    reply: `${name} no figura actualmente como Risk ni At Risk en Airtable. Su estado es ${project.status ?? "no informado"}.`,
    tasks: [],
    heading: `Estado de ${name}`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const query = extractProjectQuery(req.nextUrl.searchParams.get("q") ?? "");
    const resolved = await resolveProject(query);
    if (!resolved.ok) return NextResponse.json(resolved);

    const result = await getProjectStatusTool(resolved.projectName);
    if (!result.ok) return NextResponse.json({ reply: result.message });

    const reason = buildReason(result.status);
    return NextResponse.json({
      ok: true,
      reply: reason.reply,
      list: reason.tasks.length > 0 ? tasksToListPayload(reason.tasks, reason.heading) : undefined,
    });
  } catch (err) {
    console.error("Error explicando riesgo del proyecto:", err);
    return NextResponse.json({ error: "No se pudo explicar el riesgo del proyecto." }, { status: 500 });
  }
}
