// Read-only data functions backing /api/ask (see src/app/api/ask/route.ts),
// a rule-based question parser — no external AI provider involved.
// Per docs/PROJECT_CONTEXT.md #11:
// - Airtable is the source of truth; nothing here invents or recomputes a
//   value Airtable already owns (status, readiness, blocker counts, etc.).
// - Never expose the Airtable PAT.
// - Preserve exact task status strings (see project-status/types.ts).
// - Read-only: no write tools are exposed here.

import {
  getProjectStatus,
  searchProjects,
  listUpcomingProjects,
  listProjectsAtRisk,
  listPortfolioStatusByCategory,
} from "../airtable/projects";
import {
  getFeedsCapacityByYear,
  listFeedsActiveInMonth,
  FeedsPeriodNotFoundError,
} from "../airtable/feeds";
import {
  getStandalonesTotalsByYear,
  getStandalonesTotalsByMonth,
  listStandalonesActiveInMonth,
  StandalonesPeriodNotFoundError,
} from "../airtable/standalones";
import {
  AmbiguousProjectError,
  ProjectNotFoundError,
  TERMINAL_TASK_STATUSES,
  type ProjectTask,
} from "../project-status/types";

// Every tool below returns a plain JSON-serializable object, never throws.
// This lets the /api/ask tool-use loop always feed the result straight back
// to the model as a tool_result, and the system prompt tells the model what
// to do with an "ambiguous" or "not_found" status (ask the user, don't guess).
type ToolResult<T> =
  | ({ ok: true } & T)
  | { ok: false; reason: "not_found" | "ambiguous"; message: string; matches?: unknown };

async function withProjectLookup<T>(
  projectName: string,
  fn: (status: Awaited<ReturnType<typeof getProjectStatus>>) => T
): Promise<ToolResult<T extends object ? T : { value: T }>> {
  try {
    const status = await getProjectStatus(projectName);
    const result = fn(status);
    return { ok: true, ...(result as object) } as ToolResult<T extends object ? T : { value: T }>;
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return { ok: false, reason: "not_found", message: err.message };
    }
    if (err instanceof AmbiguousProjectError) {
      return { ok: false, reason: "ambiguous", message: err.message, matches: err.matches };
    }
    throw err;
  }
}

export async function getProjectStatusTool(projectName: string) {
  return withProjectLookup(projectName, (status) => ({ status }));
}

export async function getPendingTasksTool(projectName: string) {
  return withProjectLookup(projectName, (status) => ({
    tasks: status.tasks.filter(
      (t) => !TERMINAL_TASK_STATUSES.has(t.status as never)
    ) as ProjectTask[],
  }));
}

export async function getBlockedTasksTool(projectName: string) {
  return withProjectLookup(projectName, (status) => ({
    tasks: status.tasks.filter((t) => t.status === "Blocked" || t.isBlocker) as ProjectTask[],
  }));
}

export async function getProjectDeadlinesTool(projectName: string) {
  return withProjectLookup(projectName, (status) => ({
    tasks: status.tasks
      .filter((t) => !!t.deadline && !TERMINAL_TASK_STATUSES.has(t.status as never))
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)) as ProjectTask[],
  }));
}

export async function getOverdueTasksTool(projectName: string) {
  const today = new Date().toISOString().slice(0, 10);
  return withProjectLookup(projectName, (status) => ({
    tasks: status.tasks.filter(
      (t) =>
        !!t.deadline &&
        t.deadline < today &&
        !TERMINAL_TASK_STATUSES.has(t.status as never)
    ) as ProjectTask[],
  }));
}

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "");
}

/**
 * Fuzzy-finds tasks by (partial) name within a project — use this to answer
 * "who's responsible/owns task X in project Y" style questions. Returns
 * every task whose name contains the query (case/accent-insensitive) so the
 * caller/model can disambiguate if there's more than one.
 */
export async function findTaskTool(projectName: string, taskQuery: string) {
  return withProjectLookup(projectName, (status) => {
    const q = normalizeForMatch(taskQuery);
    const tasks = q
      ? status.tasks.filter((t) => normalizeForMatch(t.name).includes(q))
      : status.tasks;
    return { tasks: tasks as ProjectTask[] };
  });
}

/** Fuzzy/partial name search — use this first when the user's project name might be incomplete. */
export async function searchProjectsTool(query: string) {
  const matches = await searchProjects(query, 8);
  return { ok: true, matches };
}

/** Upcoming projects sorted by days-to-launch — use for "what's coming up" style questions. */
export async function listUpcomingProjectsTool(limit = 10) {
  const projects = await listUpcomingProjects(limit);
  return { ok: true, projects };
}

/** Projects whose Estado General reads as "at risk" — read as-is from Airtable, never inferred. */
export async function listProjectsAtRiskTool(limit = 10) {
  const projects = await listProjectsAtRisk(limit);
  return { ok: true, projects };
}

export async function listPortfolioStatusTool(category: string) {
  const projects = await listPortfolioStatusByCategory(category);
  return { ok: true, category, projects };
}

// --- Phase 3: Feeds Roll Out / Standalones ---
// Same read-only contract as the rest of this file: every function returns
// a plain JSON-serializable object, never throws for an expected "couldn't
// parse the period" case (only for genuine bugs), and never invents a
// number Airtable already computes (peak capacity, monthly event counts).

export async function getFeedsCapacityTool(year: number) {
  const capacity = await getFeedsCapacityByYear(year);
  return { ok: true, capacity };
}

export async function listFeedsActiveInMonthTool(monthQuery: string) {
  try {
    const projects = await listFeedsActiveInMonth(monthQuery);
    return { ok: true as const, projects };
  } catch (err) {
    if (err instanceof FeedsPeriodNotFoundError) {
      return { ok: false as const, reason: "not_found" as const, message: err.message };
    }
    throw err;
  }
}

export async function getStandalonesTotalsByYearTool(year: number) {
  const totals = await getStandalonesTotalsByYear(year);
  return { ok: true, totals };
}

export async function getStandalonesTotalsByMonthTool(monthQuery: string) {
  try {
    const totals = await getStandalonesTotalsByMonth(monthQuery);
    return { ok: true as const, totals };
  } catch (err) {
    if (err instanceof StandalonesPeriodNotFoundError) {
      return { ok: false as const, reason: "not_found" as const, message: err.message };
    }
    throw err;
  }
}

export async function listStandalonesActiveInMonthTool(monthQuery: string) {
  try {
    const events = await listStandalonesActiveInMonth(monthQuery);
    return { ok: true as const, events };
  } catch (err) {
    if (err instanceof StandalonesPeriodNotFoundError) {
      return { ok: false as const, reason: "not_found" as const, message: err.message };
    }
    throw err;
  }
}
