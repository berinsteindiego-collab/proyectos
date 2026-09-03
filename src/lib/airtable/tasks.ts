import { getRecordsByIds, type AirtableRecord } from "./client";
import { EVENT_FIELDS, TAREAS_TABLE } from "./fields";

/**
 * Resolve an event's linked Tareas records.
 *
 * Per docs/AIRTABLE_SCHEMA.md and docs/TECHNICAL_CONTEXT.md, ARRAYJOIN({Evento})
 * filtering returned zero records during connectivity testing. The robust
 * strategy is to use the linked task record IDs already present on
 * Eventos.Tareas and resolve those records directly by ID.
 */
export async function getTasksForEvent(
  event: AirtableRecord
): Promise<AirtableRecord[]> {
  const linkedIds = (event.fields[EVENT_FIELDS.tasks] as string[] | undefined) ?? [];
  if (linkedIds.length === 0) return [];
  return getRecordsByIds(TAREAS_TABLE, linkedIds);
}
