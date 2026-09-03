import { listRecords, isMockMode, type AirtableRecord } from "./client";
import { EVENT_FIELDS, EVENTOS_TABLE } from "./fields";
import { getTasksForEvent } from "./tasks";
import { normalizeProject } from "../project-status/normalize";
import { searchMockProjects, findMockProjectById, listMockUpcoming } from "./mock-data";
import {
  AmbiguousProjectError,
  ProjectNotFoundError,
  type ProjectSearchResult,
  type ProjectStatus,
} from "../project-status/types";

function toSearchResult(record: AirtableRecord): ProjectSearchResult {
  const f = record.fields;
  return {
    id: record.id,
    name: (f[EVENT_FIELDS.name] as string) ?? "(sin nombre)",
    status: f[EVENT_FIELDS.status] as string | undefined,
    readiness: (f[EVENT_FIELDS.readiness] as number | undefined) ?? null,
    daysToLaunch: (f[EVENT_FIELDS.daysToLaunch] as number | undefined) ?? null,
    startDate: (f[EVENT_FIELDS.startDate] as string | undefined) ?? null,
  };
}

/**
 * Case/accent-insensitive normalization, so "telefe" matches "Telefé" and
 * vice versa. Airtable's own LOWER() formula only folds case, not accents,
 * which is why filtering happens here in JS instead of via filterByFormula.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Fuzzy, case/accent-insensitive "contains" search over Nombre Evento.
 * Used both by the search box (partial names) and by the chat assistant
 * to disambiguate before committing to a single project.
 */
export async function searchProjects(
  query: string,
  limit = 5
): Promise<ProjectSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (isMockMode()) {
    return searchMockProjects(trimmed).slice(0, limit);
  }

  const q = normalize(trimmed);
  const records = await listRecords(EVENTOS_TABLE);
  return records
    .map(toSearchResult)
    .filter((p) => normalize(p.name).includes(q))
    .slice(0, limit);
}

/**
 * Phase 1 core function, extended for fuzzy names: finds a project in
 * Eventos whose Nombre Evento contains `projectName` (case/accent
 * insensitive). Resolves its linked Tareas and returns a normalized
 * ProjectStatus. Does not call an AI model. Does not recompute
 * Airtable-owned formulas.
 *
 * Throws ProjectNotFoundError when there are no matches, and
 * AmbiguousProjectError (with the candidate list) when there is more
 * than one match — callers should surface those candidates rather than
 * silently guessing.
 */
export async function getProjectStatus(projectName: string): Promise<ProjectStatus> {
  const trimmed = projectName.trim();
  if (!trimmed) {
    throw new ProjectNotFoundError(projectName);
  }

  if (isMockMode()) {
    const candidates = searchMockProjects(trimmed);
    if (candidates.length === 0) throw new ProjectNotFoundError(projectName);
    if (candidates.length > 1) throw new AmbiguousProjectError(projectName, candidates);
    const mock = findMockProjectById(candidates[0].id);
    if (!mock) throw new ProjectNotFoundError(projectName);
    return mock;
  }

  const q = normalize(trimmed);
  const allRecords = await listRecords(EVENTOS_TABLE);
  const matches = allRecords.filter((m) =>
    normalize((m.fields[EVENT_FIELDS.name] as string) ?? "").includes(q)
  );

  if (matches.length === 0) {
    throw new ProjectNotFoundError(projectName);
  }
  if (matches.length > 1) {
    // Exact match wins even when other projects also contain the string.
    const exact = matches.find(
      (m) => normalize((m.fields[EVENT_FIELDS.name] as string) ?? "") === q
    );
    if (!exact) {
      throw new AmbiguousProjectError(projectName, matches.map(toSearchResult));
    }
  }

  const event =
    matches.find(
      (m) => normalize((m.fields[EVENT_FIELDS.name] as string) ?? "") === q
    ) ?? matches[0];

  const tasks = await getTasksForEvent(event);
  return normalizeProject(event, tasks);
}

/** Fetches a ProjectStatus directly by Airtable record ID (used to resolve a chosen search result). */
export async function getProjectStatusById(recordId: string): Promise<ProjectStatus> {
  if (isMockMode()) {
    const mock = findMockProjectById(recordId);
    if (!mock) throw new ProjectNotFoundError(recordId);
    return mock;
  }
  const matches = await listRecords(EVENTOS_TABLE, {
    filterByFormula: `RECORD_ID() = "${recordId}"`,
    maxRecords: 1,
  });
  const event = matches[0];
  if (!event) throw new ProjectNotFoundError(recordId);
  const tasks = await getTasksForEvent(event);
  return normalizeProject(event, tasks);
}

/**
 * Lists upcoming projects sorted by "Días para lanzamiento" ascending, for
 * questions like "¿qué eventos vienen?". Reads Airtable's own countdown
 * field rather than recomputing it.
 */
export async function listUpcomingProjects(limit = 10): Promise<ProjectSearchResult[]> {
  if (isMockMode()) {
    return listMockUpcoming().slice(0, limit);
  }

  const records = await listRecords(EVENTOS_TABLE);
  return records
    .map(toSearchResult)
    .filter((p) => p.daysToLaunch != null)
    .sort((a, b) => (a.daysToLaunch ?? 0) - (b.daysToLaunch ?? 0))
    .slice(0, limit);
}

/**
 * Lists events for lightweight home-screen views (active / at risk / launching soon).
 * Returns raw records; UI-level filtering by Estado General / Días para lanzamiento
 * should read Airtable's own values rather than recompute them.
 */
export async function listAllEvents(): Promise<AirtableRecord[]> {
  if (isMockMode()) return [];
  return listRecords(EVENTOS_TABLE);
}

/** True if an Estado General value reads as "at risk", in either language. */
function isRiskStatus(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("risk") || s.includes("riesgo");
}

/**
 * Projects whose Estado General reads as "at risk" (reads Airtable's own
 * status field as-is; does not infer risk from readiness/deadlines).
 */
export async function listProjectsAtRisk(limit = 10): Promise<ProjectSearchResult[]> {
  if (isMockMode()) {
    return listMockUpcoming()
      .filter((p) => isRiskStatus(p.status))
      .slice(0, limit);
  }

  const records = await listRecords(EVENTOS_TABLE);
  return records
    .map(toSearchResult)
    .filter((p) => isRiskStatus(p.status))
    .slice(0, limit);
}
