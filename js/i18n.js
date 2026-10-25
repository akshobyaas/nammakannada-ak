// One-tap English ⇄ ಕನ್ನಡ for the whole site.
// Interface text: t("English text") looks the string up in KN (js/i18n-kn.js) and falls back to English.
// Word data: dt.* reads data/kn.json (place introductions, notes, meanings…), again falling back to English.
import { KN } from "./i18n-kn.js";

const KEY = "nk.lang";
let lang = "en";
try { if (localStorage.getItem(KEY) === "kn") lang = "kn"; } catch { /* default to English */ }
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
  note(e) {
    const note = e.note || "";
    if (lang !== "kn" || e.contributed || !note) return note;
    let body = note, credit = "";
    const m = note.match(CREDIT);
    if (m) {
      body = note.slice(0, m.index).trim();
      const topic = DATA?.credit_topic?.[m[1]] || m[1];
      credit = `@aarva_karnaata ಇನ್‌ಸ್ಟಾಗ್ರಾಮ್ ಪೋಸ್ಟ್‌ನಿಂದ (${topic}) ದಾಖಲಿಸಲಾಗಿದೆ.`;
    } else if (CREDIT_GOTHILLA.test(note)) {
      body = note.replace(CREDIT_GOTHILLA, "").trim();
      credit = "@kannada.gothilla ಇನ್‌ಸ್ಟಾಗ್ರಾಮ್ ಪೋಸ್ಟ್‌ನಿಂದ (ಬೆಂಗಳೂರು ಸ್ಲ್ಯಾಂಗ್).";
    }
    const kn = body ? DATA?.note?.[body] : "";
    if (body && !kn) return note; // no translation: keep the whole note in English
    return [kn, credit].filter(Boolean).join(" ");
  },
};
