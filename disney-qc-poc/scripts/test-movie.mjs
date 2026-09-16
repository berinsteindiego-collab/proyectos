import { chromium } from "playwright";
import path from "node:path";

const profileDir =
  "disney-qc-poc/auth/profiles/arg";

const context =
  await chromium.launchPersistentContext(
    path.resolve(profileDir),
    {
      headless: false,
      locale: "es-419",
      viewport: {
        width: 1440,
        height: 900,
      },
    }
  );

const pages = context.pages();

const page =
  pages[0] ?? await context.newPage();

let disneyApiHeaders = null;

page.on("request", async (request) => {
  if (disneyApiHeaders) return;

  const url = request.url();

  if (
    !url.includes(
      "disney.api.edge.bamgrid.com/explore/"
    )
  ) {
    return;
  }

  const headers = await request.allHeaders();

  if (!headers.authorization) return;

  disneyApiHeaders = {
    authorization: headers.authorization,
  };

  for (const name of [
    "x-bamsdk-client-id",
    "x-bamsdk-platform",
    "x-bamsdk-version",
    "x-application-version",
  ]) {
    if (headers[name]) {
      disneyApiHeaders[name] = headers[name];
    }
  }
});

await page.goto(
  "https://www.disneyplus.com/es-419/home",
  {
    waitUntil: "domcontentloaded",
  }
);

await page.waitForTimeout(4000);

if (!disneyApiHeaders) {
  await page.reload({
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(4000);
}

if (!disneyApiHeaders) {
  throw new Error(
    "No pude capturar autorización de Disney Explore."
  );
}

console.log("");
console.log('🔎 Buscando "Camp Rock 3"...');

const searchUrl =
  "https://disney.api.edge.bamgrid.com/" +
  "explore/v1.18/search" +
  "?query=" +
  encodeURIComponent("Camp Rock 3");

const response =
  await context.request.get(searchUrl, {
    headers: disneyApiHeaders,
  });

if (!response.ok()) {
  throw new Error(
    `Search HTTP ${response.status()}`
  );
}

const json = await response.json();

const items =
  json?.data?.page?.containers?.flatMap(
    (container) => container.items ?? []
  ) ?? [];

const result =
  items.find(
    (item) =>
      item.visuals?.title
        ?.toLowerCase()
        .trim() === "camp rock 3"
  ) ??
  items[0];

if (!result) {
  throw new Error(
    "No encontré resultados para Camp Rock 3."
  );
}

console.log("");
console.log(
  `✓ Encontrado: ${result.visuals?.title ?? "Sin título"}`
);

console.log(`Entity: ${result.id ?? "No disponible"}`);

console.log("");
console.log("ACTIONS:");

for (const action of result.actions ?? []) {
  console.log(
    `- ${action.type ?? "sin tipo"}`
  );

  console.log(
    `  deeplinkId: ${action.deeplinkId ?? "—"}`
  );

  console.log(
    `  resourceId: ${
      action.resourceId ? "SÍ" : "—"
    }`
  );

  console.log(
    `  contentType: ${action.contentType ?? "—"}`
  );
}

console.log("");
console.log(
  `Playback directo: ${
    result.actions?.some(
      (action) => action.type === "playback"
    )
      ? "SÍ"
      : "NO"
  }`
);
console.log("");
console.log("🎬 Abriendo Movie Entity...");

const movieEntity = result.id;

let moviePlaybackAction = null;

page.on("response", async (response) => {
  if (moviePlaybackAction) return;

  const url = response.url();

  if (
    !url.includes(
      "disney.api.edge.bamgrid.com/explore/"
    )
  ) {
    return;
  }

  try {
    const contentType =
      response.headers()["content-type"] ?? "";

    if (!contentType.includes("json")) {
      return;
    }

    const body = await response.json();

    function findPlayback(value) {
      if (
        !value ||
        typeof value !== "object"
      ) {
        return null;
      }

      if (
        value.type === "playback" &&
        value.resourceId
      ) {
        return value;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findPlayback(item);

          if (found) return found;
        }

        return null;
      }

      for (const item of Object.values(value)) {
        const found = findPlayback(item);

        if (found) return found;
      }

      return null;
    }

    const found = findPlayback(body);

    if (found) {
      moviePlaybackAction = found;
    }
  } catch {
    // Ignorar responses que no sean utilizables.
  }
});

await page.goto(
  `https://www.disneyplus.com/es-419/browse/entity-${movieEntity}`,
  {
    waitUntil: "domcontentloaded",
  }
);

await page.waitForTimeout(5000);

console.log("");

if (!moviePlaybackAction) {
  console.log(
    "Playback en Entity: NO ENCONTRADO"
  );
} else {
  console.log(
    "✓ Playback en Entity: ENCONTRADO"
  );

  console.log(
    `contentType: ${
      moviePlaybackAction.contentType ?? "—"
    }`
  );

  console.log(
    `deeplinkId: ${
      moviePlaybackAction.deeplinkId ?? "—"
    }`
  );

  console.log(
    `resourceId: ${
      moviePlaybackAction.resourceId
        ? "SÍ"
        : "—"
    }`
  );

  console.log(
    `internalTitle: ${
      moviePlaybackAction.internalTitle ?? "—"
    }`
  );
}
await context.close();