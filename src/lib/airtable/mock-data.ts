// Sample data used only when AIRTABLE_TOKEN / AIRTABLE_BASE_ID are not set.
// Lets the app run end-to-end (search, brief, task table, chat) before real
// credentials are wired in. Never used once real credentials are present.
import type { ProjectSearchResult, ProjectStatus } from "../project-status/types";

export const MOCK_PROJECTS: Record<string, ProjectStatus> = {
  "la granja vip 2: méxico": {
    project: {
      id: "recMOCK001",
      name: "La Granja VIP 2: México",
      category: "Reality",
      format: "Standalone + 24/7",
      region: "LAS",
      startDate: "2026-09-06",
      endDate: null,
      status: "Risk",
      readiness: 71,
      daysToLaunch: 4,
      description: "Mock record for local development without Airtable access.",
    },
    summary: {
      totalTasks: 31,
      completedTasks: 22,
      pendingTasks: 9,
      openBlockers: 5,
      overdueBlockers: 0,
    },
    tasks: [
      {
        id: "recTASK001",
        name: "IMÁGENES | Solicitar assets clave",
        status: "In Progress",
        deadline: "2026-09-04",
        priority: "Alta",
        risk: "Medio",
        isBlocker: true,
        dependsOn: [],
      },
      {
        id: "recTASK002",
        name: "METADATA | Cargar traducciones",
        status: "Blocked",
        deadline: "2026-09-05",
        priority: "Alta",
        risk: "Alto",
        isBlocker: true,
        dependsOn: ["recTASK001"],
      },
      {
        id: "recTASK003",
        name: "QC eventos",
        status: "Not Started",
        deadline: "2026-09-06",
        priority: "Media",
        risk: "Bajo",
        isBlocker: false,
        dependsOn: [],
      },
    ],
  },
  "la granja vip 3: colombia": {
    project: {
      id: "recMOCK002",
      name: "La Granja VIP 3: Colombia",
      category: "Reality",
      format: "Standalone",
      region: "LAS",
      startDate: "2026-10-12",
      endDate: null,
      status: "On Track",
      readiness: 40,
      daysToLaunch: 39,
      description: "Mock record for local development without Airtable access.",
    },
    summary: {
      totalTasks: 20,
      completedTasks: 6,
      pendingTasks: 14,
      openBlockers: 1,
      overdueBlockers: 0,
    },
    tasks: [
      {
        id: "recTASK004",
        name: "Firma Contrato",
        status: "In Progress",
        deadline: "2026-09-10",
        priority: "Alta",
        risk: "Medio",
        isBlocker: false,
        dependsOn: [],
      },
    ],
  },
};

/** Case/accent-insensitive "contains" match, same behaviour as the real Airtable search. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function searchMockProjects(query: string): ProjectSearchResult[] {
  const q = normalize(query.trim());
  return Object.values(MOCK_PROJECTS)
    .filter((p) => normalize(p.project.name).includes(q))
    .map((p) => ({
      id: p.project.id,
      name: p.project.name,
      status: p.project.status,
      readiness: p.project.readiness,
      daysToLaunch: p.project.daysToLaunch,
      startDate: p.project.startDate,
    }));
}

export function findMockProjectById(id: string): ProjectStatus | null {
  return Object.values(MOCK_PROJECTS).find((p) => p.project.id === id) ?? null;
}

export function listMockUpcoming(): ProjectSearchResult[] {
  return Object.values(MOCK_PROJECTS)
    .map((p) => ({
      id: p.project.id,
      name: p.project.name,
      status: p.project.status,
      readiness: p.project.readiness,
      daysToLaunch: p.project.daysToLaunch,
      startDate: p.project.startDate,
    }))
    .sort((a, b) => (a.daysToLaunch ?? 9999) - (b.daysToLaunch ?? 9999));
}
