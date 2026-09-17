import { chromium } from "playwright";

const AUTH_FILE =
  "disney-qc-poc/auth/disney-arg.json";

const SERIES_URL =
  "https://www.disneyplus.com/es-419/browse/entity-943f5577-caad-4e34-a8d3-4a9a816d078a";

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext({
  storageState: AUTH_FILE,
});

const page = await context.newPage();

page.on("request", (request) => {
  const url = request.url();

  if (
    /playback|deeplink|scenario|media|resource/i.test(url)
  ) {
    console.log("");
    console.log(request.method(), url);
  }
});

await page.goto(SERIES_URL, {
  waitUntil: "domcontentloaded",
});

await page.waitForTimeout(4000);

const seasonButton = page
  .getByRole("button", {
    name: /Temporada \d+/i,
  })
  .last();

await seasonButton.click();

const seasonResponse =
  page.waitForResponse(
    (response) =>
      response.url().includes(
        "/explore/v1.18/season/"
      ) &&
      response.ok(),
    { timeout: 15000 }
  );

await page
  .getByText("Temporada 3", {
    exact: true,
  })
  .last()
  .click();

await seasonResponse;

await page.waitForTimeout(1500);

console.log("");
console.log(
  "▶ Hacé clic manualmente en el episodio 12."
);
console.log(
  "▶ Si aparece otro botón para reproducir, hacé clic también."
);
console.log(
  "▶ Esperá hasta que empiece el video."
);
console.log(
  "▶ Después volvé a esta consola y presioná ENTER."
);

await new Promise((resolve) => {
  process.stdin.once("data", resolve);
});

await browser.close();