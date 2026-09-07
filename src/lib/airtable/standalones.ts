// Read-only data functions for the "Standalones Events" monthly event-count
// model (Phase 3 — see docs/AIRTABLE_SCHEMA.md #8 and README roadmap).
// The "Events" field on each monthly row already holds the real per-month
// count copied from the source spreadsheet; summing it across a year's rows
// is what reconciles with the spreadsheet's own yearly TOTAL row (verified
// against the live data: 2026 sums to 991, matching the spreadsheet exactly;
// 2027's own TOTAL cell was found to be a stale cached formula — the sum of
// its own monthly cells is 1623, which is what this function returns).
import { listRecords, isMockMode } from "./client";
import {
  STANDALONES_TABLE,
  STANDALONES_FIELDS,
  STANDALONES_MONTHLY_TABLE,
  STANDALONES_MONTHLY_FIELDS,
} from "./fields";
import { monthLabel, parsePeriod } from "../ops/period";
import type {
  StandalonesActiveEvent,
  StandalonesMonthTotal,
  StandalonesYearTotal,
} from "../ops/types";

export class StandalonesPeriodNotFoundError extends Error {
  constructor(query: string) {
    super(`No pude reconocer un año o mes en "${query}".`);
    this.name = "StandalonesPeriodNotFoundError";
  }
}

/**
 * Total standalone events for a calendar year (sum of "Events" across every
 * Monthly Events row whose Month falls in that year), plus how many
 * distinct shows/projects were active that year (Standalones Events.Year).
 */
export async function getStandalonesTotalsByYear(year: number): Promise<StandalonesYearTotal> {
  if (isMockMode()) {
    return { year, totalEvents: 0, distinctShows: 0 };
  }

  const [monthlyRows, eventRows] = await Promise.all([
    listRecords(STANDALONES_MONTHLY_TABLE),
    listRecords(STANDALONES_TABLE, {
      filterByFormula: `{${STANDALONES_FIELDS.year}} = ${year}`,
    }),
  ]);

  const totalEvents = monthlyRows
    .filter((r) => {
      const month = r.fields[STANDALONES_MONTHLY_FIELDS.month] as string | undefined;
      return !!month && month.startsWith(String(year));
    })
    .reduce(
      (sum, r) => sum + ((r.fields[STANDALONES_MONTHLY_FIELDS.events] as number | undefined) ?? 0),
      0
    );

  return { year, totalEvents, distinctShows: eventRows.length };
}

/** Total standalone events for one specific month (free text, e.g. "junio 2026"). */
export async function getStandalonesTotalsByMonth(monthQuery: string): Promise<StandalonesMonthTotal> {
  const { year, monthIndex } = parsePeriod(monthQuery);
  if (year == null || monthIndex == null) {
    throw new StandalonesPeriodNotFoundError(monthQuery);
  }
  const label = monthLabel(year, monthIndex);

  if (isMockMode()) {
    return { month: label, totalEvents: 0 };
  }

  const rows = await listRecords(STANDALONES_MONTHLY_TABLE, {
    filterByFormula: `{${STANDALONES_MONTHLY_FIELDS.mesOrden}} = "${label}"`,
  });
  const totalEvents = rows.reduce(
    (sum, r) => sum + ((r.fields[STANDALONES_MONTHLY_FIELDS.events] as number | undefined) ?? 0),
    0
  );
  return { month: label, totalEvents };
}

/** Which standalone shows/events are active in a specific month, with their event count that month. */
export async function listStandalonesActiveInMonth(monthQuery: string): Promise<StandalonesActiveEvent[]> {
  const { year, monthIndex } = parsePeriod(monthQuery);
  if (year == null || monthIndex == null) {
    throw new StandalonesPeriodNotFoundError(monthQuery);
  }
  const label = monthLabel(year, monthIndex);

  if (isMockMode()) return [];

  const rows = await listRecords(STANDALONES_MONTHLY_TABLE, {
    filterByFormula: `{${STANDALONES_MONTHLY_FIELDS.mesOrden}} = "${label}"`,
  });

  return rows.map((r) => ({
    id: r.id,
    eventName: (r.fields[STANDALONES_MONTHLY_FIELDS.eventName] as string[] | undefined)?.[0] ?? "(sin nombre)",
    type: (r.fields[STANDALONES_MONTHLY_FIELDS.type] as string[] | undefined)?.[0],
    reference: (r.fields[STANDALONES_MONTHLY_FIELDS.reference] as string[] | undefined)?.[0],
    events: (r.fields[STANDALONES_MONTHLY_FIELDS.events] as number | undefined) ?? 0,
  }));
}
