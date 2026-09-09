const CONVIVA_BASE_URL = "https://api.conviva.com/insights/3.0/real-time-metrics";

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

interface ConvivaMetricValue {
  count?: number;
}

interface ConvivaDimension {
  key?: string;
  value?: string;
}

interface ConvivaDimensionalRow {
  dimension?: ConvivaDimension;
  metrics?: Record<string, ConvivaMetricValue | undefined>;
  [key: string]: unknown;
}

interface ConvivaTimestamp {
  epoch_ms?: number;
  iso_date?: string;
}

interface ConvivaTimeSeriesPoint {
  timestamp?: ConvivaTimestamp;
  dimensional_data?: ConvivaDimensionalRow[];
  [metricName: string]: unknown;
}

interface ConvivaMetricsV3Response {
  time_series?: ConvivaTimeSeriesPoint[];
  total?: Record<string, ConvivaMetricValue | undefined>;
}

type GroupByDimension =
  | "asset"
  | "device-name"
  | "geo-country-code"
  | "content-category"
  | "content-meta-show-title";
type SortOrder = "asc" | "desc";

interface ConvivaFilter {
  name: "asset" | "content_meta_show_title";
  value: string;
}

function authHeader(): string {
  const id = process.env.CONVIVA_CLIENT_ID;
  const secret = process.env.CONVIVA_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Conviva no está configurado en el servidor.");
  }
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function buildGroupByUrl(
  dimension: GroupByDimension,
  filters: ConvivaFilter[] = [],
  order: SortOrder = "desc"
): string {
  const url = new URL(`${CONVIVA_BASE_URL}/concurrent-plays/group-by/${dimension}`);
  url.searchParams.set("minutes", "5");
  url.searchParams.set("granularity", "PT1M");
  url.searchParams.set("limit", dimension === "asset" ? "500" : "200");
  url.searchParams.set("sort_by", "concurrent-plays");
  url.searchParams.set("order", order);

  for (const filter of filters) {
    url.searchParams.append(filter.name, filter.value);
  }

  return url.toString();
}

async function convivaGroupBy(
  dimension: GroupByDimension,
  filters: ConvivaFilter[] = [],
  order: SortOrder = "desc"
): Promise<ConvivaMetricsV3Response> {
  const res = await fetch(buildGroupByUrl(dimension, filters, order), {
    method: "GET",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Conviva respondió ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }

  return (await res.json()) as ConvivaMetricsV3Response;
}

function selectedPointInfo(response: ConvivaMetricsV3Response): {
  point?: ConvivaTimeSeriesPoint;
  index: number;
} {
  const points = response.time_series ?? [];
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if ((points[i]?.dimensional_data?.length ?? 0) > 0) {
      return { point: points[i], index: i };
    }
  }
  return { point: points.length ? points[points.length - 1] : undefined, index: points.length - 1 };
}

function metricCount(row: ConvivaDimensionalRow): number {
  const metric = row.metrics?.["concurrent_plays"] ?? row.metrics?.["concurrent-plays"];
  return Number(metric?.count ?? 0);
}

function rows(response: ConvivaMetricsV3Response): ConvivaDimensionalRow[] {
  return selectedPointInfo(response).point?.dimensional_data ?? [];
}

function rowValue(row: ConvivaDimensionalRow): string {
  return row.dimension?.value?.trim() || "Unknown";
}

function mergeRows(...groups: ConvivaDimensionalRow[][]): ConvivaDimensionalRow[] {
  const merged = new Map<string, ConvivaDimensionalRow>();

  for (const group of groups) {
    for (const row of group) {
      const key = rowValue(row);
      const current = merged.get(key);
      if (!current || metricCount(row) > metricCount(current)) merged.set(key, row);
    }
  }

  return [...merged.values()];
}

function percentage(value: number, total: number): number | undefined {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : undefined;
}

function cleanAssetName(value: string): string {
  return value
    .replace(/\s+-\s+s-\d+e-\d+.*$/i, "")
    .replace(/\s+-\s+mediaid:.*$/i, "")
    .trim();
}

function breakdownFromRows(
  source: ConvivaDimensionalRow[],
  total: number,
  limit = 8,
  nameTransform?: (value: string) => string
): ConvivaBreakdownItem[] {
  return source
    .map((row) => {
      const value = metricCount(row);
      const rawName = rowValue(row);
      return {
        name: nameTransform ? nameTransform(rawName) : rawName,
        value,
        percentage: percentage(value, total),
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function countryName(code: string): string {
  const upper = code.toUpperCase();
  try {
    const displayNames = new Intl.DisplayNames(["es"], { type: "region" });
    return displayNames.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

function classifyLiveVod(value: string): "live" | "vod" | null {
  const raw = normalizeText(value);
  if (["t", "true", "live", "en vivo"].includes(raw)) return "live";
  if (["f", "false", "vod", "vo d", "on demand", "video on demand"].includes(raw)) return "vod";
  return null;
}

function liveVodFromRows(source: ConvivaDimensionalRow[]): { live: number; vod: number } {
  let live = 0;
  let vod = 0;

  for (const row of source) {
    const kind = classifyLiveVod(rowValue(row));
    const value = metricCount(row);
    if (kind === "live") live += value;
    if (kind === "vod") vod += value;
  }

  return { live, vod };
}

function filtersForShowTitles(showTitles: string[]): ConvivaFilter[] {
  return showTitles.map((value) => ({ name: "content_meta_show_title", value }));
}

function filtersForAssets(assets: string[]): ConvivaFilter[] {
  return assets.map((value) => ({ name: "asset", value }));
}

async function resolveShowTitles(title: string): Promise<string[]> {
  const [desc, asc] = await Promise.all([
    convivaGroupBy("content-meta-show-title", [], "desc"),
    convivaGroupBy("content-meta-show-title", [], "asc"),
  ]);
  const normalizedTitle = normalizeText(title);

  return mergeRows(rows(desc), rows(asc))
    .map(rowValue)
    .filter((value) => normalizeText(value).includes(normalizedTitle));
}

async function resolveAssetsFallback(title: string): Promise<ConvivaDimensionalRow[]> {
  const [desc, asc] = await Promise.all([
    convivaGroupBy("asset", [], "desc"),
    convivaGroupBy("asset", [], "asc"),
  ]);
  const normalizedTitle = normalizeText(title);

  return mergeRows(rows(desc), rows(asc)).filter((row) =>
    normalizeText(rowValue(row)).includes(normalizedTitle)
  );
}

export async function getConvivaLiveSnapshot(titleQuery: string): Promise<ConvivaLiveSnapshot> {
  const title = titleQuery.trim();
  if (!title) throw new Error("Falta el título para consultar Conviva.");

  // Prefer Conviva's public show-title metadata to identify the whole content
  // family. Once resolved, exact content_meta_show_title filters avoid losing
  // smaller companion titles because of the 500-row asset group-by cap.
  const matchedShowTitles = await resolveShowTitles(title);

  let assetResponse: ConvivaMetricsV3Response;
  let familyFilters: ConvivaFilter[];

  if (matchedShowTitles.length) {
    familyFilters = filtersForShowTitles(matchedShowTitles);
    assetResponse = await convivaGroupBy("asset", familyFilters);
  } else {
    const fallbackRows = await resolveAssetsFallback(title);
    const fallbackAssets = fallbackRows.map(rowValue);

    if (!fallbackAssets.length) {
      return {
        titleQuery: title,
        matchedAssets: [],
        concurrentPlays: 0,
        liveConcurrentPlays: 0,
        vodConcurrentPlays: 0,
        titles: [],
        countries: [],
        devices: [],
        updatedAt: new Date().toISOString(),
      };
    }

    familyFilters = filtersForAssets(fallbackAssets);
    assetResponse = await convivaGroupBy("asset", familyFilters);
  }

  const assetRows = rows(assetResponse);
  const matchedAssets = assetRows.map(rowValue);
  const concurrentPlays = assetRows.reduce((sum, row) => sum + metricCount(row), 0);
  const titles = breakdownFromRows(assetRows, concurrentPlays, 20, cleanAssetName);
  const selected = selectedPointInfo(assetResponse);
  const updatedAt = selected.point?.timestamp?.iso_date ?? new Date().toISOString();

  const [countryResponse, deviceResponse, liveVodResponse] = await Promise.all([
    convivaGroupBy("geo-country-code", familyFilters),
    convivaGroupBy("device-name", familyFilters),
    convivaGroupBy("content-category", familyFilters),
  ]);

  const { live, vod } = liveVodFromRows(rows(liveVodResponse));

  return {
    titleQuery: title,
    matchedAssets,
    concurrentPlays,
    liveConcurrentPlays: live,
    vodConcurrentPlays: vod,
    titles,
    countries: breakdownFromRows(rows(countryResponse), concurrentPlays, 8, countryName),
    devices: breakdownFromRows(rows(deviceResponse), concurrentPlays, 8),
    updatedAt,
  };
}
