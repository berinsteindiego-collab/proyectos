// Domain types for the Phase 3 (Feeds / Standalones) read-only modules.
// See docs/AIRTABLE_SCHEMA.md #7-8. Airtable remains the source of truth —
// nothing here recomputes a rollup/formula Airtable already owns (peak
// capacity comes from the "Meses" rollup, monthly event counts come
// straight from the "Events" field copied from the source spreadsheet).

export interface FeedsCapacityYear {
  year: number;
  peakFeeds: number;
  peakMonth: string | null;
}

export interface FeedsActiveProject {
  id: string;
  project: string;
  country?: string;
  type?: string;
  status?: string;
  adHoc?: string;
  qFeeds: number;
}

export interface StandalonesYearTotal {
  year: number;
  totalEvents: number;
  distinctShows: number;
}

export interface StandalonesMonthTotal {
  month: string;
  totalEvents: number;
}

export interface StandalonesActiveEvent {
  id: string;
  eventName: string;
  type?: string;
  reference?: string;
  events: number;
}
