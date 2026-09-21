import fs from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Optional durable store: encrypted storageState in a PRIVATE GitHub repository.
// Never use the public application repository for these files.
const MARKET_FILES = { ARG: "arg.json.enc", MX: "mx.json.enc", BR: "br.json.enc" };
const directory = "/etc/secrets";

function settings() {
  const { QC_SESSION_REPO, QC_SESSION_TOKEN, QC_SESSION_KEY } = process.env;
  if (!QC_SESSION_REPO || !QC_SESSION_TOKEN || !QC_SESSION_KEY) return null;
  if (!/^[\w.-]+\/[\w.-]+$/.test(QC_SESSION_REPO)) throw new Error("Invalid QC_SESSION_REPO");
  const key = Buffer.from(QC_SESSION_KEY, "base64");
  if (key.length !== 32) throw new Error("QC_SESSION_KEY must be 32 bytes, base64 encoded");
  return { repo: QC_SESSION_REPO, token: QC_SESSION_TOKEN, key };
}

function validate(state) {
  if (!state || typeof state !== "object" || !Array.isArray(state.cookies) || !Array.isArray(state.origins)) {
    throw new Error("Invalid Playwright storageState");
  }
  return state;
}

function encrypt(state, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(validate(state))), cipher.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") });
}

function decrypt(text, key) {
  const value = JSON.parse(text);
  if (value.v !== 1) throw new Error("Unknown session format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return validate(JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]).toString("utf8")));
}

async function github(market, method, body) {
  const config = settings();
  if (!config) return null;
  const path = `qc-sessions/${MARKET_FILES[market]}`;
  const response = await fetch(`https://api.github.com/repos/${config.repo}/contents/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "disney-qc-session-store",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 404 && method === "GET") return { missing: true };
  if (!response.ok) throw new Error(`Private session store HTTP ${response.status}`);
  return response.json();
}

export async function loadSession(market, secretFile) {
  if (!MARKET_FILES[market]) throw new Error("Invalid market");
  const config = settings();
  if (config) {
    const record = await github(market, "GET");
    if (!record.missing) {
      const ciphertext = Buffer.from(record.content.replace(/\s/g, ""), "base64").toString("utf8");
      return decrypt(ciphertext, config.key);
    }
  }
  const path = `${directory}/${secretFile}`;
  if (!fs.existsSync(path)) return null;
  return validate(JSON.parse(fs.readFileSync(path, "utf8")));
}

export async function saveSession(market, state) {
  if (!MARKET_FILES[market]) throw new Error("Invalid market");
  const config = settings();
  if (!config) throw new Error("Durable private session storage is not configured");
  const current = await github(market, "GET");
  const encrypted = encrypt(state, config.key);
  await github(market, "PUT", {
    message: `Update encrypted QC session ${market}`,
    content: Buffer.from(encrypted).toString("base64"),
    ...(current.missing ? {} : { sha: current.sha }),
  });
  return { market, saved: true };
}
