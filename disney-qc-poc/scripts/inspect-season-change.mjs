import { chromium } from "playwright";
import fs from "node:fs";

const AUTH_FILE =
  "disney-qc-poc/auth/disney-arg.json";

const SERIES_URL =
  "https://www.disneyplus.com/es-419/browse/entity-943f5577-caad-4e34-a8d3-4a9a816d078a";

const OUTPUT =
  "disney-qc-poc/results/modern-family-season-change.json";

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext({
  storageState: AUTH_FILE,
});

const page = await context.newPage();

const captured = [];

page.on("response", async (response) => {
  try {
    const url = response.url();

    if (
      !url.includes("disney.api") &&
      !url.includes("disneyplus.com/api")
    ) {
      return;
    }

    const contentType =
      response.headers()["content-type"] || "";

    if (!contentType.includes("json")) return;

    const body = await response.text();

    if (
      !body.includes("seasonNumber") &&
      !body.includes("episodeNumber") &&
      !url.toLowerCase().includes("season")
    ) {
      return;
    }

    captured.push({
      url,
      status: response.status(),
      body,
    });

    console.log("📡", url);
  } catch {
    // ignorar respuestas no legibles
  }
});

console.log("Abriendo Modern Family...");

await page.goto(SERIES_URL, {
  waitUntil: "domcontentloaded",
});

await page.waitForTimeout(5000);

// Limpiamos la carga inicial.
// Solo queremos capturar lo que ocurra al cambiar de temporada.
captured.length = 0;

console.log("");
console.log("👉 En Disney+, cambiá manualmente de Season 11 a Season 5.");
console.log("👉 Esperá a que aparezcan los episodios de Season 5.");
console.log("👉 Después volvé acá y presioná ENTER.");
console.log("");

await new Promise((resolve) => {
  process.stdin.once("data", resolve);
});

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(captured, null, 2),
  "utf8"
);

await context.storageState({
  path: AUTH_FILE,
});

console.log("");
console.log(`📦 Requests capturados: ${captured.length}`);
console.log(`💾 ${OUTPUT}`);

await browser.close();

console.log("🏁 Finalizado.");