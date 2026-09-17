import http from "node:http";
import fs from "node:fs";
import { chromium } from "playwright";

const port = Number(process.env.PORT || 10000);

// Red de seguridad: un error suelto en un listener de Playwright
// (por ejemplo request.allHeaders() sobre una request ya descartada)
// es una "unhandled rejection" y por defecto Node mata todo el
// proceso con eso — lo que se ve desde afuera como un 502 constante
// hasta que Render reinicia el servicio. Logueamos y seguimos.
process.on("unhandledRejection", (error) => {
  console.error("unhandledRejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("uncaughtException:", error);
});

// Las sesiones se leen de Render "Secret Files" (no de env vars: el
// storageState de Disney+ es demasiado grande para pasar como
// variable de entorno y rompe el build con "argument list too long").
// Cada secret file se sube en Render con este mismo nombre y queda
// disponible en runtime en /etc/secrets/<filename>.
const SECRETS_DIR = "/etc/secrets";

const MARKETS = {
  ARG: {
    locale: "es-419",
    webPath: "es-419",
    secretFile: "disney-arg-storage-state.json",
  },

  MX: {
    locale: "es-419",
    webPath: "es-419",
    secretFile: "disney-mx-storage-state.json",
  },

  BR: {
    locale: "pt-BR",
    webPath: "pt-br",
    secretFile: "disney-br-storage-state.json",
  },
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
  });

  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "disney-qc-render",
    });
  }

  if (url.pathname === "/browser-test") {
    let browser;

    try {
      browser = await chromium.launch({
        headless: true,
      });

      return sendJson(res, 200, {
        ok: true,
        message: "Playwright y Chromium funcionan en Render",
        chromiumVersion: browser.version(),
      });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (browser) await browser.close();
    }
  }

  if (url.pathname === "/qc-test") {
    let browser;

    const market = (
      url.searchParams.get("market") ?? "ARG"
    ).toUpperCase();

    const config = MARKETS[market];

    if (!config) {
      return sendJson(res, 400, {
        ok: false,
        error: `Mercado inválido: ${market}. Usá ARG, MX o BR.`,
      });
    }

    try {
      const secretPath = `${SECRETS_DIR}/${config.secretFile}`;

      if (!fs.existsSync(secretPath)) {
        throw new Error(
          `Secret file no encontrado: ${secretPath}. ` +
          `Subí "${config.secretFile}" en Render → Environment → Secret Files.`
        );
      }

      const storageState = JSON.parse(
        fs.readFileSync(secretPath, "utf8")
      );

      browser = await chromium.launch({
        headless: true,
      });

      const context = await browser.newContext({
        storageState,
        locale: config.locale,
        viewport: {
          width: 1440,
          height: 900,
        },
      });

      const page = await context.newPage();

      let disneyApiHeaders = null;

      // Diagnóstico: cualquier request/response relevante a Disney/BAM,
      // y cualquier error de consola/página. Nos sirve para ver *qué*
      // está pasando cuando no se captura el authorization header.
      const bamRequests = [];
      const consoleErrors = [];
      const pageErrors = [];

      page.on("request", (request) => {
        // No hacemos la lógica async directo adentro del listener:
        // si algo tira acá (request ya descartada, etc.) y no hay
        // catch, Node mata todo el proceso. Encapsulamos en una
        // promesa con .catch() propio.
        (async () => {
          const reqUrl = request.url();

          if (
            reqUrl.includes("bamgrid.com") ||
            reqUrl.includes("disneyplus.com/graphql") ||
            reqUrl.includes("execute-api")
          ) {
            const headers = await request.allHeaders();

            bamRequests.push({
              url: reqUrl,
              hasAuth: Boolean(headers.authorization),
            });

            if (
              !disneyApiHeaders &&
              reqUrl.includes(
                "disney.api.edge.bamgrid.com/explore/"
              ) &&
              headers.authorization
            ) {
              disneyApiHeaders = {
                authorization: headers.authorization,
              };
            }
          }
        })().catch((error) => {
          console.error("request listener error:", error);
        });
      });

      page.on("response", (response) => {
        try {
          const resUrl = response.url();

          if (resUrl.includes("bamgrid.com") && response.status() >= 400) {
            bamRequests.push({
              url: resUrl,
              status: response.status(),
              error: true,
            });
          }
        } catch (error) {
          console.error("response listener error:", error);
        }
      });

      page.on("console", (msg) => {
        try {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text().slice(0, 300));
          }
        } catch (error) {
          console.error("console listener error:", error);
        }
      });

      page.on("pageerror", (error) => {
        pageErrors.push(String(error).slice(0, 300));
      });

      await page.goto(
        `https://www.disneyplus.com/${config.webPath}/home`,
        {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        }
      );

      await page.waitForTimeout(6000);

      if (!disneyApiHeaders) {
        await page.reload({
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        await page.waitForTimeout(6000);
      }

      const finalUrl = page.url();

      let screenshotBase64 = null;

      if (url.searchParams.get("debug") === "1") {
        const buffer = await page.screenshot({ type: "jpeg", quality: 40 });
        screenshotBase64 = buffer.toString("base64");
      }

      await context.close();

      return sendJson(res, 200, {
        ok: Boolean(disneyApiHeaders),
        market,
        sessionLoaded: true,
        finalUrl,
        redirectedToLogin: /login|identity|welcome/i.test(
          finalUrl
        ),
        disneyExploreAuthorizationCaptured:
          Boolean(disneyApiHeaders),
        bamRequests: bamRequests.slice(0, 20),
        consoleErrors: consoleErrors.slice(0, 10),
        pageErrors: pageErrors.slice(0, 10),
        screenshotBase64,
      });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        market,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (browser) await browser.close();
    }
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Not found",
    pathname: url.pathname,
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`QC server listening on port ${port}`);
});