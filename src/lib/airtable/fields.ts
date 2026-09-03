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
