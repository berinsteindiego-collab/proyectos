import http from "node:http";
import { chromium } from "playwright";

const port = Number(process.env.PORT || 10000);

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

    try {
      const encodedState =
        process.env.DISNEY_ARG_STORAGE_STATE;

      if (!encodedState) {
        throw new Error(
          "DISNEY_ARG_STORAGE_STATE no encontrada"
        );
      }

      const storageState = JSON.parse(
        Buffer.from(encodedState, "base64").toString("utf8")
      );

      browser = await chromium.launch({
        headless: true,
      });

      const context = await browser.newContext({
        storageState,
        locale: "es-419",
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
        "https://www.disneyplus.com/es-419/home",
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

      await context.close();

      return sendJson(res, 200, {
        ok: Boolean(disneyApiHeaders),
        market: "ARG",
        sessionLoaded: true,
        disneyExploreAuthorizationCaptured:
          Boolean(disneyApiHeaders),
      });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        market: "ARG",
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