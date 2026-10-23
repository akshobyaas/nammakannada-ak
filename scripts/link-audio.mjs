// Links recordings in audio/ to entries in data/dialects.json.
// A file named after an entry id (sir-01.webm, kun-03.mp3, ...) becomes that entry's "audio".
// Usage: node scripts/link-audio.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "data", "dialects.json");
const audioDir = join(root, "audio");
const AUDIO = new Set([".mp3", ".m4a", ".webm", ".ogg", ".wav"]);

const data = JSON.parse(readFileSync(dataPath, "utf8"));
const files = readdirSync(audioDir).filter((f) => AUDIO.has(extname(f).toLowerCase()));
const byId = new Map(files.map((f) => [basename(f, extname(f)), f]));

let linked = 0;
const unknown = [];
for (const e of data.entries) {
  const f = byId.get(e.id);
  if (f) {
    e.audio = `audio/${f}`;
    linked++;
    byId.delete(e.id);
  }
}
unknown.push(...byId.values());

writeFileSync(dataPath, JSON.stringify(data, null, 1) + "\n");
console.log(`Linked ${linked} recording${linked === 1 ? "" : "s"}.`);
if (unknown.length) console.log(`No entry matches: ${unknown.join(", ")}. Rename them to an entry id.`);
