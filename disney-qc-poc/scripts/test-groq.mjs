import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.local");

if (!fs.existsSync(envPath)) {
  throw new Error("No existe .env.local");
}

const envText = fs.readFileSync(envPath, "utf8");

for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();

  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    !trimmed.includes("=")
  ) {
    continue;
  }

  const separator = trimmed.indexOf("=");

  const key =
    trimmed.slice(0, separator).trim();

  let value =
    trimmed.slice(separator + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("GROQ_API_KEY no encontrada.");
}

const response = await fetch(
  "https://api.groq.com/openai/v1/models",
  {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  }
);

const body = await response.text();

console.log("");
console.log(`HTTP ${response.status}`);
console.log("");

if (!response.ok) {
  console.log(body);
  process.exit(1);
}

const json = JSON.parse(body);

const models = json.data
  ?.map((model) => model.id)
  .filter(Boolean)
  .sort();

console.log("MODELOS DISPONIBLES:");
console.log("");

for (const model of models ?? []) {
  console.log(model);
}