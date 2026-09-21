import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadSession, saveSession } from "./session-store.mjs";

test("ARG renewal persists encrypted state and QC reads the updated session", async () => {
  const previous = {
    QC_SESSION_REPO: process.env.QC_SESSION_REPO,
    QC_SESSION_TOKEN: process.env.QC_SESSION_TOKEN,
    QC_SESSION_KEY: process.env.QC_SESSION_KEY,
  };
  const originalFetch = globalThis.fetch;
  const stored = new Map();
  process.env.QC_SESSION_REPO = "test/private-qc-sessions";
  process.env.QC_SESSION_TOKEN = "test-only-token";
  process.env.QC_SESSION_KEY = randomBytes(32).toString("base64");
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/api.github.com\/repos\/test\/private-qc-sessions\/contents\/qc-sessions\/arg.json.enc$/);
    assert.equal(options.headers.Authorization, "Bearer test-only-token");
    if (options.method === "GET") {
      if (!stored.has(String(url))) return new Response("Not found", { status: 404 });
      const item = stored.get(String(url));
      return Response.json({ content: Buffer.from(item.text).toString("base64"), sha: item.sha });
    }
    assert.equal(options.method, "PUT");
    const body = JSON.parse(options.body);
    const previousItem = stored.get(String(url));
    if (previousItem) assert.equal(body.sha, previousItem.sha);
    const text = Buffer.from(body.content, "base64").toString("utf8");
    stored.set(String(url), { text, sha: String(stored.size + 1) });
    return Response.json({ content: { sha: "test" } });
  };
  try {
    const oldState = { cookies: [{ name: "session", value: "old-secret", domain: ".disneyplus.com", path: "/" }], origins: [] };
    const newState = { cookies: [{ name: "session", value: "new-secret", domain: ".disneyplus.com", path: "/" }], origins: [] };
    await saveSession("ARG", oldState);
    assert.deepEqual(await loadSession("ARG", "disney-arg-storage-state.json"), oldState);
    await saveSession("ARG", newState);
    assert.deepEqual(await loadSession("ARG", "disney-arg-storage-state.json"), newState);
    const ciphertext = [...stored.values()][0].text;
    assert.ok(!ciphertext.includes("new-secret"), "Session token must not appear in stored ciphertext");
    assert.ok(!ciphertext.includes("old-secret"), "Old session token must not appear in stored ciphertext");
    await assert.rejects(() => saveSession("INVALID", newState), /Invalid market/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
