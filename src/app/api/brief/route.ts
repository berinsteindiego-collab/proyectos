import { NextResponse } from "next/server";
import { getOverviewAlerts } from "@/lib/airtable/overview";
import { getPanorama } from "@/lib/airtable/panorama";

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
    return NextResponse.json({ reply: parts.join(" ") });
  } catch (err) {
    console.error("Error generando brief:", err);
    return NextResponse.json({ error: "No se pudo generar el resumen de hoy." }, { status: 500 });
  }
}
