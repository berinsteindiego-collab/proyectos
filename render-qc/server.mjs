import http from "node:http";
import fs from "node:fs";
import { chromium } from "playwright";

const port = Number(process.env.PORT || 10000);

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

      page.on("request", async (request) => {
        if (disneyApiHeaders) return;

        if (
          !request
            .url()
            .includes("disney.api.edge.bamgrid.com/explore/")
        ) {
          return;
        }

        const headers = await request.allHeaders();

        if (headers.authorization) {
          disneyApiHeaders = {
            authorization: headers.authorization,
          };
        }
      });

      await page.goto(
        `https://www.disneyplus.com/${config.webPath}/home`,
        {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        }
      );

      await page.waitForTimeout(5000);

      if (!disneyApiHeaders) {
        await page.reload({
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        await page.waitForTimeout(5000);
      }

      const finalUrl = page.url();

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