import { chromium } from "playwright";
import fs from "node:fs";

const AUTH_FILE = "disney-qc-poc/auth/disney-arg.json";

console.log("🇦🇷 Disney+ QC · Configuración cuenta Argentina");

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext();

const page = await context.newPage();

await page.goto("https://www.disneyplus.com", {
  waitUntil: "domcontentloaded",
});

console.log("");
console.log("👉 Iniciá sesión manualmente en Disney+.");
console.log("👉 Cuando estés dentro y veas el Home, volvé a esta ventana.");
console.log("👉 Presioná ENTER para guardar la sesión.");
console.log("");

await new Promise((resolve) => {
  process.stdin.once("data", resolve);
});

await context.storageState({
  path: AUTH_FILE,
});

console.log("");
console.log(`💾 Sesión guardada en ${AUTH_FILE}`);

await browser.close();

console.log("✅ Navegador cerrado.");