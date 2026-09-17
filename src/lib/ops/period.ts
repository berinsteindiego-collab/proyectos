// Shared month/year parsing for the Feeds & Standalones chat questions
// (Phase 3). Users ask in Spanish ("marzo 2026", "en 2027"); Airtable's own
// month labels (the "Mes (orden)"/"Mes" single-select/text fields) are
// always the English "MMMM YYYY" form (e.g. "March 2026") produced by the
// automations that keep those tables in sync. This module bridges the two:
// parse whatever the user typed, always resolve to the exact English label
// Airtable stores, so filters match.

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Spanish month name (accent-stripped, lowercase) -> 0-based month index.
const MONTH_NAMES_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11,
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export interface ParsedPeriod {
  year: number | null;
  monthIndex: number | null; // 0-11
}

/** Extracts a year (2020-2099) and/or a month name (Spanish or English) from free text. */
export function parsePeriod(text: string): ParsedPeriod {
  const normalized = stripDiacritics(text.toLowerCase());

  const yearMatch = normalized.match(/\b(20[2-9]\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  let monthIndex: number | null = null;
  for (const [name, idx] of Object.entries(MONTH_NAMES_ES)) {
    if (new RegExp(`\\b${name}\\b`).test(normalized)) {
      monthIndex = idx;
      break;
    }
  }
  if (monthIndex === null) {
    for (let i = 0; i < MONTH_NAMES_EN.length; i++) {
      if (normalized.includes(MONTH_NAMES_EN[i].toLowerCase())) {
        monthIndex = i;
        break;
      }
    }
  }

  return { year, monthIndex };
}

/** Builds the exact "MMMM YYYY" English label Airtable's month fields store. */
export function monthLabel(year: number, monthIndex: number): string {
  return `${MONTH_NAMES_EN[monthIndex]} ${year}`;
}
