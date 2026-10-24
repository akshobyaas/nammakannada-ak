// Turns Kannada script into an easy "say it" spelling for English readers,
// split into syllables: ಬತ್ತೆ -> "bat-teh", ಕುಡ್ಯಾಕತಾನ್ -> "kuD-yaa-ka-taan".
// Capital T D N L Sh mark sounds made with the tongue curled back (see #/guide).

const VOWELS = {
  "ಅ": "a", "ಆ": "aa", "ಇ": "i", "ಈ": "ee", "ಉ": "u", "ಊ": "oo", "ಋ": "ru",
  "ಎ": "e", "ಏ": "ay", "ಐ": "ai", "ಒ": "o", "ಓ": "oh", "ಔ": "au",
};
const SIGNS = {
  "ಾ": "aa", "ಿ": "i", "ೀ": "ee", "ು": "u", "ೂ": "oo", "ೃ": "ru",
  "ೆ": "e", "ೇ": "ay", "ೈ": "ai", "ೊ": "o", "ೋ": "oh", "ೌ": "au",
};
const CONS = {
  "ಕ": "k", "ಖ": "kh", "ಗ": "g", "ಘ": "gh", "ಙ": "ng",
  "ಚ": "ch", "ಛ": "chh", "ಜ": "j", "ಝ": "jh", "ಞ": "ny",
  "ಟ": "T", "ಠ": "Th", "ಡ": "D", "ಢ": "Dh", "ಣ": "N",
  "ತ": "t", "ಥ": "th", "ದ": "d", "ಧ": "dh", "ನ": "n",
  "ಪ": "p", "ಫ": "ph", "ಬ": "b", "ಭ": "bh", "ಮ": "m",
  "ಯ": "y", "ರ": "r", "ಲ": "l", "ವ": "v", "ಶ": "sh", "ಷ": "Sh",
  "ಸ": "s", "ಹ": "h", "ಳ": "L", "ೞ": "zh", "ಱ": "r",
};
const NUKTA = { "ಫ": "f", "ಜ": "z" };
// Before these sounds ಂ is said m (ಸಂಸಾರ samsaara, ಅಂವ amva); before other stops it is n.
const LABIAL = new Set(["p", "ph", "b", "bh", "m", "f", "y", "r", "l", "v", "sh", "Sh", "s", "h", "L"]);
const VIRAMA = "್", ANUSVARA = "ಂ", VISARGA = "ಃ", NUKTA_MARK = "಼";

// Kannada word -> list of sound units [{c: "k"} | {v: "a"}]
function units(word) {
  const out = [];
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (CONS[ch]) {
      let s = CONS[ch];
      if (chars[i + 1] === NUKTA_MARK) { s = NUKTA[ch] || s; i++; }
      out.push({ c: s });
      const next = chars[i + 1];
      if (SIGNS[next]) { out.push({ v: SIGNS[next] }); i++; }
      else if (next === VIRAMA) { i++; }
      else out.push({ v: "a" });
    } else if (VOWELS[ch]) {
      out.push({ v: VOWELS[ch] });
    } else if (ch === ANUSVARA) {
      // ಂ sounds like m before p/b/m, v, y, r, l, s, h and at the end of a word, otherwise n.
      const rest = chars.slice(i + 1).find((x) => CONS[x]);
      const nextIsCons = CONS[chars[i + 1]];
      out.push({ c: nextIsCons ? (LABIAL.has(CONS[chars[i + 1]]) ? "m" : "n") : (rest ? "n" : "m") });
    } else if (ch === VISARGA) {
      out.push({ c: "h" });
    }
    // other marks (length mark, zero-width joiners) are skipped
  }
  return out;
}

function syllables(us) {
  const vowelAt = us.map((u, i) => (u.v ? i : -1)).filter((i) => i >= 0);
  if (!vowelAt.length) return [us.map((u) => u.c).join("")];
  // Boundaries: one consonant between vowels starts the next syllable;
  // two or more split after the first (bat-teh, kuD-yaa).
  const cuts = [];
  for (let k = 0; k < vowelAt.length - 1; k++) {
    const a = vowelAt[k], b = vowelAt[k + 1];
    const run = b - a - 1;
    cuts.push(run <= 1 ? a + 1 : a + 2);
  }
  const parts = [];
  let start = 0;
  for (const c of cuts) { parts.push(us.slice(start, c)); start = c; }
  parts.push(us.slice(start));
  return parts.map((p) => p.map((u) => u.c ?? u.v).join(""));
}

function sayWord(word) {
  const us = units(word);
  if (!us.length) return "";
  const last = us[us.length - 1];
  if (last.v === "e") last.v = "eh"; // so English readers don't drop a final e
  return syllables(us).join("-");
}

// Whole phrase: keeps variant separators ( / ; , ) and question marks.
export function sayIt(kn) {
  if (!kn) return "";
  return kn
    .split(/(\s*[/;,]\s*|\s+|[?!.])/)
    .map((part) => (/[ಀ-೿]/.test(part) ? sayWord(part) : part.replace(/\s+/g, " ")))
    .join("")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s*;\s*/g, "; ")
    .trim();
}
