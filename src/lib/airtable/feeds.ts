// Read-only data functions for the "Feeds Roll Out" 24/7 capacity model
// (Phase 3 — see docs/AIRTABLE_SCHEMA.md #7 and README roadmap).
// Mirrors the rules in projects.ts: Airtable owns every number here (the
// "Total Feeds del Mes" rollup on Meses, the "Feeds" formula on the Monthly
// Usage junction) — this file only reads and filters, never recomputes.
import { listRecords, isMockMode } from "./client";
import {
  FEEDS_MONTHLY_TABLE,
  FEEDS_MONTHLY_FIELDS,
  MESES_TABLE,
  MESES_FIELDS,
} from "./fields";
import { monthLabel, parsePeriod } from "../ops/period";
import type { FeedsActiveProject, FeedsCapacityYear } from "../ops/types";

export class FeedsPeriodNotFoundError extends Error {
  constructor(query: string) {
    super(`No pude reconocer un año o mes en "${query}".`);
    this.name = "FeedsPeriodNotFoundError";
  }
}

/**
 * Peak simultaneous Feeds 24/7 for a calendar year — the same "Pico de
 * Feeds simultaneos" metric as the Feeds Capacity dashboard (MAX of the
 * Meses rollup for that year, not a naive sum of every project active
 * anytime that year, which double-counts non-overlapping projects).
 */
export async function getFeedsCapacityByYear(year: number): Promise<FeedsCapacityYear> {
  if (isMockMode()) {
    return { year, peakFeeds: 0, peakMonth: null };
  }

  const rows = await listRecords(MESES_TABLE);
  const inYear = rows.filter((r) => r.fields[MESES_FIELDS.anio] === year);

  let peakFeeds = 0;
  let peakMonth: string | null = null;
  for (const row of inYear) {
    const total = (row.fields[MESES_FIELDS.totalFeedsDelMes] as number | undefined) ?? 0;
    if (total > peakFeeds) {
      peakFeeds = total;
      peakMonth = (row.fields[MESES_FIELDS.mes] as string | undefined) ?? null;
    }
  }
  return { year, peakFeeds, peakMonth };
}

/**
 * Projects/feeds active in a specific month (free text, e.g. "octubre
 * 2026"), read straight from the Monthly Usage junction table — mirrors
 * the dashboard's "¿Qué está activo en un mes puntual?" grid.
 */
export async function listFeedsActiveInMonth(monthQuery: string): Promise<FeedsActiveProject[]> {
  const { year, monthIndex } = parsePeriod(monthQuery);
  if (year == null || monthIndex == null) {
    throw new FeedsPeriodNotFoundError(monthQuery);
  }
  const label = monthLabel(year, monthIndex);

  if (isMockMode()) return [];

  const rows = await listRecords(FEEDS_MONTHLY_TABLE, {
    filterByFormula: `{${FEEDS_MONTHLY_FIELDS.mesOrden}} = "${label}"`,
  });

  return rows.map((r) => ({
    id: r.id,
    project: (r.fields[FEEDS_MONTHLY_FIELDS.projectName] as string[] | undefined)?.[0] ?? "(sin nombre)",
    country: (r.fields[FEEDS_MONTHLY_FIELDS.country] as string[] | undefined)?.[0],
    type: (r.fields[FEEDS_MONTHLY_FIELDS.type] as string[] | undefined)?.[0],
    status: (r.fields[FEEDS_MONTHLY_FIELDS.status] as string[] | undefined)?.[0],
    adHoc: (r.fields[FEEDS_MONTHLY_FIELDS.adHoc] as string[] | undefined)?.[0],
    qFeeds: (r.fields[FEEDS_MONTHLY_FIELDS.feeds] as number | undefined) ?? 0,
  }));
}
