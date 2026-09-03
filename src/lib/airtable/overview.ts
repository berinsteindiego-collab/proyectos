// Backs the home-screen "Novedades" panel — a place Diego can see important
// things without having to ask the chat first (at-risk projects, overdue
// tasks, deadlines coming up this week). Built entirely from Airtable fields
// already used elsewhere (Estado General, task Deadline, Bloqueante) — two
// bulk reads (Eventos + Tareas) instead of one Airtable call per project.
import { listRecords, isMockMode } from "./client";
import { EVENT_FIELDS, TAREAS_TABLE, EVENTOS_TABLE } from "./fields";
import { normalizeTask } from "../project-status/normalize";
import { TERMINAL_TASK_STATUSES, type ProjectTask } from "../project-status/types";
import { MOCK_PROJECTS } from "./mock-data";

export interface OverviewTaskAlert {
  task: ProjectTask;
  projectName: string;
  projectId: string;
}

export interface OverviewAtRiskProject {
  id: string;
  name: string;
  status?: string;
  readiness?: number | null;
}

export interface OverviewAlerts {
  atRisk: OverviewAtRiskProject[];
  overdueTasks: OverviewTaskAlert[];
  upcomingDeadlines: OverviewTaskAlert[];
}

function isRiskStatus(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("risk") || s.includes("riesgo");
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildMockOverview(): OverviewAlerts {
  const today = new Date().toISOString().slice(0, 10);
  const soon = addDays(7);
  const atRisk: OverviewAtRiskProject[] = [];
  const overdueTasks: OverviewTaskAlert[] = [];
  const upcomingDeadlines: OverviewTaskAlert[] = [];

  for (const p of Object.values(MOCK_PROJECTS)) {
    if (isRiskStatus(p.project.status)) {
      atRisk.push({ id: p.project.id, name: p.project.name, status: p.project.status, readiness: p.project.readiness });
    }
    for (const task of p.tasks) {
      if (TERMINAL_TASK_STATUSES.has(task.status as never) || !task.deadline) continue;
      const alert: OverviewTaskAlert = { task, projectName: p.project.name, projectId: p.project.id };
      if (task.deadline < today) overdueTasks.push(alert);
      else if (task.deadline <= soon) upcomingDeadlines.push(alert);
    }
  }

  return { atRisk, overdueTasks, upcomingDeadlines };
}

/**
 * Cross-project alerts for the home screen: at-risk projects, overdue tasks,
 * and deadlines due within the next 7 days. Two bulk Airtable reads
 * (Eventos + Tareas), joined in JS via each event's linked task IDs —
 * avoids one Airtable call per project.
 */
export async function getOverviewAlerts(): Promise<OverviewAlerts> {
  if (isMockMode()) {
    return buildMockOverview();
  }

  const [events, allTasks] = await Promise.all([listRecords(EVENTOS_TABLE), listRecords(TAREAS_TABLE)]);
  const taskById = new Map(allTasks.map((t) => [t.id, t]));

  const today = new Date().toISOString().slice(0, 10);
  const soon = addDays(7);

  const atRisk: OverviewAtRiskProject[] = events
    .filter((e) => isRiskStatus(e.fields[EVENT_FIELDS.status] as string | undefined))
    .map((e) => ({
      id: e.id,
      name: (e.fields[EVENT_FIELDS.name] as string) ?? "(sin nombre)",
      status: e.fields[EVENT_FIELDS.status] as string | undefined,
      readiness: (e.fields[EVENT_FIELDS.readiness] as number | undefined) ?? null,
    }));

  const overdueTasks: OverviewTaskAlert[] = [];
  const upcomingDeadlines: OverviewTaskAlert[] = [];

  for (const event of events) {
    const linkedIds = (event.fields[EVENT_FIELDS.tasks] as string[] | undefined) ?? [];
    if (linkedIds.length === 0) continue;
    const projectName = (event.fields[EVENT_FIELDS.name] as string) ?? "(sin nombre)";

    for (const id of linkedIds) {
      const rec = taskById.get(id);
      if (!rec) continue;
      const task = normalizeTask(rec);
      if (TERMINAL_TASK_STATUSES.has(task.status as never) || !task.deadline) continue;

      const alert: OverviewTaskAlert = { task, projectName, projectId: event.id };
      if (task.deadline < today) overdueTasks.push(alert);
      else if (task.deadline <= soon) upcomingDeadlines.push(alert);
    }
  }

  overdueTasks.sort((a, b) => (a.task.deadline! < b.task.deadline! ? -1 : 1));
  upcomingDeadlines.sort((a, b) => (a.task.deadline! < b.task.deadline! ? -1 : 1));

  return {
    atRisk: atRisk.slice(0, 8),
    overdueTasks: overdueTasks.slice(0, 8),
    upcomingDeadlines: upcomingDeadlines.slice(0, 8),
  };
}
