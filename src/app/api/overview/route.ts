import { NextResponse } from "next/server";
import { getOverviewAlerts } from "@/lib/airtable/overview";

// Backs the home-screen "Novedades" panel (see AttentionPanel.tsx). Read-only,
// same Airtable source of truth as the rest of the app.
export async function GET() {
  try {
    const data = await getOverviewAlerts();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error obteniendo el resumen de novedades:", err);
    return NextResponse.json({ error: "No se pudo cargar el resumen." }, { status: 500 });
  }
}
