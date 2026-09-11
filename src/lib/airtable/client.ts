// Server-side Airtable REST client.
// This file must never be imported from a Client Component — it reads the
// Airtable PAT from environment variables and the token must never reach
// the browser. All app code should go through projects.ts / tasks.ts,
// not call this client directly from route handlers when avoidable.

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export class AirtableError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AirtableError";
    this.status = status;
  }
}

interface AirtableRecord<TFields = Record<string, unknown>> {
  id: string;
  createdTime: string;
  fields: TFields;
}

interface AirtableListResponse<TFields = Record<string, unknown>> {
  records: AirtableRecord<TFields>[];
  offset?: string;
}

function getConfig() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  return { token, baseId, mockMode: !token || !baseId };
}

/** True when no Airtable credentials are configured; callers fall back to mock data. */
export function isMockMode(): boolean {
  return getConfig().mockMode;
}

function buildUrl(
  table: string,
  params: Record<string, string | number | undefined>,
  baseId: string
) {
  const url = new URL(`${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(table)}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(url: string, token: string): Promise<T> {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        // Airtable data changes frequently; always read fresh.
        cache: "no-store",
      });
    } catch (err) {
      throw new AirtableError(
        `Network error contacting Airtable: ${(err as Error).message}`,
        0
      );
    }

    if (res.ok) {
      return (await res.json()) as T;
    }

    if (res.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 500 * 2 ** (attempt - 1);
      await sleep(waitMs);
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new AirtableError(
        "Airtable rejected the request (401/403). Check AIRTABLE_TOKEN scope/permissions.",
        res.status
      );
    }
    if (res.status === 404) {
      throw new AirtableError(
        "Airtable table or base not found (404). Check AIRTABLE_BASE_ID and table name.",
        404
      );
    }
    throw new AirtableError(`Airtable request failed with status ${res.status}`, res.status);
  }

  throw new AirtableError("Airtable request failed after retries.", 429);
}

/** List all records in a table, transparently following Airtable pagination. */
export async function listRecords<TFields = Record<string, unknown>>(
  table: string,
  options: { filterByFormula?: string; maxRecords?: number; view?: string } = {}
): Promise<AirtableRecord<TFields>[]> {
  const { token, baseId } = getConfig();
  if (!token || !baseId) {
    throw new AirtableError("Airtable credentials are not configured.", 0);
  }

  const records: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;

  do {
    const url = buildUrl(
      table,
      {
        filterByFormula: options.filterByFormula,
        maxRecords: options.maxRecords,
        view: options.view,
        offset,
      },
      baseId
    );
    const page = await request<AirtableListResponse<TFields>>(url, token);
    records.push(...page.records);
    offset = page.offset;
  } while (offset);

  return records;
}

/** Fetch a single record by its Airtable record ID. */
export async function getRecordById<TFields = Record<string, unknown>>(
  table: string,
  recordId: string
): Promise<AirtableRecord<TFields> | null> {
  const { token, baseId } = getConfig();
  if (!token || !baseId) {
    throw new AirtableError("Airtable credentials are not configured.", 0);
  }
  const url = `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(table)}/${recordId}`;
  try {
    return await request<AirtableRecord<TFields>>(url, token);
  } catch (err) {
    if (err instanceof AirtableError && err.status === 404) return null;
    throw err;
  }
}

/** Fetch several records by ID, resolved individually (robust for linked-record arrays). */
export async function getRecordsByIds<TFields = Record<string, unknown>>(
  table: string,
  recordIds: string[]
): Promise<AirtableRecord<TFields>[]> {
  const results: AirtableRecord<TFields>[] = [];

  // Resolve linked records sequentially to stay below Airtable's request-rate limit.
  for (const id of recordIds) {
    const record = await getRecordById<TFields>(table, id);
    if (record) results.push(record);
  }

  return results;
}

export type { AirtableRecord };
