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

await page.goto(
  "https://www.disneyplus.com/es-419/browse/entity-943f5577-caad-4e34-a8d3-4a9a816d078a",
  {
    waitUntil: "domcontentloaded",
  }
);

await page.waitForTimeout(4000);

const seasonButton = page
  .getByRole("button", {
    name: /Temporada \d+/i,
  })
  .last();

await seasonButton.waitFor({
  state: "visible",
  timeout: 15000,
});

await seasonButton.click();

await page.waitForTimeout(500);

const season3 = page
  .getByText("Temporada 3", {
    exact: true,
  })
  .last();

await season3.waitFor({
  state: "visible",
  timeout: 10000,
});

console.log("");
console.log("===== TEMPORADA 3 =====");

console.log(
  await season3.evaluate((el) => ({
    tagName: el.tagName,
    text: el.textContent,
    outerHTML: el.outerHTML,
    parentHTML: el.parentElement?.outerHTML,
  }))
);

console.log("=======================");
console.log("");

await browser.close();