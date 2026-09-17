import { NextRequest, NextResponse } from "next/server";

const BULK_FILTERS_URL = "https://api.conviva.com/bulk_filters/";
const METRICS_BASE_URL = "https://api.conviva.com/insights/3.0/real-time-metrics";

type GroupByDimension =
  | "dimension-tag/title"
  | "geo-country-code"
  | "device-name"
  | "content-category";

interface ConvivaMetricValue {
  count?: number;
}

interface ConvivaDimensionalRow {
  dimension?: {
    key?: string;
    value?: string;
  };
  metrics?: Record<string, ConvivaMetricValue | undefined>;
}

interface ConvivaTimeSeriesPoint {
  timestamp?: {
    iso_date?: string;
  };
  dimensional_data?: ConvivaDimensionalRow[];
}

interface ConvivaMetricsResponse {
  time_series?: ConvivaTimeSeriesPoint[];
}

function authHeader(): string {
  const id = process.env.CONVIVA_CLIENT_ID;
  const secret = process.env.CONVIVA_CLIENT_SECRET;

  if (!id || !secret) {
    throw new Error("Conviva no está configurado en el servidor.");
  }

  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function bodySnippet(body: unknown): string {
  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return String(body).slice(0, 500);
  }
}

async function convivaRequest(url: string, init: RequestInit): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await readJson(response);
  return { response, body };
}

function extractFilterId(body: unknown): number | null {
  const candidates: unknown[] = [];

  if (Array.isArray(body)) candidates.push(...body);
  else if (body && typeof body === "object") candidates.push(body);

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const value = Number(record.id);
    if (Number.isFinite(value) && value > 0) return value;

    if (typeof record.location === "string") {
      const match = record.location.match(/[?&]id=(\d+)/);
      if (match) return Number(match[1]);
    }
  }

  return null;
}

async function findFilterIdByName(name: string): Promise<number | null> {
  const url = new URL(BULK_FILTERS_URL);
  url.searchParams.set("name", name);
  url.searchParams.set("limit", "20");

  const { response, body } = await convivaRequest(url.toString(), { method: "GET" });
  if (!response.ok) {
    throw new Error(`No se pudo localizar el filtro temporal (${response.status}): ${bodySnippet(body)}`);
  }

  const filters =
    body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).filters)
      ? ((body as Record<string, unknown>).filters as Array<Record<string, unknown>>)
      : Array.isArray(body)
        ? (body as Array<Record<string, unknown>>)
        : [];

  const match = filters.find((filter) => filter.name === name);
  const id = Number(match?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function createTemporaryFilter(title: string): Promise<{ id: number; name: string }> {
  const name = `Project Control TEST ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`;
  const payload = [
    {
      name,
      category: "CONTENT",
      subcategory: "Asset",
      advanced: false,
      content: false,
      enabled: true,
      rules: {
        op: "and",
        rules: [
          {
            op: "or",
            rules: [
              {
                field: "Asset Name",
                op: "contains",
                value: title,
              },
            ],
          },
        ],
      },
    },
  ];

  const { response, body } = await convivaRequest(BULK_FILTERS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (response.status !== 201 && !response.ok) {
    throw new Error(`Conviva no pudo crear el filtro temporal (${response.status}): ${bodySnippet(body)}`);
  }

  const id = extractFilterId(body) ?? (await findFilterIdByName(name));
  if (!id) {
    throw new Error(`Conviva creó el filtro, pero no pudimos recuperar su ID. Respuesta: ${bodySnippet(body)}`);
  }

  return { id, name };
}

async function deleteTemporaryFilter(id: number): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = new URL(BULK_FILTERS_URL);
  url.searchParams.set("id", String(id));
  const { response, body } = await convivaRequest(url.toString(), { method: "DELETE" });
  return { ok: response.ok, status: response.status, body };
}

function buildMetricsUrl(dimension: GroupByDimension, filterId: number): string {
  const url = new URL(`${METRICS_BASE_URL}/concurrent-plays/group-by/${dimension}`);
  url.searchParams.set("minutes", "5");
  url.searchParams.set("granularity", "PT1M");
  url.searchParams.set("limit", dimension === "dimension-tag/title" ? "500" : "200");
  url.searchParams.set("sort_by", "concurrent-plays");
  url.searchParams.set("order", "desc");
  url.searchParams.set("filter_id", String(filterId));
  return url.toString();
}

async function metricsGroupBy(dimension: GroupByDimension, filterId: number): Promise<ConvivaMetricsResponse> {
  const { response, body } = await convivaRequest(buildMetricsUrl(dimension, filterId), { method: "GET" });
  if (!response.ok) {
    throw new Error(`Conviva Metrics V3 falló en ${dimension} (${response.status}): ${bodySnippet(body)}`);
  }
  return body as ConvivaMetricsResponse;
}

function latestRows(response: ConvivaMetricsResponse): { rows: ConvivaDimensionalRow[]; updatedAt?: string } {
  const points = response.time_series ?? [];
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if ((point?.dimensional_data?.length ?? 0) > 0) {
      return { rows: point.dimensional_data ?? [], updatedAt: point.timestamp?.iso_date };
    }
  }
  return { rows: [], updatedAt: points[points.length - 1]?.timestamp?.iso_date };
}

function metricCount(row: ConvivaDimensionalRow): number {
  const metric = row.metrics?.concurrent_plays ?? row.metrics?.["concurrent-plays"];
  return Number(metric?.count ?? 0);
}

function rowValue(row: ConvivaDimensionalRow): string {
  return row.dimension?.value?.trim() || "Unknown";
}

function breakdown(response: ConvivaMetricsResponse, limit = 20) {
  return latestRows(response).rows
    .map((row) => ({ name: rowValue(row), value: metricCount(row) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function liveVod(response: ConvivaMetricsResponse): { live: number; vod: number; other: number } {
  let live = 0;
  let vod = 0;
  let other = 0;

  for (const row of latestRows(response).rows) {
    const name = rowValue(row).toLowerCase();
    const value = metricCount(row);
    if (["t", "true", "live"].includes(name)) live += value;
    else if (["f", "false", "vod", "vo d", "on demand", "video on demand"].includes(name)) vod += value;
    else other += value;
  }

  return { live, vod, other };
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim() || "La Granja VIP";
  const confirmed = req.nextUrl.searchParams.get("confirm") === "1";

  if (!confirmed) {
    return NextResponse.json(
      {
        ok: false,
        needsConfirmation: true,
        message: "Esta prueba crea un filtro temporal en Conviva, consulta las métricas y lo elimina. Agregá confirm=1 para ejecutarla.",
        example: `/api/live/filter-test?title=${encodeURIComponent(title)}&confirm=1`,
      },
      { status: 400 }
    );
  }

  let filter: { id: number; name: string } | null = null;
  let cleanup: { ok: boolean; status: number; body: unknown } | null = null;

  try {
    filter = await createTemporaryFilter(title);

    const [titleResponse, countryResponse, deviceResponse, categoryResponse] = await Promise.all([
      metricsGroupBy("dimension-tag/title", filter.id),
      metricsGroupBy("geo-country-code", filter.id),
      metricsGroupBy("device-name", filter.id),
      metricsGroupBy("content-category", filter.id),
    ]);

    const titles = breakdown(titleResponse, 50);
    const concurrentPlays = titles.reduce((sum, item) => sum + item.value, 0);
    const category = liveVod(categoryResponse);
    const updatedAt = latestRows(titleResponse).updatedAt ?? new Date().toISOString();

    cleanup = await deleteTemporaryFilter(filter.id);

    return NextResponse.json({
      ok: true,
      query: title,
      temporaryFilter: {
        created: true,
        deleted: cleanup.ok,
        deleteStatus: cleanup.status,
      },
      metrics: {
        concurrentPlays,
        liveConcurrentPlays: category.live,
        vodConcurrentPlays: category.vod,
        otherContentCategory: category.other,
        titles,
        countries: breakdown(countryResponse, 15),
        devices: breakdown(deviceResponse, 15),
        updatedAt,
      },
    });
  } catch (error) {
    if (filter && !cleanup) {
      try {
        cleanup = await deleteTemporaryFilter(filter.id);
      } catch {
        cleanup = null;
      }
    }

    return NextResponse.json(
      {
        ok: false,
        query: title,
        error: error instanceof Error ? error.message : "Falló la prueba dinámica de filtros de Conviva.",
        temporaryFilter: {
          created: Boolean(filter),
          deleted: cleanup?.ok ?? false,
          deleteStatus: cleanup?.status ?? null,
        },
      },
      { status: 502 }
    );
  }
}
