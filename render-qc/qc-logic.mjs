// Lógica real de QC (Disney+), portada de disney-qc-poc/scripts/qc.mjs
// para correr headless en Render, reutilizando una sesión ya restaurada
// (page/context) en vez de abrir su propio browser con
// launchPersistentContext + headless:false.

export const MARKETS = {
  ARG: {
    locale: "es-419",
    webPath: "es-419",
    seasonWord: "Temporada",
    qcRegion: "LATAM",
    label: "Argentina",
    secretFile: "disney-arg-storage-state.json",
  },

  MX: {
    // A propósito en inglés: el buscador de Disney+ matchea por el
    // título en el idioma de navegación (ej. "The Boss" / "El
    // Encargado" / "O Chefe"), así que esta cuenta se usa para poder
    // buscar títulos en inglés. El catálogo/región de la cuenta
    // sigue siendo México — el audio/subs reales del contenido no
    // cambian, solo el idioma en el que navegamos y buscamos.
    // OJO: disneyplus.com en inglés (US) no tiene segmento de idioma
    // en la URL (es "/home", no "/en/home") — por eso webPath queda
    // vacío acá, a diferencia de ARG/BR.
    locale: "en-US",
    webPath: "",
    seasonWord: "Season",
    qcRegion: "LATAM",
    label: "México (búsqueda EN)",
    secretFile: "disney-mx-storage-state.json",
  },

  BR: {
    // Igual que MX: sin segmento de idioma en la URL. Poniendo
    // "/pt-br/" a mano, Disney+ parece intentar normalizarlo con su
    // propia detección (basada en el Accept-Language de acá abajo)
    // y termina anteponiendo el suyo sin sacar el nuestro
    // ("pt-br/pt-BR/home", 404). Dejamos que decida solo.
    locale: "pt-BR",
    webPath: "",
    seasonWord: "Temporada",
    qcRegion: "BR",
    label: "Brasil",
    secretFile: "disney-br-storage-state.json",
  },
};

// Arma URLs de disneyplus.com respetando que el mercado en inglés no
// lleva segmento de idioma (webPath vacío) mientras que LATAM/BR sí.
export function disneyUrl(webPath, path) {
  return webPath
    ? `https://www.disneyplus.com/${webPath}/${path}`
    : `https://www.disneyplus.com/${path}`;
}

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

function filterRegionalTracks(tracks, type, qcRegion) {
  const allowed = QC_REGIONS[qcRegion]?.[type] ?? [];

  return tracks.filter((track) => allowed.includes(track.language));
}

function normalizeTitle(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\bdisney\+?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// El logo/title treatment muchas veces omite números de secuela o
// subtítulos que sí están en el título de metadata (ej: el logo dice
// "EL DIABLO VISTE A LA MODA" pero el título real es "El diablo viste
// a la moda 2"). Ya normalizamos mayúsculas/acentos en normalizeTitle;
// acá alcanza con que uno contenga al otro como texto completo, no
// que sean idénticos carácter por carácter.
function titlesMatch(metadataNormalized, logoNormalized) {
  if (!metadataNormalized || !logoNormalized) return false;

  return (
    metadataNormalized === logoNormalized ||
    metadataNormalized.includes(logoNormalized) ||
    logoNormalized.includes(metadataNormalized)
  );
}

async function dismissDisneyPopup(page) {
  const okButton = page.getByRole("button", { name: /^OK$/i });

  try {
    await okButton.waitFor({ state: "visible", timeout: 3000 });
    await okButton.click();
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

async function readTitleTreatment(imageUrl) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY no configurada");
  }

  // Groq devuelve 429 (rate limit) o 503 ("currently over capacity")
  // cuando el modelo de vision está saturado — es transitorio, así
  // que reintentamos con backoff en vez de rendirnos al primer golpe
  // (esto era lo que hacía aparecer "UNKNOWN"/"no disponible" en
  // logos perfectamente legibles).
  const maxAttempts = 3;
  const retryDelaysMs = [1500, 3000];

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
                  image_url: { url: imageUrl },
                },
              ],
            },
          ],
        }),
      }
    );

    const body = await response.text();

    if (
      (response.status === 429 || response.status === 503) &&
      attempt < maxAttempts
    ) {
      lastError = new Error(`Groq Vision HTTP ${response.status}: ${body}`);
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelaysMs[attempt - 1])
      );
      continue;
    }

    if (!response.ok) {
      throw new Error(`Groq Vision HTTP ${response.status}: ${body}`);
    }

    const json = JSON.parse(body);

    return json.choices?.[0]?.message?.content?.trim() ?? "UNKNOWN";
  }

  throw lastError ?? new Error("Groq Vision: no se pudo completar la solicitud.");
}

function attr(line, name) {
  const match = line.match(new RegExp(`${name}=(?:"([^"]*)"|([^,]*))`));

  return match ? (match[1] ?? match[2] ?? "").trim() : "";
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

    const track = { name, language, uri };
    const key = `${name}|${language}`.toLowerCase();

    if (type === "AUDIO") {
      audio.set(key, track);
      continue;
    }

    if (type !== "SUBTITLES") continue;

    if (/forced/i.test(name)) {
      forced.set(key, track);
      continue;
    }

    if (/\bcc\b/i.test(name) || /\[cc\]/i.test(name)) {
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

function findSeasonId(value, targetSeason) {
  let found = null;

  function walk(node) {
    if (found || !node || typeof node !== "object") return;

    const season = Number(node.visuals?.seasonNumber ?? node.seasonNumber);

    // Un episodio también trae seasonNumber (a qué temporada
    // pertenece), no solo el nodo de la temporada en sí. Si el nodo
    // además tiene episodeNumber, es un episodio — lo descartamos acá
    // para no devolver su id como si fuera el Season ID (causaba
    // "Season API HTTP 404" en shows de una sola temporada).
    const episodeNumber = node.visuals?.episodeNumber ?? node.episodeNumber;

    if (
      season === targetSeason &&
      episodeNumber === undefined &&
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

// Después de cargar /home, Disney+ puede redirigir a un prefijo de
// idioma distinto al que asumimos en MARKETS (ej. BR/MX sin prefijo
// configurado, pero el propio router de Disney+ decide servir
// "/pt-br/home"). Usamos el prefijo real resuelto en vez de nuestro
// guess estático para las navegaciones siguientes (evita el
// "page.goto interrupted by another navigation to .../pt-br/home").
function extractWebPath(currentUrl) {
  try {
    const { pathname } = new URL(currentUrl);
    const match = pathname.match(/^\/([a-z]{2}(?:-[a-zA-Z0-9]+)?)\/home(?:\/|$)/i);

    return match ? match[1] : "";
  } catch {
    return null;
  }
}

function findEpisodeIn(value, targetSeason, targetEpisode) {
  let found = null;

  function walk(node) {
    if (!node || typeof node !== "object" || found) return;

    if (
      Number(node.visuals?.seasonNumber) === targetSeason &&
      Number(node.visuals?.episodeNumber) === targetEpisode
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

function findMasterUrl(value) {
  let found = null;

  function walk(node) {
    if (found || node === null || node === undefined) return;

    if (typeof node === "string") {
      if (node.includes(".m3u8") && node.includes("ctr-all")) {
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

function findPlayback(value) {
  if (!value || typeof value !== "object") return null;

  if (value.type === "playback" && value.resourceId) {
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

// `page` y `context` ya tienen la sesión restaurada (storageState del
// secret file). Esta función asume que todavía no se navegó a
// disneyplus.com — hace todo el flujo de punta a punta y devuelve el
// resultado de QC, o tira un Error con un mensaje accionable.
export async function runQc({
  page,
  context,
  market,
  marketConfig,
  searchTitle,
  seasonNumber,
  episodeNumber,
}) {
  const isSeries = seasonNumber !== null && episodeNumber !== null;

  let disneyApiHeaders = null;

  page.on("request", (request) => {
    (async () => {
      if (disneyApiHeaders) return;

      const reqUrl = request.url();

      if (!reqUrl.includes("disney.api.edge.bamgrid.com/explore/")) {
        return;
      }

      const headers = await request.allHeaders();

      if (!headers.authorization) return;

      // El Playback API rechaza el request (400) si faltan estos
      // headers adicionales que la SPA manda junto con el
      // authorization — no alcanza con el bearer solo.
      disneyApiHeaders = { authorization: headers.authorization };

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
    })().catch((error) => {
      console.error("request listener error:", error);
    });
  });

  await page.goto(disneyUrl(marketConfig.webPath, "home"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  const deadline1 = Date.now() + 15000;

  while (!disneyApiHeaders && Date.now() < deadline1) {
    await page.waitForTimeout(500);
  }

  if (!disneyApiHeaders) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });

    const deadline2 = Date.now() + 15000;

    while (!disneyApiHeaders && Date.now() < deadline2) {
      await page.waitForTimeout(500);
    }
  }

  if (!disneyApiHeaders) {
    throw new Error(
      "No pude capturar la autorización de Disney Explore " +
      "(sesión restaurada pero la SPA no terminó de cargar)."
    );
  }

  // El webPath configurado en MARKETS es solo un punto de partida.
  // Derivamos el prefijo real a partir de a dónde nos terminó
  // llevando Disney+ al cargar /home, y usamos ese para el resto de
  // las navegaciones (browse/entity-...) en vez del guess estático.
  const effectiveWebPath = extractWebPath(page.url()) ?? marketConfig.webPath;

  // -----------------------------------------
  // Buscar contenido y resolver Series Entity
  // -----------------------------------------

  const searchUrl =
    "https://disney.api.edge.bamgrid.com/explore/v1.18/search" +
    `?query=${encodeURIComponent(searchTitle)}`;

  const searchResponse = await context.request.get(searchUrl, {
    headers: disneyApiHeaders,
  });

  if (!searchResponse.ok()) {
    throw new Error(`Search API HTTP ${searchResponse.status()}`);
  }

  const searchJson = await searchResponse.json();

  const searchItems =
    searchJson?.data?.page?.containers?.flatMap(
      (container) => container.items ?? []
    ) ?? [];

  const normalizedSearch = searchTitle.trim().toLowerCase();

  const seriesResult =
    searchItems.find((item) => {
      const title = item.visuals?.title?.trim().toLowerCase();

      return (
        title === normalizedSearch &&
        item.actions?.some((action) => action.type === "browse")
      );
    }) ??
    searchItems.find((item) =>
      item.actions?.some((action) => action.type === "browse")
    );

  if (!seriesResult?.id) {
    throw new Error(`No encontré "${searchTitle}" en Disney+.`);
  }

  const SERIES = seriesResult.visuals?.title ?? searchTitle;
  const seriesEntity = seriesResult.id;

  // Capturamos las respuestas de la API de Explore que dispara la
  // propia página al cargar. Sirve para resolver el Season ID sin
  // depender del selector de temporada clickeable — shows con una
  // sola temporada no lo muestran (no hay nada entre qué elegir).
  const entityPageJsonBodies = [];

  page.on("response", (response) => {
    (async () => {
      const respUrl = response.url();

      if (!respUrl.includes("disney.api.edge.bamgrid.com/explore/")) {
        return;
      }

      const contentType = response.headers()["content-type"] ?? "";

      if (!contentType.includes("json")) return;

      const body = await response.json().catch(() => null);

      if (body) entityPageJsonBodies.push(body);
    })().catch((error) => {
      console.error("entity page response listener error:", error);
    });
  });

  await page.goto(
    disneyUrl(effectiveWebPath, `browse/entity-${seriesEntity}`),
    { waitUntil: "domcontentloaded" }
  );

  // -----------------------------------------
  // Title Treatment (opcional: requiere GROQ_API_KEY)
  // -----------------------------------------

  let titleTreatmentResult = null;

  const titleTreatment =
    seriesResult.visuals?.artwork?.standard?.title_treatment;

  let titleTreatmentImageId = null;

  if (titleTreatment) {
    for (const ratio of ["1.78", "3.32"]) {
      if (titleTreatment[ratio]?.imageId) {
        titleTreatmentImageId = titleTreatment[ratio].imageId;
        break;
      }
    }

    if (!titleTreatmentImageId) {
      const firstAvailable = Object.values(titleTreatment).find(
        (item) => item?.imageId
      );

      titleTreatmentImageId = firstAvailable?.imageId ?? null;
    }
  }

  if (titleTreatmentImageId) {
    // jpeg + una resolución más alta que la original (800x300): el
    // recorte chico/comprimido en webp era una lectura más difícil
    // para el modelo de vision que el logo real (nítido) en Disney+.
    const titleTreatmentUrl =
      "https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/" +
      `${titleTreatmentImageId}/trim?format=jpeg&max=1200%7C450`;

    try {
      const titleTreatmentResponse =
        await context.request.get(titleTreatmentUrl);

      if (!titleTreatmentResponse.ok()) {
        throw new Error(`HTTP ${titleTreatmentResponse.status()}`);
      }

      const contentType =
        titleTreatmentResponse.headers()["content-type"] ?? "";

      if (!contentType.startsWith("image/")) {
        throw new Error(`No es imagen (${contentType})`);
      }

      const logoText = await readTitleTreatment(titleTreatmentUrl);
      const metadataNormalized = normalizeTitle(SERIES);
      const logoNormalized = normalizeTitle(logoText);

      titleTreatmentResult = {
        available: true,
        imageUrl: titleTreatmentUrl,
        metadataTitle: SERIES,
        logoText,
        match:
          logoText.toUpperCase() !== "UNKNOWN" &&
          titlesMatch(metadataNormalized, logoNormalized),
      };
    } catch (error) {
      titleTreatmentResult = {
        available: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } else {
    titleTreatmentResult = { available: false, error: "Sin title treatment" };
  }

  // -----------------------------------------
  // Resolver contenido (episodio o película)
  // -----------------------------------------

  let playbackAction = null;
  let contentTitle = SERIES;

  if (isSeries) {
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(4000);

    const popupClosed = await dismissDisneyPopup(page);

    if (popupClosed) {
      await page.goto(
        disneyUrl(effectiveWebPath, `browse/entity-${seriesEntity}`),
        { waitUntil: "domcontentloaded" }
      );

      await page.waitForTimeout(4000);
      await dismissDisneyPopup(page);
    }

    // 1) Shows de una sola temporada muchas veces no traen un nodo de
    // "temporada" aparte en la API (no hay nada entre qué elegir, así
    // que Disney+ no arma ese contenedor) — sólo los episodios
    // sueltos, cada uno ya con su propio seasonNumber/episodeNumber,
    // directo en las respuestas de la entity page. Probamos resolver
    // el episodio ahí primero, antes de meternos con Season ID.
    let episode = findEpisodeIn(
      entityPageJsonBodies,
      seasonNumber,
      episodeNumber
    );

    if (!episode) {
      const directDeadline = Date.now() + 8000;

      while (!episode && Date.now() < directDeadline) {
        await page.waitForTimeout(500);
        episode = findEpisodeIn(
          entityPageJsonBodies,
          seasonNumber,
          episodeNumber
        );
      }
    }

    if (!episode) {
      // 2) Shows con más de una temporada: resolvemos el Season ID de
      // las respuestas de API ya capturadas, sin clickear nada.
      let seasonId = findSeasonId(entityPageJsonBodies, seasonNumber);

      if (!seasonId) {
        const apiDeadline = Date.now() + 8000;

        while (!seasonId && Date.now() < apiDeadline) {
          await page.waitForTimeout(500);
          seasonId = findSeasonId(entityPageJsonBodies, seasonNumber);
        }
      }

      // 3) Último fallback: selector clickeable en el DOM
      // (button[aria-haspopup="listbox"]) — sólo si nada de lo
      // anterior encontró nada.
      if (!seasonId) {
        const seasonWordPattern = new RegExp(
          `${marketConfig.seasonWord}\\s*\\d+`,
          "i"
        );

        const seasonButton = page
          .locator('button[aria-haspopup="listbox"]')
          .filter({ hasText: seasonWordPattern })
          .last();

        try {
          await seasonButton.waitFor({ state: "visible", timeout: 15000 });
        } catch (error) {
          // Diagnóstico: si no aparece ni el selector ni lo resolvimos
          // por API, mostramos qué URL/texto quedó realmente en
          // pantalla (perfil, popup distinto, contenido no encontrado,
          // etc.) en vez de solo "timeout".
          const debugUrl = page.url();
          let bodySnippet = "";

          try {
            bodySnippet =
              (await page.textContent("body"))?.slice(0, 400) ?? "";
          } catch {
            // Ignorar si tampoco se puede leer el body.
          }

          throw new Error(
            `No pude resolver la temporada ${seasonNumber} ` +
            `(ni por episodio directo, ni por season ID, ni por selector). ` +
            `url=${debugUrl} body="${bodySnippet.replace(/\s+/g, " ").trim()}"`
          );
        }

        await seasonButton.click();

        const seasonOption = page.locator(
          `li[role="option"][title="${marketConfig.seasonWord} ${seasonNumber}"]`
        );

        await seasonOption.waitFor({ state: "visible", timeout: 20000 });

        seasonId = await seasonOption.getAttribute("id");

        if (!seasonId) {
          throw new Error(
            `${marketConfig.seasonWord} ${seasonNumber} no tiene Season ID.`
          );
        }

        await seasonButton.click().catch(() => {});
      }

      const seasonBaseUrl =
        `https://disney.api.edge.bamgrid.com/explore/v1.18/season/${seasonId}`;

      async function getSeasonPage(after = null) {
        const params = new URLSearchParams();
        params.set("limit", "24");
        if (after) params.set("after", after);

        const response = await context.request.get(
          `${seasonBaseUrl}?${params.toString()}`,
          { headers: disneyApiHeaders }
        );

        if (!response.ok()) {
          throw new Error(`Season API HTTP ${response.status()}`);
        }

        return response.json();
      }

      const firstPageJson = await getSeasonPage();

      episode = findEpisodeIn(firstPageJson, seasonNumber, episodeNumber);

      let offset = 24;

      while (!episode && offset < 200) {
        const after = Buffer.from(JSON.stringify({ offset })).toString(
          "base64"
        );

        const nextPageJson = await getSeasonPage(after);
        episode = findEpisodeIn(nextPageJson, seasonNumber, episodeNumber);

        if (episode) break;
        offset += 24;
      }

      if (!episode) {
        throw new Error(`No encontré T${seasonNumber}:E${episodeNumber}.`);
      }
    }

    playbackAction = episode.actions?.find(
      (action) => action.type === "playback"
    );

    if (!playbackAction?.resourceId && !episode.id) {
      throw new Error("El episodio no tiene Episode Entity.");
    }

    contentTitle = episode.visuals?.episodeTitle ?? SERIES;
  } else {
    let moviePlaybackAction = null;

    const captureMoviePlayback = async (response) => {
      if (moviePlaybackAction) return;

      const respUrl = response.url();

      if (!respUrl.includes("disney.api.edge.bamgrid.com/explore/")) return;

      try {
        const contentType = response.headers()["content-type"] ?? "";
        if (!contentType.includes("json")) return;

        const body = await response.json();
        const found = findPlayback(body);

        if (found) moviePlaybackAction = found;
      } catch {
        // Ignorar responses no utilizables.
      }
    };

    page.on("response", (response) => {
      captureMoviePlayback(response).catch((error) => {
        console.error("movie playback listener error:", error);
      });
    });

    await page.goto(
      disneyUrl(effectiveWebPath, `browse/entity-${seriesEntity}`),
      { waitUntil: "domcontentloaded" }
    );

    // 10s resultó corto en el free tier de Render (menos CPU que una
    // PC normal para que la SPA termine de pedir el detalle de la
    // película). Lo alargamos a 25s, como ya hicimos con las otras
    // esperas de este mismo servicio.
    const movieTimeout = Date.now() + 25000;

    while (!moviePlaybackAction && Date.now() < movieTimeout) {
      await page.waitForTimeout(250);
    }

    if (!moviePlaybackAction) {
      // Diagnóstico: en vez de solo "no encontré", mostramos dónde
      // quedó la página y qué texto hay, para poder distinguir un
      // timeout real de una navegación que terminó en otro lado
      // (login, popup, contenido no encontrado, etc.).
      const debugUrl = page.url();
      let bodySnippet = "";

      try {
        bodySnippet = (await page.textContent("body"))?.slice(0, 400) ?? "";
      } catch {
        // Ignorar si tampoco se puede leer el body.
      }

      throw new Error(
        "No encontré Playback Action para la película. " +
        `url=${debugUrl} body="${bodySnippet.replace(/\s+/g, " ").trim()}"`
      );
    }

    playbackAction = moviePlaybackAction;
    contentTitle = SERIES;
  }

  const expectedMediaId =
    playbackAction?.internalTitle?.match(/mediaId:([0-9a-f-]+)/i)?.[1] ??
    null;

  const playbackId = playbackAction?.resourceId;

  if (!playbackId) {
    throw new Error("El contenido no tiene playback resourceId.");
  }

  // -----------------------------------------
  // Playback + Master HLS
  // -----------------------------------------

  let result = null;

  page.on("response", (response) => {
    (async () => {
      if (result) return;

      const respUrl = response.url();

      if (!respUrl.includes("ctr-all") && !respUrl.includes(".m3u8")) {
        return;
      }

      const body = await response.text();

      if (!body.startsWith("#EXTM3U") || !body.includes("#EXT-X-MEDIA:")) {
        return;
      }

      const tracks = parseTracks(body);

      if (!tracks.audio.length) return;

      result = { ...tracks, masterUrl: respUrl };
    })().catch((error) => {
      console.error("hls response listener error:", error);
    });
  });

  const playbackSessionId = crypto.randomUUID();

  const playbackBody = {
    playback: {
      attributes: {
        resolution: { max: ["1280x720"] },
        protocol: "HTTPS",
        assetInsertionStrategies: { point: "SGAI", range: "SGAI" },
        playbackInitiationContext: "ONLINE",
        frameRates: [60],
        videoSegmentTypes: ["FMP4"],
        maxSlideDuration: "15_MIN",
        promosSupported: true,
      },
      adTracking: {
        limitAdTrackingEnabled: "NOT_SUPPORTED",
        deviceAdId: "00000000-0000-0000-0000-000000000000",
        privacyOptOut: "NO",
      },
      tracking: { playbackSessionId },
    },
    playbackId,
    allowedCreatives: ["VIDEO"],
    allowedInsertionVisuals: [
      "PROMO_TEXT",
      "PROMO_FULL_TEXT",
      "ON_SCREEN_RATING",
      "TITLE_TREATMENT",
      "ON_SCREEN_ADVISORY",
    ],
  };

  const playbackHeaders = {
    ...disneyApiHeaders,
    "content-type": "application/json",
  };

  const playbackResponse = await context.request.post(
    "https://disney.playback.edge.bamgrid.com/v7/playback/ctr-regular",
    { headers: playbackHeaders, data: playbackBody }
  );

  if (!playbackResponse.ok()) {
    const errorBody = await playbackResponse.text();

    throw new Error(
      `Playback API HTTP ${playbackResponse.status()}: ${errorBody.slice(0, 300)}`
    );
  }

  const playbackJson = await playbackResponse.json();
  const masterUrl = findMasterUrl(playbackJson);

  if (!masterUrl) {
    throw new Error(
      "Playback respondió correctamente, pero no encontré el Master HLS."
    );
  }

  if (expectedMediaId && !masterUrl.includes(`/${expectedMediaId}/`)) {
    throw new Error(
      `Master HLS incorrecto: esperaba mediaId ${expectedMediaId}`
    );
  }

  const masterResponse = await context.request.get(masterUrl);

  if (!masterResponse.ok()) {
    throw new Error(`Master HLS HTTP ${masterResponse.status()}`);
  }

  const masterBody = await masterResponse.text();

  if (!masterBody.startsWith("#EXTM3U") || !masterBody.includes("#EXT-X-MEDIA:")) {
    throw new Error("La respuesta encontrada no es un Master HLS válido.");
  }

  const tracks = parseTracks(masterBody);

  if (!tracks.audio.length) {
    throw new Error("El Master HLS no contiene tracks de audio.");
  }

  result = { ...tracks, masterUrl };

  const deadline3 = Date.now() + 10000;

  while (!result && Date.now() < deadline3) {
    await page.waitForTimeout(250);
  }

  if (!result) {
    throw new Error("No se detectó el Master HLS después de iniciar la reproducción.");
  }

  return {
    title: SERIES,
    contentTitle,
    market,
    marketLabel: marketConfig.label,
    isSeries,
    season: seasonNumber,
    episode: episodeNumber,
    titleTreatment: titleTreatmentResult,
    tracks: {
      audio: filterRegionalTracks(result.audio, "audio", marketConfig.qcRegion),
      subtitles: filterRegionalTracks(
        result.subtitles,
        "subtitles",
        marketConfig.qcRegion
      ),
      cc: filterRegionalTracks(result.cc, "cc", marketConfig.qcRegion),
      forced: filterRegionalTracks(
        result.forced,
        "forced",
        marketConfig.qcRegion
      ),
    },
    masterUrl: result.masterUrl,
  };
}
