const CONVIVA_BASE_URL = "https://api.conviva.com/insights/3.0";

export interface ConvivaBreakdownItem {
  name: string;
  value: number;
  percentage?: number;
}

export interface ConvivaLiveSnapshot {
  titleQuery: string;
  matchedAssets: string[];
  concurrentPlays: number;
  countries: ConvivaBreakdownItem[];
  devices: ConvivaBreakdownItem[];
  updatedAt: string;
}

interface MetricCount {
  count?: number;
}

interface GroupByEntry {
  dimension?: { key?: string; value?: string };
  metrics?: Record<string, MetricCount>;
}

interface GroupByBucket {
  timestamp?: { iso_date?: string };
  dimensional_data?: GroupByEntry[];
}

interface GroupByResponse {
  time_series?: GroupByBucket[];
}

function authHeader(): string {
  const id = process.env.CONVIVA_CLIENT_ID;
  const secret = process.env.CONVIVA_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Conviva no está configurado en el servidor.");
  }
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function convivaGet(path: string, params: URLSearchParams): Promise<GroupByResponse> {
  const url = `${CONVIVA_BASE_URL}${path}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Conviva respondió ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }
  return (await res.json()) as GroupByResponse;
}

function latestBucket(data: GroupByResponse): GroupByBucket | undefined {
  const buckets = data.time_series ?? [];
  return buckets.length ? buckets[buckets.length - 1] : undefined;
}

function metricValue(entry: GroupByEntry, metric: string): number {
  return Number(entry.metrics?.[metric]?.count ?? 0);
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function toBreakdown(entries: GroupByEntry[], metric: string): ConvivaBreakdownItem[] {
  const rows = entries
    .map((entry) => ({
      name: entry.dimension?.value ?? "Unknown",
      value: metricValue(entry, metric),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.slice(0, 8).map((row) => ({
    ...row,
    percentage: total > 0 ? Math.round((row.value / total) * 1000) / 10 : undefined,
  }));
}

async function breakdownByDimension(
  matchedAssets: string[],
  dimensionCandidates: string[]
): Promise<ConvivaBreakdownItem[]> {
  if (!matchedAssets.length) return [];

  for (const dimension of dimensionCandidates) {
    try {
      const params = new URLSearchParams({ minutes: "5", granularity: "PT1M", limit: "200" });
      for (const asset of matchedAssets) params.append("asset", asset);
      const data = await convivaGet(`/real-time-metrics/concurrent-plays/group-by/${dimension}`, params);
      const bucket = latestBucket(data);
      if (!bucket) return [];
      return toBreakdown(bucket.dimensional_data ?? [], "concurrent-plays");
    } catch {
      // Accounts can expose different dimension sets. Try the next known alias.
    }
  }
  return [];
}

/**
 * Reproduces the Pulse idea of "Title contains" without creating a saved filter:
 * 1) fetch current concurrency grouped by asset,
 * 2) keep every asset whose title contains the requested text,
 * 3) sum those assets and reuse the exact matches as OR filters for breakdowns.
 */
export async function getConvivaLiveSnapshot(titleQuery: string): Promise<ConvivaLiveSnapshot> {
  const query = normalize(titleQuery);
  if (!query) throw new Error("Falta el título para consultar Conviva.");

  const params = new URLSearchParams({ minutes: "5", granularity: "PT1M", limit: "500" });
  const data = await convivaGet("/real-time-metrics/concurrent-plays/group-by/asset", params);
  const bucket = latestBucket(data);
  const entries = bucket?.dimensional_data ?? [];

  const matching = entries.filter((entry) => normalize(entry.dimension?.value ?? "").includes(query));
  const matchedAssets = matching.map((entry) => entry.dimension?.value ?? "").filter(Boolean);
  const concurrentPlays = matching.reduce((sum, entry) => sum + metricValue(entry, "concurrent-plays"), 0);

  const [countries, devices] = await Promise.all([
    breakdownByDimension(matchedAssets, ["geo-country-name", "country"]),
    breakdownByDimension(matchedAssets, ["device-name", "device-hardware-type", "device-os"]),
  ]);

  return {
    titleQuery,
    matchedAssets,
    concurrentPlays,
    countries,
    devices,
    updatedAt: bucket?.timestamp?.iso_date ?? new Date().toISOString(),
  };
}
