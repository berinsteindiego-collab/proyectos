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
  let stage = "launch";
  try {
    browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
    stage = "context";
    context = await browser.newContext({ locale: config.locale, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    let authorized = false;
    const navigation = [];
    const failedRequests = [];
    page.on("response", response => {
      if (!response.request().isNavigationRequest()) return;
      try { const u = new URL(response.url()); navigation.push({ host: u.hostname, path: u.pathname, status: response.status() }); } catch {}
    });
    page.on("requestfailed", request => {
      try { const u = new URL(request.url()); failedRequests.push({ host: u.hostname, kind: request.resourceType(), error: request.failure()?.errorText?.slice(0, 70) || "failed" }); } catch {}
    });
    page.on("response", response => {
      if (response.url().startsWith("https://disney.api.edge.bamgrid.com/explore/") && response.status() >= 200 && response.status() < 300) authorized = true;
    });
    stage = "open_login";
    // Enter via the supported home route: direct /login may render an empty SPA shell.
    await page.goto(disneyUrl(config.webPath, "home"), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3500);
    const landingLogin = page.getByRole("link", { name: /log in|sign in|iniciar sesi[oó]n|entrar|acessar|acceso/i }).or(page.getByRole("button", { name: /log in|sign in|iniciar sesi[oó]n|entrar|acessar|acceso/i })).first();
    if (await landingLogin.isVisible().catch(() => false)) await landingLogin.click({ timeout: 8000 });
    stage = "find_email";
    // Disney's identity UI is embedded in a cross-origin login.disney.com iframe.
    // Locate the actual visible field there, not in the empty Disney+ SPA shell
    // or in the reCAPTCHA iframe.
    const emailSelector = 'input[type="email"], input[name="email"], input[autocomplete="username"], input[name="loginValue"], input[type="text"]';
    let loginFrame;
    let email;
    for (let attempt = 0; attempt < 35; attempt++) {
      for (const frame of page.frames()) {
        if (!frame.url().startsWith("https://login.disney.com/")) continue;
        const candidate = frame.locator(emailSelector).filter({ visible: true }).first();
        if (await candidate.count().catch(() => 0)) {
          loginFrame = frame;
          email = candidate;
          break;
        }
      }
      if (email) break;
      await page.waitForTimeout(500);
    }
    if (!email) {
      const frames = await Promise.all(page.frames().map(async frame => {
        let host = "unknown";
        try { host = new URL(frame.url()).hostname; } catch {}
        if (host !== "login.disney.com") return { host, fields: 0 };
        const fields = await frame.locator("input").evaluateAll(nodes => nodes.map(node => ({
          type: node.getAttribute("type") || "",
          name: node.getAttribute("name") || "",
          autocomplete: node.getAttribute("autocomplete") || "",
          visible: Boolean(node.getClientRects().length),
        })).slice(0, 8)).catch(() => []);
        return { host, fields };
      }));
      console.error("QC renewal identity frame fields:", JSON.stringify(frames));
      return { ok: false, stage: "find_email", message: "No se encontró el campo de correo dentro del iframe de Disney. Revisá QC renewal identity frame fields en Render." };
    }
    stage = "fill_email";
    await email.fill(EMAILS[market]);
    let passwordInput = loginFrame.locator('input[type="password"]').first();
    if (!(await passwordInput.isVisible().catch(() => false))) {
      const next = loginFrame.getByRole("button", { name: /continuar|continue|siguiente|next|entrar|log in|iniciar sesión|seguir/i }).or(loginFrame.locator('button[type="submit"], input[type="submit"]')).first();
      stage = "continue_to_password";
      await next.click({ timeout: 10000 });
    }
    stage = "find_password";
    await passwordInput.waitFor({ state: "visible", timeout: 25000 });
    stage = "submit_password";
    await passwordInput.fill(password);
    await passwordInput.press("Enter");
    stage = "verify_login";
    const deadline = Date.now() + 30000;
    while (!authorized && Date.now() < deadline) {
      if (/challenge|verify|verification|otp|one-time|code/i.test(new URL(page.url()).pathname)) {
        return { ok: false, stage: "verification", message: "Disney+ solicita una verificación adicional. No se guardó ninguna sesión." };
      }
      await page.waitForTimeout(1000);
    }
    if (!authorized) {
      return { ok: false, stage: "login", message: "Disney+ no confirmó el login automático. Puede haber cambiado el formulario o requerir verificación." };
    }
    stage = "capture_session";
    const state = await context.storageState();
    stage = "save_session";
    await saveSession(market, state);
    return { ok: true, stage: "saved", message: "Sesión renovada y guardada. Comprobá la sesión antes de ejecutar QC." };
  } catch (error) {
    const kind = error instanceof Error ? error.name : "unknown";
    console.error("QC renewal failed at stage:", stage, "error type:", kind);
    const labels = { launch: "iniciar Chromium", context: "preparar el navegador", open_login: "abrir Disney+", open_login_from_landing: "abrir el login desde Disney+", find_email: "encontrar el campo de correo", fill_email: "completar el correo", continue_to_password: "avanzar a la contraseña", find_password: "encontrar el campo de contraseña", submit_password: "enviar el login", verify_login: "confirmar el login", capture_session: "capturar la sesión", save_session: "guardar la sesión" };
    return { ok: false, stage, message: `Falló al ${labels[stage] || "renovar la sesión"} (${kind}). No se guardó una sesión nueva.` };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
