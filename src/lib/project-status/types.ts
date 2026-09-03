// Domain types for Project Control V1.
// These mirror the normalized shape defined in docs/TECHNICAL_CONTEXT.md (#8)
// and docs/PROJECT_CONTEXT.md (#6). Airtable remains the source of truth for
// every value here — nothing in this file recomputes Airtable formulas.

export type TaskStatus =
  | "Not Started"
  | "In Progress"
  | "Waiting"
  | "Blocked"
  | "Done"
  | "Cancelled"
  | "Wont do";

export const TERMINAL_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set([
  "Done",
  "Cancelled",
  "Wont do",
]);

export interface ProjectTask {
  id: string;
  name: string;
  status: TaskStatus | string; // preserve exact Airtable label even if unrecognized
  deadline?: string | null;
  isBlocker?: boolean;
  priority?: string | null;
  comments?: string | null;
  daysRemaining?: number | null;
  risk?: string | null;
  dependsOn?: string[];
  openBlocker?: boolean;
  overdueBlocker?: boolean;
  completed?: boolean;
  responsible?: string | null; // "Responsable" in Airtable — the responsible area/team (e.g. "Programming")
  owners?: string[]; // "Owner" in Airtable — individual person(s) assigned, by display name
}

export interface ProjectStatus {
  project: {
    id: string;
    name: string;
    category?: string;
    format?: string;
    region?: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: string;
    readiness?: number | null;
    daysToLaunch?: number | null;
    description?: string;
  };
  summary: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    openBlockers?: number;
    overdueBlockers?: number;
  };
  tasks: ProjectTask[];
}

export class ProjectNotFoundError extends Error {
  constructor(projectName: string) {
    super(`Project "${projectName}" was not found in Airtable (Eventos).`);
    this.name = "ProjectNotFoundError";
  }
}

export interface ProjectSearchResult {
  id: string;
  name: string;
  status?: string;
  readiness?: number | null;
  daysToLaunch?: number | null;
  startDate?: string | null;
}

/** Thrown when a fuzzy project search matches more than one event. */
export class AmbiguousProjectError extends Error {
  matches: ProjectSearchResult[];
  constructor(query: string, matches: ProjectSearchResult[]) {
    super(
      `"${query}" matches more than one project: ${matches
        .map((m) => m.name)
        .join(", ")}`
    );
    this.name = "AmbiguousProjectError";
    this.matches = matches;
  }
}

// Structured list payload for chat answers that list several projects/tasks
// (upcoming, at-risk, pending, blocked, overdue, deadlines). The backend
// builds this directly from Airtable-sourced data — both the rule-based
// parser and the Groq path use the same builders (src/lib/ai/format.ts) — so
// the UI never has to parse or trust free-form markdown text for these.
export type UrgencyTone = "green" | "amber" | "red" | "blue" | "slate";

export interface ListCardItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: UrgencyTone };
  meta?: string[];
}

export interface ListPayload {
  heading: string;
  items: ListCardItem[];
}
