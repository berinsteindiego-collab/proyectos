import { chromium } from "playwright";

const AUTH_FILE =
  "disney-qc-poc/auth/disney-arg.json";

const EPISODE_ENTITY =
  "239d00bd-eea9-4976-8730-2536dc51f02f";

const EPISODE_URL =
  `https://www.disneyplus.com/es-419/browse/entity-${EPISODE_ENTITY}`;

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

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("#EXT-X-MEDIA:")) continue;

    const type = attr(line, "TYPE");
    const name = attr(line, "NAME");
    const language = attr(line, "LANGUAGE");

    if (!name && !language) continue;

    const key =
      `${name}|${language}`.toLowerCase();

    const track = {
      name,
      language,
    };

    if (type === "AUDIO") {
      audio.set(key, track);
    }

    if (type === "SUBTITLES") {
      subtitles.set(key, track);
    }
  }

  return {
    audio: [...audio.values()],
    subtitles: [...subtitles.values()],
  };
}

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext({
  storageState: AUTH_FILE,
});

const page = await context.newPage();

let result = null;

page.on("response", async (response) => {
  if (result) return;

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

    if (
      tracks.audio.length === 0 &&
      tracks.subtitles.length === 0
    ) {
      return;
    }

    result = {
      url,
      ...tracks,
    };

    console.log("");
    console.log("====================================");
    console.log("🇦🇷 DISNEY+ QC · ARG");
    console.log("Modern Family · T11:E1");
    console.log("====================================");

    console.log("");
    console.log("🔊 AUDIO");

    for (const track of result.audio) {
      console.log(
        `✓ ${track.name}` +
        (track.language
          ? ` [${track.language}]`
          : "")
      );
    }

    console.log("");
    console.log("💬 SUBTITLES");

    for (const track of result.subtitles) {
      console.log(
        `✓ ${track.name}` +
        (track.language
          ? ` [${track.language}]`
          : "")
      );
    }

    console.log("");
    console.log("✅ Master HLS capturado");
    console.log("====================================");

  } catch {
    // Ignoramos respuestas no legibles
  }
});

console.log("🇦🇷 Disney QC ARG");
console.log(`Episode Entity: ${EPISODE_ENTITY}`);
console.log("");
console.log("Abriendo episodio...");

await page.goto(EPISODE_URL, {
  waitUntil: "domcontentloaded",
});

console.log("");
console.log(
  "👉 Si aparece la ficha del episodio, iniciá la reproducción."
);
console.log(
  "👉 No abras DevTools. El script está escuchando Network."
);
console.log("");

while (!result) {
  await page.waitForTimeout(250);
}

await context.storageState({
  path: AUTH_FILE,
});

await page.waitForTimeout(1000);

await browser.close();

console.log("");
console.log("💾 Sesión ARG actualizada.");
console.log("🏁 QC finalizado.");