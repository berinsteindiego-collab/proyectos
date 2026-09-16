import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      !trimmed.includes("=")
    ) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    const key =
      trimmed.slice(0, separator).trim();

    let value =
      trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(".env.local"));

async function dismissDisneyPopup(page) {
  const okButton = page.getByRole("button", {
    name: /^OK$/i,
  });

  try {
    await okButton.waitFor({
      state: "visible",
      timeout: 3000,
    });

    await okButton.click();

    await page.waitForTimeout(500);

    console.log("✓ Popup Disney cerrado");

    return true;
  } catch {
    return false;
  }
}

function normalizeTitle(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\bdisney\+?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readTitleTreatment(imageUrl) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY no encontrada en .env.local."
    );
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        temperature: 0,
        max_completion_tokens: 100,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Transcribe únicamente el texto visible " +
                  "del logo o title treatment de esta imagen. " +
                  "No describas la imagen. " +
                  "No agregues explicaciones. " +
                  "Si no podés leerlo con confianza, responde UNKNOWN.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Groq Vision HTTP ${response.status}: ${body}`
    );
  }

  const json = JSON.parse(body);

  return (
    json.choices?.[0]?.message?.content?.trim() ??
    "UNKNOWN"
  );
}
const MARKETS = {
  ARG: {
  locale: "es-419",
  webPath: "es-419",
  profileDir: "disney-qc-poc/auth/profiles/arg",
  qcRegion: "LATAM",
  label: "Argentina",
},

MX: {
  locale: "es-419",
  webPath: "es-419",
  profileDir: "disney-qc-poc/auth/profiles/mx",
  qcRegion: "LATAM",
  label: "México",
},

  BR: {
  locale: "pt-BR",
  webPath: "pt-br",
  profileDir: "disney-qc-poc/auth/profiles/br",
  qcRegion: "BR",
  label: "Brasil",
},
};


const QC_REGIONS = {
  LATAM: {
    audio: ["es-419", "en", "pt-BR"],
    subtitles: ["es-419", "en", "pt-BR"],
    cc: ["es-419", "en", "pt-BR"],
    forced: ["es-419", "en", "pt-BR"],
  },

  BR: {
    audio: ["pt-BR", "en", "es-419"],
    subtitles: ["pt-BR", "en", "es-419"],
    cc: ["pt-BR", "en", "es-419"],
    forced: ["pt-BR", "en", "es-419"],
  },
};

function filterRegionalTracks(tracks, type) {
  const allowed =
    QC_REGIONS[QC_REGION]?.[type] ?? [];

  return tracks.filter((track) =>
    allowed.includes(track.language)
  );
}

const searchTitle = process.argv[2];

const arg3 = process.argv[3];
const arg4 = process.argv[4];
const arg5 = process.argv[5];

let seasonNumber = null;
let episodeNumber = null;
let market = "ARG";

const possibleMarket =
  (arg3 ?? "").toUpperCase();

if (MARKETS[possibleMarket]) {
  // Película:
  // qc.mjs "Camp Rock 3" ARG
  market = possibleMarket;
} else {
  // Serie:
  // qc.mjs "Modern Family" 3 12 ARG
  seasonNumber = Number(arg3);
  episodeNumber = Number(arg4);
  market = (arg5 ?? "ARG").toUpperCase();
}

if (!searchTitle) {
  console.error("");
  console.error("Uso:");
  console.error(
    'Serie: node disney-qc-poc\\scripts\\qc.mjs "<título>" <season> <episode> [ARG|MX|BR]'
  );
  console.error(
    'Película: node disney-qc-poc\\scripts\\qc.mjs "<título>" [ARG|MX|BR]'
  );
  console.error("");
  process.exit(1);
}

if (
  seasonNumber !== null &&
  (
    !Number.isInteger(seasonNumber) ||
    !Number.isInteger(episodeNumber) ||
    seasonNumber < 1 ||
    episodeNumber < 1
  )
) {
  console.error("");
  console.error(
    "Season y Episode deben ser números válidos."
  );
  console.error("");
  process.exit(1);
}const marketConfig = MARKETS[market];

if (!marketConfig) {
  console.error("");
  console.error(
    "Mercado inválido. Usá ARG, MX o BR."
  );
  console.error("");
  process.exit(1);
}

const QC_REGION = marketConfig.qcRegion;


function attr(line, name) {
  const match = line.match(
    new RegExp(`${name}=(?:"([^"]*)"|([^,]*))`)
  );

  return match
    ? (match[1] ?? match[2] ?? "").trim()
    : "";
}

function parseTracks(text) {
  const audio = new Map();
  const subtitles = new Map();
  const cc = new Map();
  const forced = new Map();

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("#EXT-X-MEDIA:")) continue;

    const type = attr(line, "TYPE");
    const name = attr(line, "NAME");
    const language = attr(line, "LANGUAGE");
    const uri = attr(line, "URI");

    if (!name && !language) continue;

    const track = {
      name,
      language,
      uri,
    };

    const key =
      `${name}|${language}`.toLowerCase();

    if (type === "AUDIO") {
      audio.set(key, track);
      continue;
    }

    if (type !== "SUBTITLES") continue;

    if (/forced/i.test(name)) {
      forced.set(key, track);
      continue;
    }

    if (
      /\bcc\b/i.test(name) ||
      /\[cc\]/i.test(name)
    ) {
      cc.set(key, track);
      continue;
    }

    subtitles.set(key, track);
  }

  return {
    audio: [...audio.values()],
    subtitles: [...subtitles.values()],
    cc: [...cc.values()],
    forced: [...forced.values()],
  };
}

function resolveUrl(baseUrl, relativeUrl) {
  return new URL(relativeUrl, baseUrl).href;
}

function parseVttCues(vtt) {
  const cues = [];

  const regex =
    /(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})/g;

  let match;

  while ((match = regex.exec(vtt)) !== null) {
    cues.push({
      start: match[1],
      end: match[2],
    });
  }

  return cues;
}

function dedupeCues(cues) {
  const seen = new Set();

  return cues.filter((cue) => {
    const key = `${cue.start}|${cue.end}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

// -----------------------------------------
// Browser / sesión Disney+
// -----------------------------------------

const context =
  await chromium.launchPersistentContext(
    path.resolve(marketConfig.profileDir),
    {
      headless: false,
      locale: marketConfig.locale,
      viewport: {
        width: 1440,
        height: 900,
      },
    }
  );

const pages = context.pages();

const page =
  pages[0] ?? await context.newPage();

// Capturar en memoria los headers que Disney utiliza
// para sus requests autenticadas a Explore.
// Nunca se imprimen ni se guardan en disco.
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

  if (!headers.authorization) {
    return;
  }

  disneyApiHeaders = {
    authorization: headers.authorization,
  };

  if (headers["x-bamsdk-client-id"]) {
    disneyApiHeaders["x-bamsdk-client-id"] =
      headers["x-bamsdk-client-id"];
  }

  if (headers["x-bamsdk-platform"]) {
    disneyApiHeaders["x-bamsdk-platform"] =
      headers["x-bamsdk-platform"];
  }

  if (headers["x-bamsdk-version"]) {
    disneyApiHeaders["x-bamsdk-version"] =
      headers["x-bamsdk-version"];
  }
if (headers["x-application-version"]) {
  disneyApiHeaders["x-application-version"] =
    headers["x-application-version"];
}
});

// -----------------------------------------
// Buscar contenido y resolver Series Entity
// -----------------------------------------

await page.goto(
  `https://www.disneyplus.com/${marketConfig.webPath}/home`,
  {
    waitUntil: "domcontentloaded",
  }
);

await page.waitForTimeout(4000);

if (!disneyApiHeaders) {
  console.log(
    "↻ No hubo request Explore inicial. Recargando una vez..."
  );

  await page.reload({
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(4000);
}

if (!disneyApiHeaders) {
  throw new Error(
    "No pude capturar la autorización de Disney Explore."
  );
}

console.log("");
console.log(`🔎 Buscando "${searchTitle}"...`);

const searchUrl =
  "https://disney.api.edge.bamgrid.com/explore/v1.18/search" +
  `?query=${encodeURIComponent(searchTitle)}`;

const searchResponse =
  await context.request.get(searchUrl, {
    headers: disneyApiHeaders,
  });

if (!searchResponse.ok()) {
  throw new Error(
    `Search API HTTP ${searchResponse.status()}`
  );
}

const searchJson =
  await searchResponse.json();

const searchItems =
  searchJson?.data?.page?.containers?.flatMap(
    (container) => container.items ?? []
  ) ?? [];

const normalizedSearch =
  searchTitle.trim().toLowerCase();

const seriesResult =
  searchItems.find((item) => {
    const title =
      item.visuals?.title?.trim().toLowerCase();

    return (
      title === normalizedSearch &&
      item.actions?.some(
        (action) => action.type === "browse"
      )
    );
  }) ??
  searchItems.find((item) =>
    item.actions?.some(
      (action) => action.type === "browse"
    )
  );

if (!seriesResult?.id) {
  throw new Error(
    `No encontré "${searchTitle}" en Disney+.`
  );
}

const SERIES =
  seriesResult.visuals?.title ?? searchTitle;

const seriesEntity =
  seriesResult.id;

console.log(
  `✓ Encontrado: ${SERIES}`
);

console.log(
  `✓ Entity: ${seriesEntity}`
);


await page.goto(
  `https://www.disneyplus.com/${marketConfig.webPath}/browse/entity-${seriesEntity}`,
  {
    waitUntil: "domcontentloaded",
  }

);
// -----------------------------------------
// Title Treatment
// -----------------------------------------

const titleTreatment =
  seriesResult.visuals?.artwork?.standard
    ?.title_treatment;

let titleTreatmentImageId = null;

if (titleTreatment) {
  const preferredRatios = [
    "1.78",
    "3.32",
  ];

  for (const ratio of preferredRatios) {
    if (titleTreatment[ratio]?.imageId) {
      titleTreatmentImageId =
        titleTreatment[ratio].imageId;
      break;
    }
  }

  if (!titleTreatmentImageId) {
    const firstAvailable =
      Object.values(titleTreatment).find(
        (item) => item?.imageId
      );

    titleTreatmentImageId =
      firstAvailable?.imageId ?? null;
  }
}

console.log("");
console.log("🖼 TITLE TREATMENT");
console.log(`Metadata title: ${SERIES}`);

let titleTreatmentUrl = null;

if (titleTreatmentImageId) {
  titleTreatmentUrl =
    `https://disney.images.edge.bamgrid.com/` +
    `ripcut-delivery/v2/variant/disney/` +
    `${titleTreatmentImageId}/trim` +
    `?format=webp&max=800%7C300`;

  console.log(
    `✓ Image ID: ${titleTreatmentImageId}`
  );
} else {
  console.log(
    "— Title Treatment no disponible"
  );
}

if (titleTreatmentUrl) {
  const titleTreatmentResponse =
    await context.request.get(titleTreatmentUrl);

  if (!titleTreatmentResponse.ok()) {
    throw new Error(
      `Title Treatment HTTP ${titleTreatmentResponse.status()}`
    );
  }

  const contentType =
    titleTreatmentResponse.headers()["content-type"] ?? "";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `Title Treatment no devolvió una imagen (${contentType})`
    );
  }

  console.log(
    `✓ Title Treatment descargado: ${contentType}`
  );

    console.log("🔎 Leyendo Title Treatment...");

  try {
    const logoText =
      await readTitleTreatment(titleTreatmentUrl);

    console.log(`Logo: ${logoText}`);

    if (logoText.toUpperCase() === "UNKNOWN") {
      console.log(
        "⚠ No se pudo leer el texto del Title Treatment"
      );
    } else {
      const metadataNormalized =
        normalizeTitle(SERIES);

      const logoNormalized =
        normalizeTitle(logoText);

      if (metadataNormalized === logoNormalized) {
        console.log(
          "✓ TITLE TREATMENT MATCH"
        );
      } else {
        console.log(
          "⚠ TITLE TREATMENT MISMATCH"
        );

        console.log(
          `  Metadata: ${SERIES}`
        );

        console.log(
          `  Logo: ${logoText}`
        );
      }
    }
  } catch (error) {
    console.log(
      "⚠ No se pudo validar el Title Treatment"
    );

    console.log(
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
}
console.log("");

// -----------------------------------------
// Resolver contenido
// -----------------------------------------

const isSeries =
  seasonNumber !== null &&
  episodeNumber !== null;

let episode = null;
let playbackAction = null;
let contentEntity = null;
let contentTitle = SERIES;

function findSeasonId(value, targetSeason) {
  let found = null;

  function walk(node) {
    if (
      found ||
      !node ||
      typeof node !== "object"
    ) {
      return;
    }

    const season =
      Number(
        node.visuals?.seasonNumber ??
        node.seasonNumber
      );

    if (
      season === targetSeason &&
      typeof node.id === "string"
    ) {
      found = node.id;
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    Object.values(node).forEach(walk);
  }

  walk(value);

  return found;
}
if (isSeries) {
  console.log(
    `🔎 Resolviendo Temporada ${seasonNumber}...`
  );

await page.waitForLoadState("domcontentloaded");

await page.waitForTimeout(1500);

const popupClosed = await dismissDisneyPopup(page);

if (popupClosed) {
  console.log(
    "↻ Volviendo al contenido después del popup..."
  );

 await page.goto(
  `https://www.disneyplus.com/${marketConfig.webPath}/browse/entity-${seriesEntity}`,
  {
    waitUntil: "domcontentloaded",
  }
);

  await page.waitForTimeout(3000);

  await dismissDisneyPopup(page);
}


function findEpisodeIn(
  value,
  targetSeason,
  targetEpisode
) {
  let found = null;

  function walk(node) {
    if (
      !node ||
      typeof node !== "object" ||
      found
    ) {
      return;
    }

    if (
      Number(node.visuals?.seasonNumber) ===
        targetSeason &&
      Number(node.visuals?.episodeNumber) ===
        targetEpisode
    ) {
      found = node;
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    Object.values(node).forEach(walk);
  }

  walk(value);

  return found;
}

// -----------------------------------------
// Obtener Season ID desde Disney+
// -----------------------------------------

const seasonButton = page
  .locator('button[aria-haspopup="listbox"]')
  .filter({
    hasText: /Temporada\s*\d+/i,
  })
  .last();

await seasonButton.waitFor({
  state: "visible",
  timeout: 15000,
});

await seasonButton.click();

const seasonOption = page.locator(
  `li[role="option"][title="Temporada ${seasonNumber}"]`
);

await seasonOption.waitFor({
  state: "visible",
  timeout: 10000,
});

const seasonId =
  await seasonOption.getAttribute("id");

if (!seasonId) {
  throw new Error(
    `Temporada ${seasonNumber} no tiene Season ID.`
  );
}

console.log(
  `✓ Season ID: ${seasonId}`
);

// Cerrar selector sin depender de una request.
await seasonButton.click().catch(() => {});

// -----------------------------------------
// Consultar Season API con la misma
// autorización de la sesión Disney+
// -----------------------------------------

const seasonBaseUrl =
  `https://disney.api.edge.bamgrid.com/explore/v1.18/season/${seasonId}`;

console.log(
  `🔎 Buscando T${seasonNumber}:E${episodeNumber}...`
);

async function getSeasonPage(after = null) {
  const params = new URLSearchParams();

  params.set("limit", "24");

  if (after) {
    params.set("after", after);
  }

  const response =
    await context.request.get(
      `${seasonBaseUrl}?${params.toString()}`,
      {
        headers: disneyApiHeaders,
      }
    );

  if (!response.ok()) {
    throw new Error(
      `Season API HTTP ${response.status()}`
    );
  }

  return response.json();
}

// -----------------------------------------
// Primera página
// -----------------------------------------

const firstPageJson =
  await getSeasonPage();

episode = findEpisodeIn(
  firstPageJson,
  seasonNumber,
  episodeNumber
);

// -----------------------------------------
// Páginas siguientes
//
// Disney confirmó que "after" representa
// un offset codificado en Base64.
// -----------------------------------------

let offset = 24;

while (!episode && offset < 200) {
  const after = Buffer.from(
    JSON.stringify({
      offset,
    })
  ).toString("base64");

  const nextPageJson =
    await getSeasonPage(after);

  episode = findEpisodeIn(
    nextPageJson,
    seasonNumber,
    episodeNumber
  );

  if (episode) {
    break;
  }

  offset += 24;
}

if (!episode) {
  throw new Error(
    `No encontré T${seasonNumber}:E${episodeNumber}.`
  );
}

console.log(
  `✓ T${seasonNumber}:E${episodeNumber} encontrado`
);
  playbackAction =
    episode.actions?.find(
      (action) => action.type === "playback"
    );

  contentEntity =
    playbackAction?.deeplinkId ?? episode.id;

  if (!contentEntity) {
    throw new Error(
      "El episodio no tiene Episode Entity."
    );
  }

  contentTitle =
    episode.visuals?.episodeTitle ?? SERIES;

} else {
  console.log("🎬 Resolviendo película...");

  let moviePlaybackAction = null;

  const findPlayback = (value) => {
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
  };

  const captureMoviePlayback =
    async (response) => {
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

        const found = findPlayback(body);

        if (found) {
          moviePlaybackAction = found;
        }
      } catch {
        // Ignorar responses no utilizables.
      }
    };

  page.on(
    "response",
    captureMoviePlayback
  );

  await page.goto(
    `https://www.disneyplus.com/${marketConfig.webPath}/browse/entity-${seriesEntity}`,
    {
      waitUntil: "domcontentloaded",
    }
  );

  const movieTimeout =
    Date.now() + 10000;

  while (
    !moviePlaybackAction &&
    Date.now() < movieTimeout
  ) {
    await page.waitForTimeout(250);
  }

  page.off(
    "response",
    captureMoviePlayback
  );

  if (!moviePlaybackAction) {
    throw new Error(
      "No encontré Playback Action para la película."
    );
  }

  playbackAction = moviePlaybackAction;

  contentEntity =
    playbackAction.deeplinkId ??
    seriesEntity;

  contentTitle = SERIES;

  console.log(
    "✓ Playback de película encontrado"
  );
}
console.log("");
console.log("====================================");
console.log("DISNEY+ QC");
console.log("====================================");

if (isSeries) {
  console.log(
    `${SERIES} · T${seasonNumber}:E${episodeNumber}`
  );
  console.log(`Título: ${contentTitle}`);
} else {
  console.log(`${contentTitle}`);
  console.log("Tipo: Película");
}

console.log(`Mercado: ${marketConfig.label}`);
console.log("====================================");
console.log("");// -----------------------------------------
// 2. Capturar Master HLS
// -----------------------------------------

let playbackStarted = false;
let result = null;

page.on("response", async (response) => {
  if (!playbackStarted || result) return;

  try {
    const url = response.url();

    if (
      !url.includes("ctr-all") &&
      !url.includes(".m3u8")
    ) {
      return;
    }

    const body = await response.text();

    if (
      !body.startsWith("#EXTM3U") ||
      !body.includes("#EXT-X-MEDIA:")
    ) {
      return;
    }

    const tracks = parseTracks(body);

    if (!tracks.audio.length) {
      return;
    }

    result = {
      ...tracks,
      masterUrl: url,
    };
  } catch {
    // Ignorar respuestas no legibles.
  }
});
const expectedMediaId =
  playbackAction?.internalTitle
    ?.match(/mediaId:([0-9a-f-]+)/i)?.[1] ??
  null;

const playbackId =
  playbackAction?.resourceId;

if (!playbackId) {
  throw new Error(
    "El contenido no tiene playback resourceId."
  );
}

if (isSeries) {
  console.log(
    `▶ Iniciando playback específico T${seasonNumber}:E${episodeNumber}...`
  );
} else {
  console.log(
    "▶ Iniciando playback de película..."
  );
}

if (expectedMediaId) {
  console.log(
    `✓ Media ID esperado: ${expectedMediaId}`
  );
}

// -----------------------------------------
// Capturar headers de Playback en memoria.
//
// Disney hace requests autenticadas de playback
// durante la sesión. Los valores nunca se
// imprimen ni se guardan en disco.
// -----------------------------------------

let playbackHeaders = null;

const capturePlaybackHeaders = async (request) => {
  const url = request.url();

  if (
    !url.includes(
      "disney.playback.edge.bamgrid.com/v7/playback/"
    )
  ) {
    return;
  }

  const headers =
    await request.allHeaders();

  if (!headers.authorization) {
    return;
  }

  const allowedHeaderNames = [
    "authorization",
    "content-type",
    "x-application-version",
    "x-bamsdk-client-id",
    "x-bamsdk-platform",
    "x-bamsdk-version",
    "x-dss-edge-accept",
    "x-dss-feature-filtering",
  ];

  playbackHeaders = {};

  for (const name of allowedHeaderNames) {
    if (headers[name]) {
      playbackHeaders[name] =
        headers[name];
    }
  }
};

page.on(
  "request",
  capturePlaybackHeaders
);

// -----------------------------------------
// Primero intentar aprovechar headers que
// ya conocemos de la sesión Explore.
// -----------------------------------------

playbackHeaders = {
  ...disneyApiHeaders,
  "content-type": "application/json",
};

console.log(
  "▶ Solicitando playback del contenido..."
);

const playbackSessionId =
  crypto.randomUUID();

const playbackBody = {
  playback: {
    attributes: {
      resolution: {
        max: [
          "1280x720",
        ],
      },
      protocol: "HTTPS",
      assetInsertionStrategies: {
        point: "SGAI",
        range: "SGAI",
      },
      playbackInitiationContext:
        "ONLINE",
      frameRates: [
        60,
      ],
      videoSegmentTypes: [
        "FMP4",
      ],
      maxSlideDuration:
        "15_MIN",
      promosSupported: true,
    },
    adTracking: {
      limitAdTrackingEnabled:
        "NOT_SUPPORTED",
      deviceAdId:
        "00000000-0000-0000-0000-000000000000",
      privacyOptOut: "NO",
    },
    tracking: {
      playbackSessionId,
    },
  },

  playbackId,

  allowedCreatives: [
    "VIDEO",
  ],

  allowedInsertionVisuals: [
    "PROMO_TEXT",
    "PROMO_FULL_TEXT",
    "ON_SCREEN_RATING",
    "TITLE_TREATMENT",
    "ON_SCREEN_ADVISORY",
  ],
};

playbackStarted = true;
result = null;

const playbackResponse =
  await context.request.post(
    "https://disney.playback.edge.bamgrid.com/v7/playback/ctr-regular",
    {
      headers: playbackHeaders,
      data: playbackBody,
    }
  );

if (!playbackResponse.ok()) {
  const errorBody =
    await playbackResponse.text();

  console.log("");
  console.log("🔎 PLAYBACK ERROR BODY");
  console.log(errorBody);
  console.log("");

  throw new Error(
    `Playback API HTTP ${playbackResponse.status()}`
  );
}

console.log(
  "✓ Playback API aceptó el contenido"
);

// -----------------------------------------
// Obtener directamente el Master HLS desde
// la respuesta de Playback.
//
// No necesitamos reproducir el video ni
// interactuar con DRM.
// -----------------------------------------

const playbackJson =
  await playbackResponse.json();

function findMasterUrl(value) {
  let found = null;

  function walk(node) {
    if (
      found ||
      node === null ||
      node === undefined
    ) {
      return;
    }

    if (typeof node === "string") {
      if (
        node.includes(".m3u8") &&
        node.includes("ctr-all")
      ) {
        found = node;
      }

      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (typeof node === "object") {
      Object.values(node).forEach(walk);
    }
  }

  walk(value);

  return found;
}

const masterUrl =
  findMasterUrl(playbackJson);

if (!masterUrl) {
  throw new Error(
    "Playback respondió correctamente, pero no encontré el Master HLS."
  );
}

if (
  expectedMediaId &&
  !masterUrl.includes(
    `/${expectedMediaId}/`
  )
) {
  throw new Error(
    `Master HLS incorrecto: esperaba mediaId ${expectedMediaId}`
  );
}

console.log(
  "✓ Master HLS corresponde al contenido solicitado"
);

const masterResponse =
  await context.request.get(masterUrl);

if (!masterResponse.ok()) {
  throw new Error(
    `Master HLS HTTP ${masterResponse.status()}`
  );
}

const masterBody =
  await masterResponse.text();

if (
  !masterBody.startsWith("#EXTM3U") ||
  !masterBody.includes("#EXT-X-MEDIA:")
) {
  throw new Error(
    "La respuesta encontrada no es un Master HLS válido."
  );
}

const tracks =
  parseTracks(masterBody);

if (!tracks.audio.length) {
  throw new Error(
    "El Master HLS no contiene tracks de audio."
  );
}

result = {
  ...tracks,
  masterUrl,
};

console.log(
  "✓ Manifest HLS validado"
);const timeout = Date.now() + 30000;

while (!result && Date.now() < timeout) {
  await page.waitForTimeout(250);
}

if (!result) {
  throw new Error(
    "No se detectó el Master HLS después de iniciar la reproducción."
  );
}

// -----------------------------------------
// 3. Resultado
// -----------------------------------------

function getTrackDisplayName(track) {
  const languageNames = {
    "es-419": "Spanish (Latin America)",
    "pt-BR": "Portuguese (Brazil)",
    en: "English",
  };

  if (/forced/i.test(track.name)) {
    return languageNames[track.language] ?? track.name;
  }

  return track.name;
}

function printTracks(title, tracks) {
  console.log(title);

  if (!tracks.length) {
    console.log("— Ninguno");
  } else {
    for (const track of tracks) {
      console.log(
        `✓ ${getTrackDisplayName(track)}` +
        (track.language
          ? ` [${track.language}]`
          : "")
      );
    }
  }

  console.log("");
}


printTracks(
  "🔊 DUBS / AUDIO",
  filterRegionalTracks(result.audio, "audio")
);

printTracks(
  "💬 SUBTITLES",
  filterRegionalTracks(
    result.subtitles,
    "subtitles"
  )
);

printTracks(
  "♿ CLOSED CAPTIONS",
  filterRegionalTracks(result.cc, "cc")
);

printTracks(
  "⚡ FORCED NARRATIVES",
  filterRegionalTracks(result.forced, "forced")
);

await context.close();

console.log("🏁 QC finalizado.");