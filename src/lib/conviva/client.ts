const CONVIVA_METRICS_URL = "https://instant-filter-us-east-1-prod.conviva.com/v1.0/metrics?mode=ei";

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

type ConvivaGroupBy = "c3.video.isLive" | "title" | "GEO_COUNTRY" | "m3.dv.n";

interface ConvivaResultRow {
  ConcurrentPlays?: number;
  name?: string[];
  value?: string[];
  title?: string;
  GEO_COUNTRY?: string;
  "m3.dv.n"?: string;
  "c3.video.isLive"?: string;
}

interface ConvivaDataPoint {
  timestamp?: string;
  results?: ConvivaResultRow[];
}

interface ConvivaTotalPoint {
  timestamp?: string;
  results?: { ConcurrentPlays?: number };
}

interface ConvivaMetricsResponseItem {
  data?: ConvivaDataPoint[];
  totals?: ConvivaTotalPoint[];
}

type ConvivaMetricsResponse = ConvivaMetricsResponseItem[];

function authHeader(): string {
  const id = process.env.CONVIVA_CLIENT_ID;
  const secret = process.env.CONVIVA_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Conviva no está configurado en el servidor.");
  }
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

function currentInterval(): string {
  const end = new Date();
  const start = new Date(end.getTime() - 15 * 60 * 1000);
  return `${start.toISOString()}/${end.toISOString()}`;
}

function buildPayload(titleQuery: string, groupBy: ConvivaGroupBy) {
  return {
    queries: [
      {
        type: "group-by",
        dataset: "ExperienceInsights",
        metrics: ["ConcurrentPlays"],
        interval: currentInterval(),
        granularity: "ALL",
        filter: [
          [
            {
              field: "title",
              key: null,
              op: "contains",
              display: titleQuery,
              value: titleQuery,
              _order: 0,
            },
          ],
        ],
        limit: 200,
        groupBy: [groupBy],
        orderBy: "desc",
        sortBy: [{ metric: "ConcurrentPlays", order: "desc" }],
        options: {
          withTotals: true,
          kpiConfig: {
            TabletBitrateKbps: 400,
            ConnectionInducedRebufferingRatio: 0.4,
            kpiID: 1,
            BitrateKbps: 200,
            kpiName: "Conviva Good",
            ConnectionInducedRebufferingTimeMilliSec: 2000,
            VideoStartupTimeMilliSec: 10000,
            SessionTimeMilliSec: 10000,
            TVBitrateKbps: 800,
          },
        },
        context: "video",
        isLiveMode: true,
        _rkey: 0,
        ignoreInterval: true,
      },
    ],
  };
}

async function convivaMetrics(titleQuery: string, groupBy: ConvivaGroupBy): Promise<ConvivaMetricsResponseItem> {
  const res = await fetch(CONVIVA_METRICS_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPayload(titleQuery, groupBy)),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Conviva respondió ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }

  const body = (await res.json()) as ConvivaMetricsResponse;
  return body[0] ?? {};
}

function latestDataPoint(response: ConvivaMetricsResponseItem): ConvivaDataPoint | undefined {
  const data = response.data ?? [];
  return data.length ? data[data.length - 1] : undefined;
}

function totalConcurrent(response: ConvivaMetricsResponseItem): number {
  const totals = response.totals ?? [];
  const latest = totals.length ? totals[totals.length - 1] : undefined;
  return Number(latest?.results?.ConcurrentPlays ?? 0);
}

function rowName(row: ConvivaResultRow): string {
  return row.name?.[0] ?? row.title ?? row["m3.dv.n"] ?? row.value?.[0] ?? "Unknown";
}

function toBreakdown(response: ConvivaMetricsResponseItem, limit = 8): ConvivaBreakdownItem[] {
  const rows = latestDataPoint(response)?.results ?? [];
  const total = totalConcurrent(response);

  return rows
    .map((row) => ({ name: rowName(row), value: Number(row.ConcurrentPlays ?? 0) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((row) => ({
      ...row,
      percentage: total > 0 ? Math.round((row.value / total) * 1000) / 10 : undefined,
    }));
}

function liveVod(response: ConvivaMetricsResponseItem): { live: number; vod: number } {
  const rows = latestDataPoint(response)?.results ?? [];
  let live = 0;
  let vod = 0;

  for (const row of rows) {
    const key = row["c3.video.isLive"] ?? row.value?.[0];
    if (key === "T") live += Number(row.ConcurrentPlays ?? 0);
    if (key === "F") vod += Number(row.ConcurrentPlays ?? 0);
  }

  return { live, vod };
}

export async function getConvivaLiveSnapshot(titleQuery: string): Promise<ConvivaLiveSnapshot> {
  const title = titleQuery.trim();
  if (!title) throw new Error("Falta el título para consultar Conviva.");

  const [liveResponse, titleResponse, countryResponse, deviceResponse] = await Promise.all([
    convivaMetrics(title, "c3.video.isLive"),
    convivaMetrics(title, "title"),
    convivaMetrics(title, "GEO_COUNTRY"),
    convivaMetrics(title, "m3.dv.n"),
  ]);

  const titles = toBreakdown(titleResponse, 20);
  const { live, vod } = liveVod(liveResponse);
  const concurrentPlays = totalConcurrent(liveResponse) || totalConcurrent(titleResponse);
  const updatedAt =
    latestDataPoint(liveResponse)?.timestamp ??
    latestDataPoint(titleResponse)?.timestamp ??
    new Date().toISOString();

  return {
    titleQuery: title,
    matchedAssets: titles.map((item) => item.name),
    concurrentPlays,
    liveConcurrentPlays: live,
    vodConcurrentPlays: vod,
    titles,
    countries: toBreakdown(countryResponse),
    devices: toBreakdown(deviceResponse),
    updatedAt,
  };
}
