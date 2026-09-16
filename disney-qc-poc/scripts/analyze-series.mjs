import fs from "node:fs";

const FILE =
  "disney-qc-poc/results/modern-family-network.json";

const data = JSON.parse(
  fs.readFileSync(FILE, "utf8")
);

const response = data.find((item) =>
  item.url.includes("/page/entity-")
);

if (!response) {
  throw new Error("No encontré el response /page/entity");
}

const json = JSON.parse(response.body);

const episodes = [];

function walk(value, path = "root") {
  if (!value || typeof value !== "object") return;

  if (
    value.visuals &&
    value.visuals.seasonNumber != null &&
    value.visuals.episodeNumber != null
  ) {
    episodes.push({
      path,
      season: value.visuals.seasonNumber,
      episode: value.visuals.episodeNumber,
      title: value.visuals.episodeTitle,
      fullTitle: value.visuals.fullEpisodeTitle,
      runtimeMs: value.visuals.durationMs,
      unavailable: value.visuals.isUnavailable,
      actions: value.actions ?? null,
      id: value.id ?? null,
      entityId: value.entityId ?? null,
      deeplinkId: value.deeplinkId ?? null,
      encodedSeriesId: value.encodedSeriesId ?? null,
      infoBlock: value.infoBlock ?? null,
      artwork: value.visuals.artwork ?? null,
    });
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walk(item, `${path}[${index}]`)
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    walk(child, `${path}.${key}`);
  }
}

walk(json);

console.log("");
console.log(`Episodios encontrados: ${episodes.length}`);
console.log("");

for (const ep of episodes) {
  console.log(
    `T${ep.season} E${ep.episode} · ${ep.title}`
  );

  console.log(`  path: ${ep.path}`);

  if (ep.id) console.log(`  id: ${ep.id}`);
  if (ep.entityId)
    console.log(`  entityId: ${ep.entityId}`);
  if (ep.deeplinkId)
    console.log(`  deeplinkId: ${ep.deeplinkId}`);

  if (ep.actions) {
    console.log(
      `  actions: ${JSON.stringify(ep.actions)}`
    );
  }

  console.log("");
}

fs.writeFileSync(
  "disney-qc-poc/results/modern-family-episodes.json",
  JSON.stringify(episodes, null, 2),
  "utf8"
);

console.log(
  "💾 disney-qc-poc/results/modern-family-episodes.json"
);