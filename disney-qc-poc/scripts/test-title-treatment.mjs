import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, "utf8");

  for (const line of text.split(/\r?\n/)) {
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
      (value.startsWith('"') &&
        value.endsWith('"')) ||
      (value.startsWith("'") &&
        value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(
  path.resolve(".env.local")
);

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error(
    "No encontré GROQ_API_KEY en .env.local."
  );
}

const imageUrl =
  "https://disney.images.edge.bamgrid.com/" +
  "ripcut-delivery/v2/variant/disney/" +
  "019d87ed-de6b-71e2-8a72-7e436219ee16/" +
  "trim?format=webp&max=800%7C300";

const response = await fetch(
  "https://api.groq.com/openai/v1/chat/completions",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen3.8-27b",
      temperature: 0,
      max_completion_tokens: 100,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Transcribe únicamente el texto visible " +
                "del logo o title treatment de esta imagen. " +
                "No describas la imagen. No agregues explicaciones. " +
                "Si no podés leerlo con confianza, responde UNKNOWN.",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    }),
  }
);

const json = await response.json();

if (!response.ok) {
  console.error(
    JSON.stringify(json, null, 2)
  );

  throw new Error(
    `Groq HTTP ${response.status}`
  );
}

const text =
  json.choices?.[0]?.message?.content?.trim();

console.log("");
console.log("🖼 TITLE TREATMENT VISION");
console.log(`Groq leyó: ${text}`);
console.log("");