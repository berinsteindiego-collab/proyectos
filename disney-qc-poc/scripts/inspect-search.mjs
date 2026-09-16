import { chromium } from "playwright";
import path from "node:path";

const PROFILE_DIR =
  "disney-qc-poc/auth/profiles/arg";

const context =
  await chromium.launchPersistentContext(
    path.resolve(PROFILE_DIR),
    {
      headless: false,
      locale: "es-419",
      viewport: {
        width: 1440,
        height: 900,
      },
    }
  );

const page =
  context.pages()[0] ??
  await context.newPage();

page.on("response", async (response) => {
  const url = response.url();

  if (
    !url.includes("disney.api.edge.bamgrid.com")
  ) {
    return;
  }

  const lowerUrl = url.toLowerCase();

  if (
    !lowerUrl.includes("search") &&
    !lowerUrl.includes("query")
  ) {
    return;
  }

  console.log("");
  console.log("🔎 POSIBLE SEARCH REQUEST");
  console.log(url);
  console.log(
    `HTTP ${response.status()}`
  );

  try {
    const json = await response.json();

    console.log("");
    console.log("🔎 RESPONSE");
    console.log(
      JSON.stringify(json, null, 2)
    );
  } catch {
    console.log(
      "La respuesta no era JSON."
    );
  }
});

await page.goto(
  "https://www.disneyplus.com/es-419/home",
  {
    waitUntil: "domcontentloaded",
  }
);

console.log("");
console.log("====================================");
console.log("DISNEY+ SEARCH INSPECTOR");
console.log("====================================");
console.log("");
console.log(
  "En Disney+, buscá manualmente:"
);
console.log("");
console.log("Modern Family");
console.log("");
console.log(
  "Esperá a que aparezcan los resultados."
);
console.log(
  "Después volvé al CMD."
);
console.log("");
console.log(
  "Para finalizar presioná CTRL+C."
);
console.log("");

await new Promise(() => {});