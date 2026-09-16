import { chromium } from "playwright";
import path from "node:path";

const market =
  (process.argv[2] ?? "").toUpperCase();

const MARKETS = {
  ARG: {
    locale: "es-419",
    profileDir:
      "disney-qc-poc/auth/profiles/arg",
  },

  MX: {
    locale: "es-419",
    profileDir:
      "disney-qc-poc/auth/profiles/mx",
  },

  BR: {
    locale: "pt-BR",
    profileDir:
      "disney-qc-poc/auth/profiles/br",
  },
};

const config = MARKETS[market];

if (!config) {
  console.error(
    "Uso: node disney-qc-poc\\scripts\\test-session.mjs ARG|MX|BR"
  );
  process.exit(1);
}

const context =
  await chromium.launchPersistentContext(
    path.resolve(config.profileDir),
    {
      headless: false,
      locale: config.locale,
      viewport: {
        width: 1440,
        height: 900,
      },
    }
  );

const page =
  context.pages()[0] ??
  await context.newPage();

await page.goto(
  `https://www.disneyplus.com/${config.locale}/home`,
  {
    waitUntil: "domcontentloaded",
  }
);

await page.waitForTimeout(5000);

const url = page.url();

if (
  /login|identity|welcome/i.test(url)
) {
  console.error("");
  console.error(
    `✗ SESIÓN ${market} NO AUTENTICADA`
  );
  console.error(`URL: ${url}`);
  console.error("");

  await context.close();
  process.exit(1);
}

console.log("");
console.log(
  `✓ SESIÓN ${market} PERSISTENTE`
);
console.log(
  "Disney+ abrió desde un proceso nuevo sin solicitar login."
);
console.log("");

await context.close();