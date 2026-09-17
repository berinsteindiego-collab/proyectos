import { chromium } from "playwright";
import path from "node:path";

const context = await chromium.launchPersistentContext(
  path.resolve("disney-qc-poc/auth/profiles/br"),
  {
    headless: false,
    locale: "pt-BR",
    viewport: {
      width: 1440,
      height: 900,
    },
  }
);

const pages = context.pages();
const page = pages[0] ?? await context.newPage();

const entity =
  "ff538b5d-007c-4ceb-9dec-407856d5142d";

await page.goto(
  `https://www.disneyplus.com/pt-br/browse/entity-${entity}`,
  {
    waitUntil: "domcontentloaded",
  }
);

await page.waitForTimeout(5000);

console.log("");
console.log("=== BUTTONS ===");

const buttons = await page
  .locator("button")
  .evaluateAll((elements) =>
    elements.map((el) => ({
      text: el.innerText?.trim() || "",
      ariaLabel: el.getAttribute("aria-label"),
      ariaHaspopup: el.getAttribute("aria-haspopup"),
      ariaExpanded: el.getAttribute("aria-expanded"),
    }))
  );

for (const button of buttons) {
  if (
    button.text ||
    button.ariaLabel ||
    button.ariaHaspopup
  ) {
    console.log(button);
  }
}

console.log("");
console.log("=== ROLE OPTION / LI ===");

const options = await page
  .locator('li[role="option"]')
  .evaluateAll((elements) =>
    elements.map((el) => ({
      id: el.id,
      title: el.getAttribute("title"),
      text: el.innerText?.trim() || "",
      selected: el.getAttribute("aria-selected"),
    }))
  );

console.log(options);

console.log("");
console.log("=== FIN ===");

await context.close();