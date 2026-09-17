import { chromium } from "playwright";

const AUTH_FILE =
  "disney-qc-poc/auth/disney-arg.json";

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext({
  storageState: AUTH_FILE,
});

const page = await context.newPage();

page.on("request", async (request) => {
  const url = request.url();

  if (
    !url.includes(
      "disney.playback.edge.bamgrid.com/v7/playback/ctr-regular"
    )
  ) {
    return;
  }

  console.log("");
  console.log("====================================");
  console.log("PLAYBACK REQUEST DETECTADO");
  console.log("====================================");

  console.log("METHOD:");
  console.log(request.method());
const headers =
  await request.allHeaders();

console.log("");
console.log("HEADER NAMES:");
console.log(
  Object.keys(headers).sort()
);
  console.log("");
  console.log("POST DATA:");

  const postData = request.postData();

  if (!postData) {
    console.log("— Sin body");
  } else {
    try {
      const parsed = JSON.parse(postData);

      // Mostrar estructura sin imprimir posibles
      // valores de autenticación.
      console.log(
        JSON.stringify(parsed, null, 2)
      );
    } catch {
      console.log(postData);
    }
  }

  console.log("====================================");
  console.log("");
});

await page.goto(
  "https://www.disneyplus.com/es-419/browse/entity-943f5577-caad-4e34-a8d3-4a9a816d078a",
  {
    waitUntil: "domcontentloaded",
  }
);

console.log("");
console.log("Disney+ abierto.");
console.log("");
console.log(
  "Elegí manualmente Temporada 3 → Episodio 12 y reproducilo."
);
console.log("");
console.log(
  "Cuando aparezca PLAYBACK REQUEST DETECTADO, volvé acá."
);
console.log("");

await new Promise(() => {});