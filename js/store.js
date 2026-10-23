// Data loading, lookups and the on-device contributions store.

const LOCAL_KEY = "namma-kannada.contributions.v1";

export const store = {
  data: null,
  places: new Map(),
  zones: new Map(),
  entries: [],
};

export async function loadData() {
  const res = await fetch("data/dialects.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load data/dialects.json (HTTP ${res.status})`);
  const data = await res.json();
  store.data = data;
  for (const z of data.zones) store.zones.set(z.id, z);
  for (const p of data.places) store.places.set(p.id, p);
  store.entries = data.entries;
  return data;
}

export function allEntries() {
  return [...store.entries, ...readContributions()];
}

export function entriesFor(placeId) {
  return allEntries().filter((e) => e.place === placeId);
}

export function entryById(id) {
  return allEntries().find((e) => e.id === id);
}

export function zoneOf(placeId) {
  const p = store.places.get(placeId);
  return p ? store.zones.get(p.zone) : null;
}

export function sourceUrl(key) {
  return key && store.data.sources[key] ? store.data.sources[key] : null;
}

export function sourceLabel(key) {
  const url = sourceUrl(key);
  if (!url) return null;
  try {
    let host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "web.archive.org") host = "archive.org (Kundapura dictionary)";
    return host;
  } catch {
    return key;
  }
}

// ---------- Contributions saved on this device ----------
export function readContributions() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveContribution(entry) {
  const list = readContributions();
  list.push(entry);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// ---------- Search ----------
export function normalize(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip Latin diacritics (ā → a)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[()]/g, "")
    .trim();
}

function fieldsOf(e) {
  return [
    e.english,
    e.dialect?.kn, e.dialect?.tr,
    e.standard?.kn, e.standard?.tr,
    store.places.get(e.place)?.name,
  ].filter(Boolean).map(normalize);
}

export function search(query) {
  const q = normalize(query);
  if (!q) return [];
  const scored = [];
  for (const e of allEntries()) {
    let best = 0;
    for (const f of fieldsOf(e)) {
      // Fields like "enta / entadu" hold variants, so test each word too.
      const parts = [f, ...f.split(/[\s/;,]+/)];
      for (const part of parts) {
        if (part === q) best = Math.max(best, 3);
        else if (part.startsWith(q)) best = Math.max(best, 2);
        else if (part.includes(q)) best = Math.max(best, 1);
      }
    }
    if (best) scored.push([best, e]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, e]) => e);
}
