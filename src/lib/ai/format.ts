// Shared list-card builders for /api/ask, used by BOTH the rule-based parser
// (route.ts) and the Groq path (groq.ts) so a given list-type question always
// renders the same structured cards, regardless of which path answered it.
// This is deliberate: we don't trust Groq's raw markdown text for
// formatting — the backend builds the HTML-ready structure itself from the
// same Airtable-sourced task/project data either path already has.
import type {
  ListCardItem,
  ListPayload,
  ProjectSearchResult,
  ProjectTask,
  UrgencyTone,
} from "@/lib/project-status/types";
import type { FeedsActiveProject, StandalonesActiveEvent } from "@/lib/ops/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function taskBadge(task: ProjectTask): { label: string; tone: UrgencyTone } {
  if (task.status === "Blocked" || task.isBlocker) {
    return { label: task.overdueBlocker ? "Bloqueante vencido" : "Bloqueante", tone: "red" };
  }
  if (task.deadline && task.deadline < today()) {
    return { label: "Vencida", tone: "red" };
  }
  if (task.deadline && task.deadline <= addDays(7)) {
    return { label: "Esta semana", tone: "amber" };
  }
  return { label: task.status, tone: "slate" };
}

function taskToItem(task: ProjectTask): ListCardItem {
  const meta: string[] = [];
  if (task.deadline) meta.push(`Deadline ${task.deadline}`);
  if (task.responsible) meta.push(task.responsible);
  if (task.owners && task.owners.length > 0) meta.push(task.owners.join(", "));
  return {
    id: task.id,
    title: task.name,
    subtitle: task.status,
    badge: taskBadge(task),
    meta,
  };
}

/** Generic task-list payload used for pending/blocked/overdue/deadline answers. */
export function tasksToListPayload(tasks: ProjectTask[], heading: string): ListPayload {
  return { heading, items: tasks.map(taskToItem) };
}

function upcomingBadge(p: ProjectSearchResult): { label: string; tone: UrgencyTone } {
  const days = p.daysToLaunch;
  if (days == null) return { label: "Sin fecha", tone: "slate" };
  if (days <= 7) return { label: `${days} días`, tone: "amber" };
  return { label: `${days} días`, tone: "blue" };
}

export function upcomingToListPayload(projects: ProjectSearchResult[]): ListPayload {
  return {
    heading: "Próximos en iniciar",
    items: projects.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: p.startDate ? `Inicia ${p.startDate}` : "Sin fecha de inicio",
      badge: upcomingBadge(p),
    })),
  };
}

export function atRiskToListPayload(projects: ProjectSearchResult[]): ListPayload {
  return {
    heading: "Proyectos en riesgo",
    items: projects.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: p.readiness != null ? `Launch Readiness ${p.readiness}%` : undefined,
      badge: { label: p.status ?? "En riesgo", tone: "red" as UrgencyTone },
    })),
  };
}

// --- Phase 3: Feeds Roll Out / Standalones ---
// Same card shape as the project/task lists above, built directly from
// Airtable-sourced data so the UI renders identical cards regardless of
// which path (rule-based or Groq) answered the question.

export function feedsActiveToListPayload(projects: FeedsActiveProject[], heading: string): ListPayload {
  return {
    heading,
    items: projects.map((p) => ({
      id: p.id,
      title: p.project,
      subtitle: [p.country, p.type].filter(Boolean).join(" · ") || undefined,
      badge: { label: `${p.qFeeds} feeds`, tone: "blue" as UrgencyTone },
      meta: [p.status, p.adHoc].filter((v): v is string => !!v),
    })),
  };
}

export function standalonesActiveToListPayload(
  events: StandalonesActiveEvent[],
  heading: string
): ListPayload {
  return {
    heading,
    items: events.map((e) => ({
      id: e.id,
      title: e.eventName,
      subtitle: e.reference,
      badge: { label: `${e.events} eventos`, tone: "blue" as UrgencyTone },
      meta: [e.type].filter((v): v is string => !!v),
    })),
  };
}
