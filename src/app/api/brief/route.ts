import { NextResponse } from "next/server";
import { getOverviewAlerts } from "@/lib/airtable/overview";
import { getPanorama } from "@/lib/airtable/panorama";
import type { ListPayload, UrgencyTone } from "@/lib/project-status/types";

function overdueList(items: Awaited<ReturnType<typeof getOverviewAlerts>>["overdueTasks"]): ListPayload {
  return {
    heading: "Tareas vencidas",
    items: items.map(({ task, projectName }) => ({
      id: `${projectName}-${task.id}`,
      title: task.name,
      subtitle: `${projectName} · ${task.status}`,
      badge: { label: "Vencida", tone: "red" as UrgencyTone },
      meta: [task.deadline ? `Deadline ${task.deadline}` : null, task.responsible, ...(task.owners ?? [])].filter(
        (value): value is string => Boolean(value)
      ),
    })),
  };
}

function upcomingList(items: Awaited<ReturnType<typeof getOverviewAlerts>>["upcomingDeadlines"]): ListPayload {
  return {
    heading: "Próximos deadlines",
    items: items.map(({ task, projectName }) => ({
      id: `${projectName}-${task.id}`,
      title: task.name,
      subtitle: `${projectName} · ${task.status}`,
      badge: { label: "Próximos 7 días", tone: "amber" as UrgencyTone },
      meta: [task.deadline ? `Deadline ${task.deadline}` : null, task.responsible, ...(task.owners ?? [])].filter(
        (value): value is string => Boolean(value)
      ),
    })),
  };
}

function riskList(items: Awaited<ReturnType<typeof getOverviewAlerts>>["atRisk"]): ListPayload {
  return {
    heading: "Proyectos en riesgo",
    items: items.map((project) => ({
      id: project.id,
      title: project.name,
      subtitle: project.readiness != null ? `Launch Readiness ${project.readiness}%` : undefined,
      badge: { label: project.status ?? "En riesgo", tone: "red" as UrgencyTone },
    })),
  };
}

export async function GET() {
  try {
    const [overview, panorama] = await Promise.all([getOverviewAlerts(), getPanorama()]);
    const next = panorama.upcomingProjects[0];
    const parts = [
      `Hoy hay ${panorama.activeProjects} proyectos activos.`,
      next ? `El próximo evento es ${next.name}${next.daysToLaunch != null ? `, en ${next.daysToLaunch} días` : ""}.` : null,
      overview.upcomingDeadlines.length ? `Hay ${overview.upcomingDeadlines.length} deadlines dentro de los próximos 7 días.` : "No hay deadlines próximos en los próximos 7 días.",
      overview.overdueTasks.length ? `Hay ${overview.overdueTasks.length} tareas vencidas que requieren seguimiento.` : "No hay tareas vencidas en el resumen actual.",
      overview.atRisk.length ? `${overview.atRisk.length} proyectos figuran en riesgo según Airtable.` : "No hay proyectos marcados en riesgo.",
    ].filter(Boolean);

    const actions = [
      overview.overdueTasks.length
        ? { label: `Ver tareas vencidas (${overview.overdueTasks.length})`, reply: "Estas son las tareas vencidas que requieren seguimiento:", list: overdueList(overview.overdueTasks) }
        : null,
      overview.upcomingDeadlines.length
        ? { label: `Ver próximos deadlines (${overview.upcomingDeadlines.length})`, reply: "Estos son los deadlines de los próximos 7 días:", list: upcomingList(overview.upcomingDeadlines) }
        : null,
      overview.atRisk.length
        ? { label: `Ver proyectos en riesgo (${overview.atRisk.length})`, reply: "Estos son los proyectos marcados en riesgo:", list: riskList(overview.atRisk) }
        : null,
      next
        ? { label: `Abrir ${next.name}`, query: next.name }
        : null,
    ].filter(Boolean);

    return NextResponse.json({ reply: parts.join(" "), actions });
  } catch (err) {
    console.error("Error generando brief:", err);
    return NextResponse.json({ error: "No se pudo generar el resumen de hoy." }, { status: 500 });
  }
}
