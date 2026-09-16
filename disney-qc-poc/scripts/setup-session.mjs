import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

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
  console.error("");
  console.error(
    "Uso: node disney-qc-poc\\scripts\\setup-session.mjs ARG|MX|BR"
  );
  console.error("");
  process.exit(1);
}

fs.mkdirSync(
  path.resolve(config.profileDir),
  {
    recursive: true,
  }
);

console.log("");
console.log(
  `🔐 Configurando sesión técnica Disney+ ${market}`
);
console.log("");
console.log(
  "Iniciá sesión y seleccioná el perfil correspondiente."
);
console.log(
  "Cuando estés en Home de Disney+, volvé a esta ventana y presioná ENTER."
);
console.log("");

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

const pages = context.pages();

const page =
  pages[0] ?? await context.newPage();

await page.goto(
  `https://www.disneyplus.com/${config.locale}/home`,
  {
    waitUntil: "domcontentloaded",
  }
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

await new Promise((resolve) => {
  rl.question(
    `ENTER cuando ${market} esté correctamente logueado... `,
    resolve
  );
});

rl.close();

await context.close();

console.log("");
console.log(
  `✓ Sesión ${market} guardada en perfil persistente`
);
console.log("");