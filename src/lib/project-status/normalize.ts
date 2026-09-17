import type { AirtableRecord } from "../airtable/client";
import { EVENT_FIELDS, TASK_FIELDS } from "../airtable/fields";
import { TERMINAL_TASK_STATUSES, type ProjectStatus, type ProjectTask } from "./types";

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Airtable's "Launch Readiness" is a Percent-type field: its API value is
 * the raw fraction (e.g. 0.9032258064516129 for 90%), not the number shown
 * in the Airtable UI. Converts it to a whole-number percentage for display,
 * without changing what the field actually measures.
 */
export function toReadinessPercent(value: unknown): number | undefined {
  const n = num(value);
  if (n == null) return undefined;
  return Math.round(n * 100);
}

/**
 * "Owner" in Airtable is a Collaborator-field array (`{ id, email, name }`
 * per person, possibly empty/absent). Only the display name is surfaced —
 * emails/ids aren't needed in chat answers.
 */
function ownerNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (v && typeof v === "object" && "name" in v ? String((v as { name: unknown }).name) : null))
    .filter((n): n is string => !!n);
}

export function normalizeTask(record: AirtableRecord): ProjectTask {
  const f = record.fields;
  const dependsOn = f[TASK_FIELDS.dependsOn];
  return {
    id: record.id,
    name: str(f[TASK_FIELDS.name]) ?? "(sin nombre)",
    status: str(f[TASK_FIELDS.status]) ?? "Not Started",
    deadline: str(f[TASK_FIELDS.deadline]) ?? null,
    isBlocker: bool(f[TASK_FIELDS.isBlocker]),
    priority: str(f[TASK_FIELDS.priority]) ?? null,
    comments: str(f[TASK_FIELDS.comments]) ?? null,
    daysRemaining: num(f[TASK_FIELDS.daysRemaining]) ?? null,
    risk: str(f[TASK_FIELDS.risk]) ?? null,
    dependsOn: Array.isArray(dependsOn) ? (dependsOn as string[]) : [],
    openBlocker: bool(f[TASK_FIELDS.openBlocker]),
    overdueBlocker: bool(f[TASK_FIELDS.overdueBlocker]),
    completed: bool(f[TASK_FIELDS.completed]),
    responsible: str(f[TASK_FIELDS.responsible]) ?? null,
    owners: ownerNames(f[TASK_FIELDS.owner]),
  };
}

/**
 * Builds the normalized ProjectStatus object. Values that Airtable already
 * computes (Launch Readiness, Estado General, Días para lanzamiento, blocker
 * counts) are read as-is, never recalculated here. `pendingTasks` is the one
 * derived field, computed only because Airtable does not expose it directly.
 */
export function normalizeProject(
  event: AirtableRecord,
  taskRecords: AirtableRecord[]
): ProjectStatus {
  const f = event.fields;
  const tasks = taskRecords.map(normalizeTask);

  const totalTasks = num(f[EVENT_FIELDS.totalTasks]) ?? tasks.length;
  const completedTasks =
    num(f[EVENT_FIELDS.completedTasks]) ?? tasks.filter((t) => t.completed).length;

  return {
    project: {
      id: event.id,
      name: str(f[EVENT_FIELDS.name]) ?? "(sin nombre)",
      category: str(f[EVENT_FIELDS.category]),
      format: str(f[EVENT_FIELDS.format]),
      region: str(f[EVENT_FIELDS.region]),
      startDate: str(f[EVENT_FIELDS.startDate]) ?? null,
      endDate: str(f[EVENT_FIELDS.endDate]) ?? null,
      status: str(f[EVENT_FIELDS.status]),
      readiness: toReadinessPercent(f[EVENT_FIELDS.readiness]) ?? null,
      daysToLaunch: num(f[EVENT_FIELDS.daysToLaunch]) ?? null,
      description: str(f[EVENT_FIELDS.description]),
    },
    summary: {
      totalTasks,
      completedTasks,
      // Counts genuinely open work only: excludes Done AND terminal
      // non-work statuses (Cancelled, Wont do), so those don't inflate
      // "pending" the way a plain totalTasks - completedTasks would.
      pendingTasks: tasks.filter((t) => !TERMINAL_TASK_STATUSES.has(t.status as never)).length,
      openBlockers: num(f[EVENT_FIELDS.openBlockers]),
      overdueBlockers: num(f[EVENT_FIELDS.overdueBlockers]),
    },
    tasks,
  };
}
