import { chromium } from "playwright";

const AUTH_FILE = "disney-qc-poc/auth/disney-arg.json";

console.log("🇦🇷 Disney+ QC · Probando sesión guardada");

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext({
  storageState: AUTH_FILE,
});

const page = await context.newPage();

await page.goto("https://www.disneyplus.com", {
  waitUntil: "domcontentloaded",
});

console.log("");
console.log("👉 Revisá el navegador.");
console.log("👉 Si Disney+ abrió directamente logueado, la persistencia funciona.");
console.log("👉 Volvé acá y presioná ENTER para cerrar.");

await new Promise((resolve) => {
  process.stdin.once("data", resolve);
});

await browser.close();

console.log("✅ Prueba finalizada.");