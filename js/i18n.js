// One-tap English ⇄ ಕನ್ನಡ for the whole site.
// Interface text: t("English text") looks the string up in KN (js/i18n-kn.js) and falls back to English.
// Word data: dt.* reads data/kn.json (place introductions, notes, meanings…), again falling back to English.
import { KN } from "./i18n-kn.js";

const KEY = "nk.lang";
// Kannada first: a first-time visitor sees the site in Kannada; English is one tap away and remembered.
let lang = "kn";
try { if (localStorage.getItem(KEY) === "en") lang = "en"; } catch { /* default to Kannada */ }
document.documentElement.lang = lang;

export const getLang = () => lang;
export const isKn = () => lang === "kn";

export function setLang(next) {
  lang = next === "kn" ? "kn" : "en";
  document.documentElement.lang = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* still switches for this visit */ }
}

// t("Add a word from {place}", { place }) — values are inserted as given, so escape them first.
export function t(text, vars) {
  let out = lang === "kn" && KN[text] != null ? KN[text] : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return out;
}

// "3 words" / "3 ಪದಗಳು"
export const plural = (n, one, many) => `${n} ${t(n === 1 ? one : many)}`;

export const placeName = (p) => (p ? (lang === "kn" && p.name_kn ? p.name_kn : p.name) : "");
export const zoneName = (z) => (z ? (lang === "kn" && z.name_kn ? z.name_kn : z.name) : "");

// ---------- Word data in Kannada ----------
let DATA = null;
export async function loadDataKn() {
  if (DATA) return DATA;
  try {
    const res = await fetch("data/kn.json", { cache: "no-cache" });
    DATA = res.ok ? await res.json() : {};
  } catch {
    DATA = {};
  }
  return DATA;
}

const CREDIT = /\s*Transcribed from an @aarva_karnaata Instagram post on (.+)\.$/;
const CREDIT_GOTHILLA = /\s*From a @kannada\.gothilla Instagram post on Bengaluru slang\.$/;

export const dt = {
  about: (p) => (lang === "kn" && DATA?.about?.[p.id]) || p.about || "",
  compare: (set) => (lang === "kn" && DATA?.compare?.[set.id]) || set.english,
  why: (text) => (lang === "kn" && DATA?.why?.[text]) || text || "",
  meaning: (e) => (lang === "kn" && !e.contributed && DATA?.meaning?.[e.english]) || e.english,
  // The "Transcribed from an @… Instagram post" credit is dropped: the card's Source link already names the post.
  note(e) {
    const note = e.note || "";
    if (e.contributed || !note) return note;
    const body = note.replace(CREDIT, "").replace(CREDIT_GOTHILLA, "").trim();
    if (lang !== "kn" || !body) return body;
    return DATA?.note?.[body] || body;
  },
};
