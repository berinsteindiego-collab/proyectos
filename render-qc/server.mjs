import http from "node:http";
import { chromium } from "playwright";

const port = Number(process.env.PORT || 10000);

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
    });

    res.end(
      JSON.stringify({
        ok: true,
        service: "disney-qc-render",
      })
    );

    return;
  }

  if (req.url === "/browser-test") {
    let browser;

    try {
      browser = await chromium.launch({
        headless: true,
      });

      res.writeHead(200, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          ok: true,
          message: "Playwright y Chromium funcionan en Render",
          chromiumVersion: browser.version(),
        })
      );
    } catch (error) {
      res.writeHead(500, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        })
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json",
  });

  res.end(
    JSON.stringify({
      ok: false,
      error: "Not found",
    })
  );
});

server.listen(port, "0.0.0.0", () => {
  console.log(`QC server listening on port ${port}`);
});