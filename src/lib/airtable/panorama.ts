import { listRecords, isMockMode } from "./client";
import { EVENTOS_TABLE, EVENT_FIELDS, TAREAS_TABLE, TASK_FIELDS } from "./fields";
import { listUpcomingProjects } from "./projects";

export interface PanoramaData {
  activeProjects: number;
  upcomingProjects: Awaited<ReturnType<typeof listUpcomingProjects>>;
  projectsAtRisk: number;
  openBlockers: number;
  upcomingDeadlines: number;
}

const INACTIVE_PROJECTS = ["done", "completed", "cancelled", "wont do", "closed", "finalizado", "finalizada"];
const CLOSED_TASKS = ["done", "cancelled", "wont do"];

function looksActive(status?: string): boolean {
  if (!status) return false;
  const value = status.toLowerCase();
  return !INACTIVE_PROJECTS.some((word) => value.includes(word));
}

function isAtRisk(status?: string): boolean {
  if (!status) return false;
  const value = status.toLowerCase();
  return value.includes("risk") || value.includes("riesgo");
}

function taskIsOpen(status?: string): boolean {
  if (!status) return true;
  const value = status.toLowerCase();
  return !CLOSED_TASKS.some((word) => value === word || value.includes(word));
}

function isWithinNextDays(dateValue: unknown, days: number): boolean {
  if (typeof dateValue !== "string" || !dateValue) return false;
  const deadline = new Date(dateValue);
  if (Number.isNaN(deadline.getTime())) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(today);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);

  return deadline >= today && deadline <= end;
}

export async function getPanorama(): Promise<PanoramaData> {
  const upcomingPromise = listUpcomingProjects(4);

  if (isMockMode()) {
    const upcomingProjects = await upcomingPromise;
    return {
      activeProjects: 0,
      upcomingProjects,
      projectsAtRisk: 0,
      openBlockers: 0,
      upcomingDeadlines: 0,
    };
  }

  const [events, tasks, upcomingProjects] = await Promise.all([
    listRecords(EVENTOS_TABLE),
    listRecords(TAREAS_TABLE),
    upcomingPromise,
  ]);

  const activeProjects = events.filter((event) =>
    looksActive(event.fields[EVENT_FIELDS.status] as string | undefined)
  ).length;

  const projectsAtRisk = events.filter((event) =>
    isAtRisk(event.fields[EVENT_FIELDS.status] as string | undefined)
  ).length;

  const openBlockers = tasks.filter((task) => {
    const status = task.fields[TASK_FIELDS.status] as string | undefined;
    const blockerValue = task.fields[TASK_FIELDS.openBlocker];
    return taskIsOpen(status) && (blockerValue === 1 || blockerValue === true);
  }).length;

  const upcomingDeadlines = tasks.filter((task) => {
    const status = task.fields[TASK_FIELDS.status] as string | undefined;
    return taskIsOpen(status) && isWithinNextDays(task.fields[TASK_FIELDS.deadline], 7);
  }).length;

  return {
    activeProjects,
    upcomingProjects,
    projectsAtRisk,
    openBlockers,
    upcomingDeadlines,
  };
}
