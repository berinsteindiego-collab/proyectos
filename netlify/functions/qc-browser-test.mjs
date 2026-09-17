import { chromium } from "playwright";

export default async () => {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const version = browser.version();

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Playwright y Chromium funcionan en Netlify",
        chromiumVersion: version,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};