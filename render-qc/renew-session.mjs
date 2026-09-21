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
    const emailSelector = 'input[type="email"], input[name="email"], input[autocomplete="username"], input[name="loginValue"], input[type="text"]';
    let loginFrame = page.frames().find(frame => { try { return new URL(frame.url()).hostname === "login.disney.com"; } catch { return false; } }) || page.mainFrame();
    let email = loginFrame.locator(emailSelector).first();
    for (let attempt = 0; attempt < 12; attempt++) {
      for (const frame of [...page.frames()].sort((a, b) => Number(b.url().includes("login.disney.com")) - Number(a.url().includes("login.disney.com")))) {
        if (await frame.locator(emailSelector).first().isVisible().catch(() => false)) {
          loginFrame = frame;
          email = frame.locator(emailSelector).first();
          break;
        }
      }
      if (await email.isVisible().catch(() => false)) break;
      await page.waitForTimeout(750);
    }
    try {
      await email.waitFor({ state: "visible", timeout: 12000 });
    } catch {
      // Login may start at /home and require an explicit Sign in click.
      const signIn = page.getByRole("link", { name: /log in|sign in|iniciar sesi[oó]n|entrar|acessar|acceso/i }).or(
        page.getByRole("button", { name: /log in|sign in|iniciar sesi[oó]n|entrar|acessar|acceso/i })
      ).first();
      if (await signIn.isVisible().catch(() => false)) {
        stage = "open_login_from_landing";
        await signIn.click({ timeout: 8000 });
        stage = "find_email";
        await email.waitFor({ state: "visible", timeout: 12000 });
      } else {
        const location = new URL(page.url());
        const safePath = location.origin === "https://www.disneyplus.com" ? location.pathname : location.hostname + location.pathname;
        const fields = await page.locator("input").evaluateAll(nodes => nodes.map(node => ({
          type: node.getAttribute("type") || "text",
          name: node.getAttribute("name") || "",
          autocomplete: node.getAttribute("autocomplete") || "",
        })).slice(0, 10)).catch(() => []);
        const frameCount = page.frames().length;
        const frameInputs = await Promise.all(page.frames().map(async frame => ({ location: (() => { try { const u = new URL(frame.url()); return { host: u.hostname, path: u.pathname }; } catch { return { host: "unknown", path: "" }; } })(), inputs: await frame.locator("input").count().catch(() => 0), textLength: await frame.locator("body").evaluate(el => (el.innerText || "").length).catch(() => 0) })));
        console.error("QC renewal frame diagnostic:", JSON.stringify(frameInputs));
        console.error("QC renewal navigation diagnostic:", JSON.stringify(navigation.slice(-12)));
        console.error("QC renewal failed requests:", JSON.stringify(failedRequests.slice(-12)));
        const bodyLength = await page.locator("body").evaluate(node => (node.innerText || "").length).catch(() => 0);
        const titleLength = (await page.title().catch(() => "")).length;
        console.error("QC renewal login diagnostic:", JSON.stringify({ path: safePath, inputs: fields, frameCount, bodyLength, titleLength }));
        return { ok: false, stage: "find_email", message: `Disney+ no mostró el formulario. Pantalla: ${safePath}. Texto: ${bodyLength} caracteres; frames: ${frameCount}. Revisá en Render las líneas QC renewal navigation diagnostic, frame diagnostic y failed requests (sin compartir datos de sesión).` };
      }
    }
    // Re-resolve the field after iframe navigation; never reuse a stale frame locator.
    for (const frame of page.frames()) {
      if (await frame.locator(emailSelector).first().isVisible().catch(() => false)) {
        loginFrame = frame;
        email = frame.locator(emailSelector).first();
        break;
      }
    }
    stage = "fill_email";
    await email.fill(EMAILS[market]);
    const passwordInput = loginFrame.locator('input[type="password"]').first();
    if (!(await passwordInput.isVisible().catch(() => false))) {
      const next = loginFrame.getByRole("button", { name: /continuar|continue|siguiente|next|entrar|log in|iniciar sesión/i }).first();
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
