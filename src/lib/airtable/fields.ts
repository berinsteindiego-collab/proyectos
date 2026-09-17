// Centralized Airtable field-name mapping.
// Do NOT scatter raw Airtable field label strings across UI/components.
// If a label changes in Airtable, update it only here.
// Source: docs/AIRTABLE_SCHEMA.md

export const EVENT_FIELDS = {
  name: "Nombre Evento",
  category: "Categoría",
  format: "Formato",
  startDate: "Fecha Inicio",
  endDate: "Fecha Fin",
  status: "Estado General",
  readiness: "Launch Readiness",
  daysToLaunch: "Días para lanzamiento",
  totalTasks: "Total Tasks",
  completedTasks: "Completed Tasks",
  openBlockers: "Bloqueante Abierto", // verify exact live label; see AIRTABLE_SCHEMA.md #2
  overdueBlockers: "Bloqueante Vencidos",
  region: "Región",
  description: "Descripción",
  tasks: "Tareas",
} as const;

export const TASK_FIELDS = {
  name: "Item",
  event: "Evento",
  status: "Estado",
  deadline: "Deadline",
  isBlocker: "Bloqueante",
  priority: "Prioridad",
  comments: "Comentarios",
  daysRemaining: "Días Restantes",
  semaforo: "Semáforo",
  risk: "Riesgo",
  dependsOn: "Depende de",
  openBlocker: "Bloqueante Abierto",
  overdueBlocker: "Bloqueante Vencido",
  completed: "Completada",
  responsible: "Responsable",
  owner: "Owner",
} as const;

export const EVENTOS_TABLE = "Eventos";
export const TAREAS_TABLE = "Tareas";
export const TEMPLATES_TABLE = "Templates";

// --- Phase 3: Feeds Roll Out (24/7 feed capacity) ---
// Live tables in the Proyectos base (see docs/AIRTABLE_SCHEMA.md #7).
// "Feeds Roll Out" holds one row per project/channel with its active date
// range; "Feeds Roll Out - Monthly Usage" is the generated junction (one row
// per project x active month, kept in sync by an Airtable automation) that
// makes monthly/annual aggregation possible without recomputing overlaps
// here. "Meses" is a one-row-per-calendar-month summary table whose
// "Total Feeds del Mes" rollup is the only correct source for peak
// simultaneous capacity — never sum Q Feeds across Feeds Roll Out directly,
// that double-counts projects that don't all overlap.

export const FEEDS_TABLE = "Feeds Roll Out";
export const FEEDS_MONTHLY_TABLE = "Feeds Roll Out - Monthly Usage";
export const MESES_TABLE = "Meses";

export const FEEDS_FIELDS = {
  project: "Project",
  country: "Country",
  qFeeds: "Q Feeds (24/7)",
  type: "Type",
  status: "Status",
  adHoc: "Ad Hoc",
  startDate: "Start Date",
  endDate: "End Date",
} as const;

export const FEEDS_MONTHLY_FIELDS = {
  usageId: "Usage ID",
  month: "Month",
  mesOrden: "Mes (orden)",
  projectName: "Project Name",
  country: "Country",
  type: "Type",
  status: "Status",
  adHoc: "Ad Hoc",
  feeds: "Feeds",
} as const;

export const MESES_FIELDS = {
  mes: "Mes",
  anio: "Año",
  totalFeedsDelMes: "Total Feeds del Mes",
} as const;

// --- Phase 3: Standalones (event count model) ---
// "Standalones Events" is one row per show/project; "Standalones - Monthly
// Events" is the generated junction (one row per show x active month) whose
// "Events" field holds the real per-month count copied from the source
// spreadsheet. Summing "Events" across a year's rows is what matches the
// spreadsheet's own yearly TOTAL — see docs/AIRTABLE_SCHEMA.md #8.
export const STANDALONES_TABLE = "Standalones Events";
export const STANDALONES_MONTHLY_TABLE = "Standalones - Monthly Events";

export const STANDALONES_FIELDS = {
  eventName: "Event Name",
  type: "Type",
  reference: "Reference",
  year: "Year",
} as const;

export const STANDALONES_MONTHLY_FIELDS = {
  name: "Name",
  month: "Month",
  mesOrden: "Mes (orden)",
  events: "Events",
  eventName: "Event Name",
  type: "Type",
  reference: "Reference",
} as const;
