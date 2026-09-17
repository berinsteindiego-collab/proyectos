import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

// Toma una sesión ya logueada en el profile persistente local
// (la misma que usan qc.mjs / test-session.mjs) y la exporta como
// storageState en base64, lista para pegar como variable de entorno
// en Render (DISNEY_ARG_STORAGE_STATE / DISNEY_MX_STORAGE_STATE /
// DISNEY_BR_STORAGE_STATE).
//
// Uso:
//   node disney-qc-poc\scripts\export-render-session.mjs ARG|MX|BR

const market = (process.argv[2] ?? "").toUpperCase();

const MARKETS = {
  ARG: {
    locale: "es-419",
    webPath: "es-419",
    profileDir: "disney-qc-poc/auth/profiles/arg",
    envVar: "DISNEY_ARG_STORAGE_STATE",
  },

  MX: {
    locale: "es-419",
    webPath: "es-419",
    profileDir: "disney-qc-poc/auth/profiles/mx",
    envVar: "DISNEY_MX_STORAGE_STATE",
  },

  BR: {
    locale: "pt-BR",
    webPath: "pt-br",
    profileDir: "disney-qc-poc/auth/profiles/br",
    envVar: "DISNEY_BR_STORAGE_STATE",
  },
};

const config = MARKETS[market];

if (!config) {
  console.error("");
  console.error(
    "Uso: node disney-qc-poc\\scripts\\export-render-session.mjs ARG|MX|BR"
  );
  console.error("");
  process.exit(1);
}

const profileDir = path.resolve(config.profileDir);

if (!fs.existsSync(profileDir)) {
  console.error("");
  console.error(
    `✗ No existe ${profileDir}.`
  );
  console.error(
    `  Corré primero: node disney-qc-poc\\scripts\\setup-session.mjs ${market}`
  );
  console.error("");
  process.exit(1);
}

console.log("");
console.log(`🔎 Abriendo profile persistente ${market}...`);

const context = await chromium.launchPersistentContext(
  profileDir,
  {
    headless: false,
    locale: config.locale,
    viewport: {
      width: 1440,
      height: 900,
    },
  }
);

const page = context.pages()[0] ?? (await context.newPage());

await page.goto(
  `https://www.disneyplus.com/${config.webPath}/home`,
  {
    waitUntil: "domcontentloaded",
  }
);

await page.waitForTimeout(4000);

const url = page.url();

if (/login|identity|welcome/i.test(url)) {
  console.error("");
  console.error(
    `✗ ${market} no está logueado (URL: ${url}).`
  );
  console.error(
    `  Corré: node disney-qc-poc\\scripts\\setup-session.mjs ${market}`
  );
  console.error("  y volvé a intentar.");
  console.error("");

  await context.close();
  process.exit(1);
}

console.log(`✓ Sesión ${market} activa, exportando...`);

const storageState = await context.storageState();

await context.close();

const json = JSON.stringify(storageState);
const encoded = Buffer.from(json, "utf8").toString("base64");

const outDir = path.resolve("disney-qc-poc/auth/render-env");
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, `${market}.txt`);
fs.writeFileSync(outFile, encoded, "utf8");

console.log("");
console.log(`✓ Guardado en ${outFile}`);
console.log(`  Tamaño: ${(encoded.length / 1024).toFixed(1)} KB`);
console.log("");
console.log("Próximo paso en Render:");
console.log(`1. Abrí el servicio "render-qc" → Environment.`);
console.log(`2. Creá/actualizá la variable ${config.envVar}.`);
console.log(`3. Pegá como valor el contenido íntegro de ese archivo.`);
console.log(`4. Guardá y esperá el redeploy automático.`);
console.log("");
console.log(
  "Repetí este script cuando la sesión expire (Disney eventualmente" +
  " la invalida) para volver a generar el valor y actualizar Render."
);
console.log("");
