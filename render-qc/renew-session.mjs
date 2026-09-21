import { chromium } from "playwright";
import { disneyUrl } from "./qc-logic.mjs";
import { saveSession } from "./session-store.mjs";

const EMAILS = { ARG: "testqc-arg@disneytesting.com", MX: "testqc-mx@disneytesting.com", BR: "testqc-br@disneytesting.com" };
const PASSWORD_KEYS = { ARG: "DISNEY_ARG_PASSWORD", MX: "DISNEY_MX_PASSWORD", BR: "DISNEY_BR_PASSWORD" };

export async function renewSession(market, config) {
  const password = process.env[PASSWORD_KEYS[market]];
  if (!password) return { ok: false, stage: "configuration", message: "Falta la contraseña de este mercado en Render." };
  let browser;
  let context;
  try {
    browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
    context = await browser.newContext({ locale: config.locale, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    let authorized = false;
    page.on("response", response => {
      if (response.url().startsWith("https://disney.api.edge.bamgrid.com/explore/") && response.status() >= 200 && response.status() < 300) authorized = true;
    });
    await page.goto(disneyUrl(config.webPath, "login"), { waitUntil: "domcontentloaded", timeout: 60000 });
    const email = page.locator('input[type="email"], input[name="email"], input[autocomplete="username"]').first();
    await email.waitFor({ state: "visible", timeout: 25000 });
    await email.fill(EMAILS[market]);
    const passwordInput = page.locator('input[type="password"]').first();
    if (!(await passwordInput.isVisible().catch(() => false))) {
      const next = page.getByRole("button", { name: /continuar|continue|siguiente|next|entrar|log in|iniciar sesión/i }).first();
      await next.click({ timeout: 10000 });
    }
    await passwordInput.waitFor({ state: "visible", timeout: 25000 });
    await passwordInput.fill(password);
    await passwordInput.press("Enter");
    const deadline = Date.now() + 45000;
    while (!authorized && Date.now() < deadline) {
      if (/challenge|verify|verification|otp|one-time|code/i.test(new URL(page.url()).pathname)) {
        return { ok: false, stage: "verification", message: "Disney+ solicita una verificación adicional. No se guardó ninguna sesión." };
      }
      await page.waitForTimeout(1000);
    }
    if (!authorized) {
      return { ok: false, stage: "login", message: "Disney+ no confirmó el login automático. Puede haber cambiado el formulario o requerir verificación." };
    }
    const state = await context.storageState();
    await saveSession(market, state);
    return { ok: true, stage: "saved", message: "Sesión renovada y guardada. Comprobá la sesión antes de ejecutar QC." };
  } catch (error) {
    console.error("QC renewal failed:", error instanceof Error ? error.name : "unknown");
    return { ok: false, stage: "error", message: "No se pudo completar la renovación. Revisá los logs de Render sin compartir contraseñas." };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
