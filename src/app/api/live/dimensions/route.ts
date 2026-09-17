import { NextResponse } from "next/server";

const CONVIVA_DIMENSIONS_URL =
  "https://api.conviva.com/insights/3.0/metrics/_meta/references/dimensions";

function authHeader(): string {
  const id = process.env.CONVIVA_CLIENT_ID;
  const secret = process.env.CONVIVA_CLIENT_SECRET;

  if (!id || !secret) {
    throw new Error("Conviva no está configurado en el servidor.");
  }

  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

function collectInterestingEntries(value: unknown): unknown[] {
  const matches: unknown[] = [];
  const keywords = [
    "title",
    "show",
    "program",
    "asset",
    "content",
    "video",
    "live",
    "vod",
  ];

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const searchable = Object.values(record)
      .filter((item): item is string => typeof item === "string")
      .join(" ")
      .toLowerCase();

    if (keywords.some((keyword) => searchable.includes(keyword))) {
      matches.push(record);
    }

    for (const child of Object.values(record)) {
      if (child && typeof child === "object") visit(child);
    }
  }

  visit(value);
  return matches.slice(0, 250);
}

export async function GET() {
  try {
    const response = await fetch(CONVIVA_DIMENSIONS_URL, {
      method: "GET",
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: response.status,
          error: text.slice(0, 1000),
        },
        { status: response.status }
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return NextResponse.json({
      ok: true,
      source: "Conviva Metrics V3 dimensions metadata",
      interesting: collectInterestingEntries(data),
      raw: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudieron consultar las dimensiones de Conviva.",
      },
      { status: 500 }
    );
  }
}
