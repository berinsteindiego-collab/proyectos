import { NextResponse } from "next/server";

function authHeader(): string {
  const id = process.env.CONVIVA_CLIENT_ID;
  const secret = process.env.CONVIVA_CLIENT_SECRET;

  if (!id || !secret) {
    throw new Error("Conviva no está configurado en el servidor.");
  }

  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function probe(url: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  let body: unknown = text;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep the raw text when Conviva does not return JSON.
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

export async function GET() {
  try {
    const [bulkFilters, savedFilters] = await Promise.all([
      probe("https://api.conviva.com/bulk_filters/fields/"),
      probe("https://api.conviva.com/insights/3.0/metrics/_meta/references/filters"),
    ]);

    return NextResponse.json({
      ok: true,
      bulkFilters: {
        enabled: bulkFilters.ok,
        status: bulkFilters.status,
        response: bulkFilters.body,
      },
      savedFilters: {
        enabled: savedFilters.ok,
        status: savedFilters.status,
        response: savedFilters.body,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudieron verificar las capacidades de filtros de Conviva.",
      },
      { status: 500 }
    );
  }
}
