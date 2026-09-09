const BULK_FILTERS_URL = "https://api.conviva.com/bulk_filters/";
const METRICS_BASE_URL = "https://api.conviva.com/insights/3.0/real-time-metrics";

export interface ConvivaBreakdownItem {
  name: string;
  value: number;
  percentage?: number;
}

export interface ConvivaLiveSnapshot {
  titleQuery: string;
  matchedAssets: string[];
  concurrentPlays: number;
  liveConcurrentPlays: number;
  vodConcurrentPlays: number;
  titles: ConvivaBreakdownItem[];
  countries: ConvivaBreakdownItem[];
  devices: ConvivaBreakdownItem[];
  updatedAt: string;
}

interface ConvivaMetricValue { count?: number; }
interface ConvivaDimensionalRow {
  dimension?: { key?: string; value?: string };
  metrics?: Record<string, ConvivaMetricValue | undefined>;
}
interface ConvivaTimeSeriesPoint {
  timestamp?: { iso_date?: string };
  dimensional_data?: ConvivaDimensionalRow[];
}
interface ConvivaMetricsResponse { time_series?: ConvivaTimeSeriesPoint[]; }

type GroupByDimension = "dimension-tag/title" | "geo-country-code" | "device-name" | "content-category";

function authHeader(): string {
  const id = process.env.CONVIVA_CLIENT_ID;
  const secret = process.env.CONVIVA_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Conviva no está configurado en el servidor.");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function bodySnippet(body: unknown): string {
  try { return JSON.stringify(body).slice(0, 500); } catch { return String(body).slice(0, 500); }
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
  return { response, body: await readJson(response) };
}

function extractFilterId(body: unknown): number | null {
  const candidates = Array.isArray(body) ? body : body && typeof body === "object" ? [body] : [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const id = Number(record.id);
    if (Number.isFinite(id) && id > 0) return id;
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
  if (!response.ok) throw new Error(`No se pudo localizar el filtro temporal (${response.status}): ${bodySnippet(body)}`);

  const filters = body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).filters)
    ? (body as { filters: Array<Record<string, unknown>> }).filters
    : Array.isArray(body) ? body as Array<Record<string, unknown>> : [];

  const match = filters.find((filter) => filter.name === name);
  const id = Number(match?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function createTemporaryFilter(title: string): Promise<number> {
  const name = `Project Control ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`;
  const payload = [{
    name,
    category: "CONTENT",
    subcategory: "Asset",
    advanced: false,
    content: false,
    enabled: true,
    rules: {
      op: "and",
      rules: [{
        op: "or",
        rules: [{ field: "Asset Name", op: "contains", value: title }],
      }],
    },
  }];

  const { response, body } = await convivaRequest(BULK_FILTERS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (response.status !== 201 && !response.ok) {
    throw new Error(`Conviva no pudo crear el filtro temporal (${response.status}): ${bodySnippet(body)}`);
  }
  const id = extractFilterId(body) ?? await findFilterIdByName(name);
  if (!id) throw new Error(`Conviva creó el filtro, pero no pudimos recuperar su ID. Respuesta: ${bodySnippet(body)}`);
  return id;
}

async function deleteTemporaryFilter(id: number): Promise<void> {
  const url = new URL(BULK_FILTERS_URL);
  url.searchParams.set("id", String(id));
  const { response, body } = await convivaRequest(url.toString(), { method: "DELETE" });
  if (!response.ok) console.error(`No se pudo borrar filtro Conviva ${id}: ${response.status} ${bodySnippet(body)}`);
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
  if (!response.ok) throw new Error(`Conviva Metrics V3 falló en ${dimension} (${response.status}): ${bodySnippet(body)}`);
  return body as ConvivaMetricsResponse;
}

function latestRows(response: ConvivaMetricsResponse): { rows: ConvivaDimensionalRow[]; updatedAt?: string } {
  const points = response.time_series ?? [];
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i];
    if ((point?.dimensional_data?.length ?? 0) > 0) return { rows: point.dimensional_data ?? [], updatedAt: point.timestamp?.iso_date };
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

function percentage(value: number, total: number): number | undefined {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : undefined;
}

function countryName(code: string): string {
  const upper = code.toUpperCase();
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(upper) ?? upper;
  } catch { return upper; }
}

function breakdown(response: ConvivaMetricsResponse, total: number, limit: number, transform?: (name: string) => string): ConvivaBreakdownItem[] {
  return latestRows(response).rows
    .map((row) => {
      const value = metricCount(row);
      const raw = rowValue(row);
      return { name: transform ? transform(raw) : raw, value, percentage: percentage(value, total) };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function liveVod(response: ConvivaMetricsResponse): { live: number; vod: number } {
  let live = 0;
  let vod = 0;
  for (const row of latestRows(response).rows) {
    const name = rowValue(row).toLowerCase();
    const value = metricCount(row);
    if (["t", "true", "live"].includes(name)) live += value;
    else if (["f", "false", "vod", "vo d", "on demand", "video on demand"].includes(name)) vod += value;
  }
  return { live, vod };
}

export async function getConvivaLiveSnapshot(titleQuery: string): Promise<ConvivaLiveSnapshot> {
  const title = titleQuery.trim();
  if (!title) throw new Error("Falta el título para consultar Conviva.");

  let filterId: number | null = null;
  try {
    filterId = await createTemporaryFilter(title);
    const [titleResponse, countryResponse, deviceResponse, categoryResponse] = await Promise.all([
      metricsGroupBy("dimension-tag/title", filterId),
      metricsGroupBy("geo-country-code", filterId),
      metricsGroupBy("device-name", filterId),
      metricsGroupBy("content-category", filterId),
    ]);

    const titleRows = latestRows(titleResponse).rows;
    const concurrentPlays = titleRows.reduce((sum, row) => sum + metricCount(row), 0);
    const { live, vod } = liveVod(categoryResponse);

    return {
      titleQuery: title,
      matchedAssets: titleRows.map(rowValue),
      concurrentPlays,
      liveConcurrentPlays: live,
      vodConcurrentPlays: vod,
      titles: breakdown(titleResponse, concurrentPlays, 20),
      countries: breakdown(countryResponse, concurrentPlays, 8, countryName),
      devices: breakdown(deviceResponse, concurrentPlays, 8),
      updatedAt: latestRows(titleResponse).updatedAt ?? new Date().toISOString(),
    };
  } finally {
    if (filterId) {
      try { await deleteTemporaryFilter(filterId); } catch (error) { console.error("Error limpiando filtro temporal de Conviva:", error); }
    }
  }
}
