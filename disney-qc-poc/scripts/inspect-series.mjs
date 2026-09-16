import { chromium } from "playwright";
import fs from "node:fs";

const AUTH_FILE = "disney-qc-poc/auth/disney-arg.json";

const SERIES_URL =
  "https://www.disneyplus.com/es-419/browse/entity-943f5577-caad-4e34-a8d3-4a9a816d078a";

const RESULTS_FILE =
  "disney-qc-poc/results/modern-family-network.json";

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext({
  storageState: AUTH_FILE,
});

const page = await context.newPage();

const matches = [];

page.on("response", async (response) => {
  try {
    const contentType =
      response.headers()["content-type"] || "";

    if (!contentType.includes("json")) return;

    const url = response.url();
    const text = await response.text();

    // Guardamos solamente respuestas potencialmente relacionadas
    // con catálogo / entities / episodios.
    if (
      text.includes("943f5577-caad-4e34-a8d3-4a9a816d078a") ||
      text.toLowerCase().includes("modern family") ||
      text.includes("episodeNumber") ||
      text.includes("seasonNumber")
    ) {
      matches.push({
        url,
        body: text,
      });

      console.log("");
      console.log("🎯 Respuesta relevante encontrada");
      console.log(url);
    }
  } catch {
    // Algunas respuestas no permiten leer el body.
  }
});

console.log("🇦🇷 Disney QC ARG");
console.log("🔎 Abriendo Modern Family...");

await page.goto(SERIES_URL, {
  waitUntil: "domcontentloaded",
});

await page.waitForTimeout(8000);

console.log("");
console.log(`📦 Respuestas relevantes encontradas: ${matches.length}`);

fs.writeFileSync(
  RESULTS_FILE,
  JSON.stringify(matches, null, 2),
  "utf8"
);

console.log(`💾 Resultado guardado en: ${RESULTS_FILE}`);

console.log("");
console.log("👉 Mirá que Modern Family haya cargado correctamente.");
console.log("👉 Después presioná ENTER para cerrar.");

await new Promise((resolve) => {
  process.stdin.once("data", resolve);
});

// Actualizamos también la sesión ARG por si Disney+
// renovó cookies durante la navegación.
await context.storageState({
  path: AUTH_FILE,
});

await browser.close();

console.log("✅ Finalizado.");