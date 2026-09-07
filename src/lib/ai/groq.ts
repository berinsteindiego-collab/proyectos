// Optional LLM-backed assistant for /api/ask, using Groq's free,
// OpenAI-compatible chat completions API. Only ever called if GROQ_API_KEY
// is configured; the model can only see Airtable data through the same
// read-only tools already used by the rule-based parser (see
// src/lib/ai/tools.ts) — it never answers from its own general knowledge,
// and it never writes to Airtable.
import {
  getProjectStatusTool,
  getPendingTasksTool,
  getBlockedTasksTool,
  getOverdueTasksTool,
  getProjectDeadlinesTool,
  searchProjectsTool,
  listUpcomingProjectsTool,
  listProjectsAtRiskTool,
  findTaskTool,
  getFeedsCapacityTool,
  listFeedsActiveInMonthTool,
  getStandalonesTotalsByYearTool,
  getStandalonesTotalsByMonthTool,
  listStandalonesActiveInMonthTool,
} from "./tools";
import {
  tasksToListPayload,
  upcomingToListPayload,
  atRiskToListPayload,
  feedsActiveToListPayload,
  standalonesActiveToListPayload,
} from "./format";
import type { ListPayload } from "@/lib/project-status/types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile was deprecated by Groq for free/dev tier usage on
// 2026-06-17. openai/gpt-oss-120b is Groq's recommended replacement (see
// console.groq.com/docs/deprecations); override via GROQ_MODEL if needed.
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MAX_STEPS = 5;

const SYSTEM_PROMPT = `Sos el asistente de "Project Control", una herramienta interna de PMO que consulta una base de Airtable de proyectos (Eventos) y sus tareas.

Reglas estrictas:
- Airtable es la única fuente de verdad. Nunca inventes ni calcules un dato (estado, readiness, deadlines, bloqueos) que no venga de una tool.
- Para cualquier pregunta sobre un proyecto puntual, resolvé primero el nombre con una tool (aceptan nombres parciales, ej. "Telefe" en vez de "Telefe Internacional").
- Si una tool devuelve reason "ambiguous", listá las opciones (los nombres en "matches") y pedile al usuario que elija. No adivines cuál es.
- Si una tool devuelve reason "not_found", decile que no encontraste ningún proyecto con ese nombre.
- No respondas preguntas ajenas a estos proyectos ni busques información fuera de las tools (no tenés acceso a internet).
- Respondé siempre en español, corto y directo, sin inventar formato adicional.
- "Fecha de inicio", "start date", "cuándo arranca/empieza/inicia" y "próximo en iniciar/empezar" se refieren siempre al campo Fecha Inicio del proyecto (evento), nunca a un ítem o tarea del checklist que tenga "Start Date" en el nombre — esas son tareas de seguimiento, no la fecha real. Para "¿qué proyecto es el próximo en iniciar/empezar?" usá list_upcoming_projects (ya viene ordenada por días para lanzamiento) y citá el startDate real de cada proyecto en tu respuesta, no solo los días restantes.
- Cada tarea puede tener "responsible" (el área/equipo responsable, ej. "Programming", "Legal") y "owners" (persona o personas puntuales asignadas, por nombre). Para preguntas como "¿quién es responsable de <tarea>?", "¿quién está a cargo de <tarea>?" o "¿de quién depende <tarea>?", usá find_task para ubicar la tarea dentro del proyecto y respondé con "responsible" y "owners" tal cual vienen (si "owners" está vacío, decilo así en vez de inventar un nombre). Si find_task devuelve varias tareas que coinciden, listalas y pedile al usuario que aclare cuál.
- Cuando el resultado de una tool sea un LISTADO de tareas o proyectos (get_pending_tasks, get_blocked_tasks, get_overdue_tasks, get_project_deadlines, list_upcoming_projects, list_projects_at_risk, list_feeds_active_in_month, list_standalones_active_in_month), NO repitas el listado completo en tu respuesta de texto ni uses markdown (nada de negrita con asteriscos, guiones ni numeración): la interfaz ya muestra esos items aparte, en tarjetas con su propio formato. Alcanza con una frase corta de introducción, por ejemplo "Encontré 3 tareas pendientes en Telefe." o "Hay 2 proyectos en riesgo.". Para respuestas de estado (get_project_status) o de responsable de una tarea (find_task), sí respondé con el detalle normalmente, en texto corto y sin markdown.
- "Feeds" (feeds 24/7, capacidad, pico simultáneo) y "Standalones" (eventos standalone) NO son proyectos de Eventos — son dos módulos aparte con su propio modelo mensual en Airtable. Para preguntas sobre feeds usá get_feeds_capacity (pico de feeds simultáneos en un año) o list_feeds_active_in_month (qué proyectos de feeds están activos en un mes puntual). Para preguntas sobre standalones usá get_standalones_totals_by_year (total de eventos del año y cantidad de shows distintos), get_standalones_totals_by_month o list_standalones_active_in_month. Nunca sumes ni calcules vos mismo estos números — Airtable ya los tiene resueltos (rollups/columnas); si la pregunta no da año ni mes, pedile al usuario que aclare cuál.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_project_status",
      description:
        "Estado general de un proyecto: readiness, días para lanzamiento, resumen de tareas y bloqueos.",
      parameters: {
        type: "object",
        properties: {
          project_name: { type: "string", description: "Nombre completo o parcial del proyecto." },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_tasks",
      description: "Tareas no terminadas (no Done/Cancelled/Wont do) de un proyecto.",
      parameters: {
        type: "object",
        properties: { project_name: { type: "string" } },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_blocked_tasks",
      description: "Tareas bloqueadas o marcadas como bloqueante de un proyecto.",
      parameters: {
        type: "object",
        properties: { project_name: { type: "string" } },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_overdue_tasks",
      description: "Tareas de un proyecto cuyo deadline ya pasó y siguen sin terminar.",
      parameters: {
        type: "object",
        properties: { project_name: { type: "string" } },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_deadlines",
      description: "Próximos deadlines (ordenados) de las tareas abiertas de un proyecto.",
      parameters: {
        type: "object",
        properties: { project_name: { type: "string" } },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_projects",
      description:
        "Busca proyectos por nombre parcial. Usala cuando no estés seguro de a qué proyecto se refiere el usuario. Cada resultado incluye startDate (Fecha Inicio real del evento).",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_upcoming_projects",
      description:
        "Lista de proyectos próximos a lanzar/iniciar, ordenados por días para lanzamiento. Cada item incluye startDate (Fecha Inicio real del evento). Usala para preguntas como '¿cuál es el próximo proyecto en iniciar/empezar?', '¿qué fecha de inicio tiene X?' o '¿qué eventos vienen?'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects_at_risk",
      description: "Lista de proyectos cuyo Estado General en Airtable indica riesgo.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "find_task",
      description:
        "Busca una o más tareas por nombre parcial dentro de un proyecto y devuelve, entre otros datos, quién es responsable ('responsible': área/equipo) y quién la tiene asignada ('owners': persona(s) puntuales). Usala para responder quién es responsable/dueño de una tarea.",
      parameters: {
        type: "object",
        properties: {
          project_name: { type: "string", description: "Nombre completo o parcial del proyecto." },
          task_query: { type: "string", description: "Nombre completo o parcial de la tarea." },
        },
        required: ["project_name", "task_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_feeds_capacity",
      description:
        "Pico de Feeds 24/7 simultáneos en un año calendario (capacidad máxima real, no una suma de proyectos que se solapan). Usala para '¿cuál es la capacidad de feeds en <año>?' o '¿cuántos feeds simultáneos hay en <año>?'.",
      parameters: {
        type: "object",
        properties: { year: { type: "number", description: "Año, ej. 2026." } },
        required: ["year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_feeds_active_in_month",
      description:
        "Lista de proyectos/feeds 24/7 activos en un mes puntual (ej. 'octubre 2026'). Usala para '¿qué feeds están activos en <mes>?'.",
      parameters: {
        type: "object",
        properties: {
          month_query: { type: "string", description: "Mes y año en texto libre, ej. 'octubre 2026'." },
        },
        required: ["month_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_standalones_totals_by_year",
      description:
        "Total de eventos standalone en un año (suma de todos los meses, coincide con el TOTAL del Excel original) y cantidad de shows/proyectos distintos ese año. Usala para '¿cuántos standalones hay en <año>?'.",
      parameters: {
        type: "object",
        properties: { year: { type: "number", description: "Año, ej. 2026." } },
        required: ["year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_standalones_totals_by_month",
      description: "Total de eventos standalone en un mes puntual (ej. 'junio 2026').",
      parameters: {
        type: "object",
        properties: {
          month_query: { type: "string", description: "Mes y año en texto libre, ej. 'junio 2026'." },
        },
        required: ["month_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_standalones_active_in_month",
      description:
        "Lista de shows/eventos standalone activos en un mes puntual, con su cantidad de eventos ese mes. Usala para '¿qué standalones están activos en <mes>?'.",
      parameters: {
        type: "object",
        properties: {
          month_query: { type: "string", description: "Mes y año en texto libre, ej. 'junio 2026'." },
        },
        required: ["month_query"],
      },
    },
  },
];

interface GroqToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const projectName = () => String(args.project_name ?? "");
  switch (name) {
    case "get_project_status":
      return getProjectStatusTool(projectName());
    case "get_pending_tasks":
      return getPendingTasksTool(projectName());
    case "get_blocked_tasks":
      return getBlockedTasksTool(projectName());
    case "get_overdue_tasks":
      return getOverdueTasksTool(projectName());
    case "get_project_deadlines":
      return getProjectDeadlinesTool(projectName());
    case "search_projects":
      return searchProjectsTool(String(args.query ?? ""));
    case "list_upcoming_projects":
      return listUpcomingProjectsTool();
    case "list_projects_at_risk":
      return listProjectsAtRiskTool();
    case "find_task":
      return findTaskTool(projectName(), String(args.task_query ?? ""));
    case "get_feeds_capacity":
      return getFeedsCapacityTool(Number(args.year));
    case "list_feeds_active_in_month":
      return listFeedsActiveInMonthTool(String(args.month_query ?? ""));
    case "get_standalones_totals_by_year":
      return getStandalonesTotalsByYearTool(Number(args.year));
    case "get_standalones_totals_by_month":
      return getStandalonesTotalsByMonthTool(String(args.month_query ?? ""));
    case "list_standalones_active_in_month":
      return listStandalonesActiveInMonthTool(String(args.month_query ?? ""));
    default:
      return { ok: false, reason: "not_found", message: `Tool desconocida: ${name}` };
  }
}

export interface GroqChatResult {
  reply: string;
  matches?: unknown;
  status?: unknown;
  list?: ListPayload;
}

/**
 * Builds the same structured list payload the rule-based parser uses,
 * from a tool's raw result — so the UI renders identical cards regardless
 * of which path (Groq or rule-based) answered the question.
 */
function buildListPayload(
  toolName: string,
  projectName: string,
  result: unknown
): ListPayload | undefined {
  const r = result as { ok?: boolean; tasks?: unknown[]; projects?: unknown[] };
  if (!r?.ok) return undefined;
  switch (toolName) {
    case "get_pending_tasks":
      return r.tasks && r.tasks.length > 0
        ? tasksToListPayload(r.tasks as never, `Pendientes en ${projectName}`)
        : undefined;
    case "get_blocked_tasks":
      return r.tasks && r.tasks.length > 0
        ? tasksToListPayload(r.tasks as never, `Bloqueadas en ${projectName}`)
        : undefined;
    case "get_overdue_tasks":
      return r.tasks && r.tasks.length > 0
        ? tasksToListPayload(r.tasks as never, `Vencidas en ${projectName}`)
        : undefined;
    case "get_project_deadlines":
      return r.tasks && r.tasks.length > 0
        ? tasksToListPayload(r.tasks as never, `Deadlines en ${projectName}`)
        : undefined;
    case "list_upcoming_projects":
      return r.projects && r.projects.length > 0 ? upcomingToListPayload(r.projects as never) : undefined;
    case "list_projects_at_risk":
      return r.projects && r.projects.length > 0 ? atRiskToListPayload(r.projects as never) : undefined;
    case "list_feeds_active_in_month": {
      const rr = result as { ok?: boolean; projects?: unknown[] };
      return rr?.ok && rr.projects && rr.projects.length > 0
        ? feedsActiveToListPayload(rr.projects as never, "Feeds activos")
        : undefined;
    }
    case "list_standalones_active_in_month": {
      const rr = result as { ok?: boolean; events?: unknown[] };
      return rr?.ok && rr.events && rr.events.length > 0
        ? standalonesActiveToListPayload(rr.events as never, "Standalones activos")
        : undefined;
    }
    default:
      return undefined;
  }
}

/** Runs the tool-calling loop against Groq. Throws on any failure — callers should catch and fall back. */
export async function runGroqChat(
  history: { role: "user" | "assistant"; content: string }[]
): Promise<GroqChatResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY no está configurada.");
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const messages: GroqMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  let lastMatches: unknown;
  // Tracks the most recent full project status fetched via get_project_status,
  // so the UI can render the rich project card instead of just chat text.
  let lastStatus: unknown;
  // Tracks the most recent list-type tool result (see buildListPayload), so
  // the UI can render structured cards instead of trusting Groq's text.
  let lastList: ListPayload | undefined;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Groq respondió ${res.status}: ${text.slice(0, 200)}`);
    }

    const body = await res.json();
    const message = body.choices?.[0]?.message as
      | { content: string | null; tool_calls?: GroqToolCall[] }
      | undefined;
    if (!message) {
      throw new Error("Respuesta de Groq sin mensaje.");
    }

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return { reply: message.content ?? "", matches: lastMatches, status: lastStatus, list: lastList };
    }

    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: toolCalls });

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // Leave args empty — the tool itself will surface a not_found/
        // ambiguous-style result rather than throwing.
      }
      const result = await callTool(call.function.name, args);
      if ((result as { reason?: string })?.reason === "ambiguous") {
        lastMatches = (result as { matches?: unknown }).matches;
      }
      if (call.function.name === "get_project_status" && (result as { ok?: boolean })?.ok) {
        lastStatus = (result as { status?: unknown }).status;
      }
      const listPayload = buildListPayload(call.function.name, String(args.project_name ?? ""), result);
      if (listPayload) lastList = listPayload;
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("Se alcanzó el límite de pasos de Groq sin una respuesta final.");
}
