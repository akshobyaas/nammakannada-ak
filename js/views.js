// Panel views. Each returns an HTML string or wires up its own DOM.
import {
  store, allEntries, entriesFor, entryById, zoneOf,
  sourceUrl, sourceLabel, readContributions, saveContribution, search,
} from "./store.js";
import { CONFIG } from "./config.js";
import * as map from "./map.js";
import { wireSound } from "./speech.js";
import { sayIt } from "./pronounce.js";
import { emptyHtml, toast, copyText, setBusy } from "./ui.js";
import { t, plural, placeName, zoneName, dt, isKn } from "./i18n.js";

const ZONE_ORDER = ["south", "malnad", "coast", "north", "kalyana"];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}


// ---------- Word card ----------
const ICON_SPEAKER = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>`;

const TYPE_LABEL = { word: "Word", phrase: "Phrase", sound: "Sound change", grammar: "Grammar", loanword: "Borrowed" };
export function category(e) {
  if (e.type === "phrase" && /\((proverb|saying)\)/i.test(e.english)) return "Proverb";
  return TYPE_LABEL[e.type] || "Word";
}

// Sensitive entries: some are hidden behind a tap, some only labelled.
const SENSITIVE_LABEL = {
  caste: "Mentions caste", community: "Names a community", violence: "Mentions injury",
  vulgar: "Strong language", insult: "Mild insult",
};
const GATED = new Set(["caste", "community", "violence", "vulgar"]);
export const isGated = (e) => !!e.sensitive && GATED.has(e.sensitive.kind) && e.sensitive.level !== "label";

function dialectHtml(e, { asButton = false } = {}) {
  if (e.dialect?.kn) {
    return asButton
      ? `<button type="button" class="dialect" lang="kn" data-proxy-play title="${t("Tap to hear it")}">${esc(e.dialect.kn)}</button>`
      : `<p class="dialect" lang="kn">${esc(e.dialect.kn)}</p>`;
  }
  return `<p class="dialect latin">${esc(e.dialect?.tr)}</p>`;
}

// Where a printed dictionary lists the word: page, headword and gloss as printed, and how it differs.
const DICT_NAME = { malenada_nudikosha: "Malenada Nudikosha", kannada_janapada_nighantu: "Kannada Janapada Nighantu" };
function dictHtml(e) {
  const d = e.dict;
  if (!d || !DICT_NAME[d.ref]) return "";
  const book = t(DICT_NAME[d.ref]);
  const where = d.page != null ? t("{book}, p. {page}", { book, page: d.page }) : t("{book}, entry {n}", { book, n: d.entry });
  const region = d.region ? ` <span class="dict-region" lang="kn">(${esc(d.region)})</span>` : "";
  const diff = d.differs ? ` <span class="dict-diff">${esc(t(d.differs))}</span>` : "";
  return `<p class="dict"><a href="#/sources">${where}</a>: <span lang="kn">${esc(d.headword)} = ${esc(d.gloss)}</span>${region}${diff}</p>`;
}

function checkHtml(e) {
  if (e.contributed) return `<span class="check mine">${t("Added by you on this device")}</span>`;
  if (e.verified) return `<span class="check ok">${t("Checked by a native speaker")}</span>`;
  return `<span class="check">${t("Not yet checked by a speaker")}</span>`;
}

// "Say it: bat-teh", with a link to the guide that explains the letters.
function sayLine(kn) {
  const say = sayIt(kn);
  return say ? `<p class="say">${t("Say it")} <span class="say-pill">${esc(say)}</span> <a href="#/guide">${t("How to read this")}</a></p>` : "";
}

export function wordCard(e, { showPlace = false } = {}) {
  const place = store.places.get(e.place);
  const zone = zoneOf(e.place);
  const src = sourceUrl(e.source);
  const gated = isGated(e);
  const std = e.standard
    ? `<p class="standard">${t("Standard Kannada:")} ${e.standard.kn ? `<span lang="kn">${esc(e.standard.kn)}</span>` : ""} ${isKn() && e.standard.kn ? "" : esc(e.standard.tr || "")} ${soundButton(e, "standard", "small")}</p>`
    : "";
  const flag = e.sensitive ? `<span class="flag-label" title="${esc(dt.why(e.sensitive.why))}">${esc(t(SENSITIVE_LABEL[e.sensitive.kind] || "Sensitive"))}</span>` : "";
  return `
  <article class="word${gated ? " gated" : ""}" data-cat="${category(e)}" style="--zone:${zone?.color || "#999"}">
    <span class="tag">${t(category(e))}</span>
    ${showPlace && place ? `<p class="where"><a href="#/place/${place.id}">${esc(placeName(place))}</a></p>` : ""}
    ${showPlace && !place && e.town ? `<p class="where">${esc(e.town)}</p>` : ""}
    ${gated ? `<div class="gate"><div class="gate-inner">
        <p><strong>${esc(t(SENSITIVE_LABEL[e.sensitive.kind]))}.</strong> ${esc(dt.why(e.sensitive.why))}</p>
        <button type="button" class="reveal">${t("Show it")}</button>
      </div></div>` : ""}
    <div class="gate-body">
      <div class="word-top">
        <div class="main">
          ${dialectHtml(e, { asButton: true })}
          ${e.dialect?.kn && e.dialect?.tr ? `<p class="tr">${esc(e.dialect.tr)}</p>` : ""}
        </div>
        ${soundButton(e, "dialect", "big")}
      </div>
      ${sayLine(e.dialect?.kn)}
      <p class="meaning">${esc(dt.meaning(e))}</p>
      ${std}
      ${dt.note(e) ? `<p class="note">${esc(dt.note(e))}</p>` : ""}
      ${dictHtml(e)}
    </div>
    <footer>
      ${flag}
      ${checkHtml(e)}
      ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener">${t("Source:")} ${esc(sourceLabel(e.source))}</a>` : ""}
    </footer>
  </article>`;
}

// Sound, best first: a speaker's recording, then an AI voice clip, then a dictionary clip,
// then the browser's own Kannada voice (hidden when the browser has none).
function soundButton(e, side = "dialect", size = "") {
  const word = e[side]?.kn || e[side]?.tr || "";
  const cls = `play${size ? " " + size : ""}`;
  const label = (text) => (size === "big" ? "" : `<span>${t(text)}</span>`);
  const aria = `aria-label="${esc((side === "standard" ? t("Listen to the standard form") : t("Listen to")) + " " + word)}"`;
  if (side === "dialect" && e.audio)
    return `<button class="${cls}" type="button" ${aria} data-audio="${esc(e.audio)}" title="${t("Recorded by a speaker")}">${ICON_SPEAKER}${label("Recording")}</button>`;
  if (e.voice?.[side])
    return `<button class="${cls}" type="button" ${aria} data-clips="${esc(e.voice[side])}" title="${t("AI voice (Sarvam Bulbul) reading the spelling")}">${ICON_SPEAKER}${label("Listen")}</button>`;
  const clips = e.tts?.[side];
  if (clips?.length)
    return `<button class="${cls}" type="button" ${aria} data-clips="${esc(clips.join("|"))}" title="${t("Computer voice from the Alar dictionary audio")}">${ICON_SPEAKER}${label("Listen")}</button>`;
  const kn = e[side]?.kn;
  if (!kn) return "";
  const text = kn.replace(/\s*[/;]\s*/g, ", ");
  return `<button class="${cls}" type="button" ${aria} data-say="${esc(text)}" hidden title="${t("Your browser's Kannada voice")}">${ICON_SPEAKER}${label("Listen")}</button>`;
}

// Wires sound, tap-the-word-to-hear-it, and the sensitive-content reveal.
export function wireAudio(root) {
  wireSound(root);
  root.querySelectorAll("[data-proxy-play]").forEach((w) => {
    w.addEventListener("click", () => {
      const card = w.closest(".word, .quiz-card");
      const btn = card?.querySelector(".play.big:not([hidden]), .word-top .play:not([hidden])");
      if (btn) btn.click();
    });
  });
  root.querySelectorAll(".reveal").forEach((b) => {
    b.addEventListener("click", () => {
      const card = b.closest(".word");
      card.classList.add("revealed");
      card.querySelector(".gate-body button, .gate-body a")?.focus();
    });
  });
}

// ---------- Explore (home) ----------
export function renderExplore(root, { zone } = {}) {
  const zones = zone ? [zone] : ZONE_ORDER;
  const intro = store.data.compare_sets.find((s) => s.id === "cmp-will-come");
  const total = allEntries().length;
  const withWords = [...store.places.values()].filter((p) => entriesFor(p.id).length).length;

  let html = "";
  if (!zone) {
    html += `
      <h1 lang="kn">ಒಂದೇ ಭಾಷೆ, ನೂರಾರು ದನಿ</h1>
      <p class="sub-h">${t("One language, hundreds of voices")}</p>
      <p class="lede">${t("Kannada sounds different in Sirsi, Kundapura, Dharwad and Bengaluru. Tap a place on the map to hear how people there really talk.")}</p>
      <div class="actions hero-cta">
        <a class="btn" href="#/quiz">${t("Play Guess the region")}</a>
        <a class="btn ghost" href="#/compare">${t("Compare regions side by side")}</a>
      </div>
      <p class="muted">${t("{words} from {n} of {total} places so far, each linked to its source.", { words: plural(total, "word", "words"), n: withWords, total: store.places.size })}</p>
      <a class="ajji-promo" href="#/ajji">
        <span class="ajji-promo-pic" aria-hidden="true">👵🏽🎙️</span>
        <span class="ajji-promo-text">
          <strong>${t("New: Ajji's words")}</strong>
          <span>${t("Hand your phone to a grandparent. They see pictures, not words, and answer the way they really talk. Save your family's Kannada in two minutes.")}</span>
        </span>
        <span class="ajji-promo-go" aria-hidden="true">➜</span>
      </a>
      ${intro ? compareBlock(intro) : ""}
      <h2>${t("Places")}</h2>`;
  } else {
    const z = store.zones.get(zone);
    html += `
      <a class="back" href="#/">${t("All regions")}</a>
      <h1>${isKn() ? `<span lang="kn">${esc(z.name_kn)}</span> <span class="muted" lang="en">${esc(z.name)}</span>` : `${esc(z.name)} <span class="muted" lang="kn">${esc(z.name_kn)}</span>`}</h1>`;
  }

  html += `<div class="zones">`;
  for (const zid of zones) {
    const z = store.zones.get(zid);
    const places = [...store.places.values()].filter((p) => p.zone === zid);
    html += `<section class="zone" style="--zone:${z.color}">
      ${zone ? "" : `<h3><span class="zone-chip"></span>${isKn() ? `<span lang="kn">${esc(z.name_kn)}</span> <span class="kn" lang="en">${esc(z.name)}</span>` : `${esc(z.name)} <span class="kn" lang="kn">${esc(z.name_kn)}</span>`}</h3>`}
      <ul class="chips">${places.map((p) => {
        const n = entriesFor(p.id).length;
        return `<li><a href="#/place/${p.id}" class="${n ? "" : "empty"}">${esc(placeName(p))} <span class="n">${n ? n : t("add words")}</span></a></li>`;
      }).join("")}</ul>
    </section>`;
  }
  html += `</div>`;
  root.innerHTML = html;
  map.setActive(null);
  map.highlightZone(zone || null);
}

// ---------- Place ----------
const CAT_ORDER = ["Word", "Phrase", "Proverb", "Sound change", "Grammar", "Borrowed"];
const CAT_PLURAL = { Word: "Words", Phrase: "Phrases", Proverb: "Proverbs", "Sound change": "Sound changes", Grammar: "Grammar", Borrowed: "Borrowed" };

function placesWithWords() {
  return [...store.places.values()]
    .filter((p) => entriesFor(p.id).length)
    .sort((a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone));
}

export function renderPlace(root, id) {
  const p = store.places.get(id);
  if (!p) { renderNotFound(root); return; }
  const z = store.zones.get(p.zone);
  const words = entriesFor(id);
  const src = sourceUrl(p.source);
  const counts = {};
  for (const e of words) counts[category(e)] = (counts[category(e)] || 0) + 1;
  const cats = CAT_ORDER.filter((c) => counts[c]);
  const list = placesWithWords();
  const i = list.findIndex((x) => x.id === id);
  const prev = i > 0 ? list[i - 1] : null;
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : (i < 0 ? list[0] : null);

  root.innerHTML = `
    <a class="back" href="#/zone/${z.id}">${esc(zoneName(z))}</a>
    <div class="place-head" style="--zone:${z.color}">
      <h1>${esc(placeName(p))}</h1>
      ${isKn() ? `<span class="kn" lang="en">${esc(p.name)}</span>` : `<span class="kn" lang="kn">${esc(p.name_kn)}</span>`}
    </div>
    <p class="lede">${esc(dt.about(p))}</p>
    ${src ? `<p class="muted"><a href="${esc(src)}" target="_blank" rel="noopener">${t("Read more on {site}", { site: esc(sourceLabel(p.source)) })}</a></p>` : ""}
    ${words.length
      ? `<h2>${t("{words} from {place}", { words: plural(words.length, "word", "words"), place: esc(placeName(p)) })}</h2>
         ${cats.length > 1 ? `<div class="filters" role="group" aria-label="${t("Show")}">
            <button type="button" class="chip-btn" data-cat="" aria-pressed="true">${t("All")}<span class="n">${words.length}</span></button>
            ${cats.map((c) => `<button type="button" class="chip-btn" data-cat="${c}" aria-pressed="false">${t(CAT_PLURAL[c] || c)}<span class="n">${counts[c]}</span></button>`).join("")}
          </div>` : ""}
         <div class="words">${words.map((e) => wordCard(e)).join("")}</div>
         <div class="actions"><a class="btn ghost" href="#/add?place=${p.id}">${t("Add a word from {place}", { place: esc(placeName(p)) })}</a></div>`
      : `<div class="empty-state">
           <p>${t("No words from {place} yet. If you know how people talk here, add the first one.", { place: esc(placeName(p)) })}</p>
           <a class="btn" href="#/add?place=${p.id}">${t("Add a word from {place}", { place: esc(placeName(p)) })}</a>
         </div>`}
    <nav class="place-nav" aria-label="${t("More places")}">
      ${prev ? `<a class="btn ghost" href="#/place/${prev.id}">${t("Previous: {place}", { place: esc(placeName(prev)) })}</a>` : "<span></span>"}
      ${next ? `<a class="btn" href="#/place/${next.id}">${t("Next: {place}", { place: esc(placeName(next)) })}</a>` : ""}
    </nav>
  `;
  root.querySelectorAll(".filters .chip-btn").forEach((b) => {
    b.addEventListener("click", () => {
      root.querySelectorAll(".filters .chip-btn").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const cat = b.dataset.cat;
      root.querySelectorAll(".words .word").forEach((w) => { w.hidden = !!cat && w.dataset.cat !== cat; });
    });
  });
  wireAudio(root);
  map.setActive(id);
  map.highlightZone(p.zone);
}

// ---------- Compare ----------
function compareBlock(set) {
  const items = set.entries.map(entryById).filter(Boolean);
  const std = items.find((e) => e.standard)?.standard;
  const sameMeaning = new Set(items.map((e) => e.english)).size === 1;
  const rows = items.map((e) => {
    const p = store.places.get(e.place);
    const z = zoneOf(e.place);
    const say = e.dialect?.kn
      ? `<span lang="kn">${esc(e.dialect.kn)}</span><span class="t">${esc(e.dialect.tr || "")}</span><span class="s">${esc(sayIt(e.dialect.kn))}</span>`
      : `<span class="latin">${esc(e.dialect?.tr)}</span>`;
    return `<div class="cmp-row" style="--zone:${z.color}">
      <a class="who" href="#/place/${p.id}">${esc(placeName(p))}</a>
      <div class="say">${say}</div>
      ${sameMeaning ? "" : `<div class="what">${esc(dt.meaning(e))}${e.standard?.tr ? `, ${t("standard")} ${esc(isKn() && e.standard.kn ? e.standard.kn : e.standard.tr)}` : ""}</div>`}
    </div>`;
  }).join("");
  const stdRow = sameMeaning && std
    ? `<div class="cmp-row std"><span class="who">${t("Standard")}</span><div class="say">${std.kn ? `<span lang="kn">${esc(std.kn)}</span>` : ""}<span class="t">${esc(std.tr || "")}</span></div></div>`
    : "";
  return `<section class="cmp"><h3>${esc(dt.compare(set))}</h3>${stdRow}${rows}</section>`;
}

export function renderCompare(root) {
  root.innerHTML = `
    <h1>${t("Compare")}</h1>
    <p class="lede">${t("The same idea, said across Karnataka.")}</p>
    ${(store.data.compare_sets || []).length
      ? `<div class="compare">${store.data.compare_sets.map(compareBlock).join("")}</div>`
      : emptyHtml({ title: t("No comparisons yet"), body: t("Comparisons appear once the same word has been collected from several places."), actions: `<a class="btn" href="#/">${t("Explore the map")}</a>` })}`;
  map.setActive(null);
  map.highlightZone(null);
}

// ---------- Search ----------
export function renderSearch(root, q) {
  const results = search(q);
  if (results.length) {
    root.innerHTML = `
      <h1>${plural(results.length, "match", "matches")}</h1>
      <p class="muted">${t("for “{q}”", { q: esc(q.trim()) })}</p>
      <div class="words">${results.map((e) => wordCard(e, { showPlace: true })).join("")}</div>`;
    wireAudio(root);
    return;
  }
  root.innerHTML = emptyHtml({
    kn: "ಹುಡುಕಿ",
    title: t("No match for “{q}”", { q: esc(q.trim()) }),
    body: t("Try the English meaning, a word in Kannada script, or a place name. Spelling in English letters can vary, so try a shorter part of the word."),
    actions: ["come", "house", "ಮನೆ", "Sirsi"].map((s) =>
      `<button class="btn ghost" type="button" data-try="${esc(s)}" ${/[ಀ-೿]/.test(s) ? 'lang="kn"' : ""}>${esc(s)}</button>`).join("")
      + `<a class="btn" href="#/">${t("Browse the map")}</a>`,
  });
  root.querySelectorAll("[data-try]").forEach((b) => b.addEventListener("click", () => {
    const input = document.getElementById("q");
    input.value = b.dataset.try;
    input.dispatchEvent(new Event("input"));
    input.focus();
  }));
}

// ---------- Quiz: Guess the region ----------
let quiz = null;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newQuiz() {
  // Only words with a distinct regional form; skip abstract sound rules.
  const pool = shuffle(allEntries().filter((e) =>
    !e.contributed && !e.sensitive && e.dialect && (e.dialect.kn || e.dialect.tr) && e.type !== "grammar"
  ));
  // Prefer variety: at most two questions per place.
  const per = {}, picked = [];
  for (const e of pool) {
    per[e.place] = (per[e.place] || 0) + 1;
    if (per[e.place] <= 2) picked.push(e);
    if (picked.length === CONFIG.QUIZ_LENGTH) break;
  }
  const answerable = [...store.places.values()].filter((p) => entriesFor(p.id).some((e) => !e.contributed));
  const questions = picked.map((e) => {
    const right = store.places.get(e.place);
    const others = shuffle(answerable.filter((p) => p.id !== right.id && p.zone !== right.zone)).slice(0, 3);
    return { entry: e, options: shuffle([right, ...others]) };
  });
  return { questions, i: 0, score: 0, answered: false };
}

export function renderQuiz(root, { restart = false } = {}) {
  if (!quiz || restart) quiz = newQuiz();
  map.clearMarks();
  map.setActive(null);
  map.highlightZone(null);

  if (!quiz.questions.length) {
    root.innerHTML = `<h1>${t("Guess the region")}</h1>` + emptyHtml({
      title: t("Not enough words to play yet"),
      body: t("The quiz needs words from at least a few different regions. Add some words and come back."),
      actions: `<a class="btn" href="#/add">${t("Add a word")}</a><a class="btn ghost" href="#/">${t("Explore the map")}</a>`,
    });
    return;
  }

  if (quiz.i >= quiz.questions.length) {
    const n = quiz.questions.length;
    root.innerHTML = `
      <h1>${t("You got {score} of {n}", { score: quiz.score, n })}</h1>
      <p class="lede">${t(quiz.score === n ? "Every one. You know your Karnataka." : quiz.score >= n / 2 ? "Good ear. Explore the map to learn the rest." : "Kannada really does change a lot. The map shows where each word comes from.")}</p>
      <div class="actions"><button class="btn" type="button" id="again">${t("Play again")}</button><a class="btn ghost" href="#/">${t("Explore the map")}</a></div>`;
    root.querySelector("#again").addEventListener("click", () => renderQuiz(root, { restart: true }));
    return;
  }

  const q = quiz.questions[quiz.i];
  const e = q.entry;
  root.innerHTML = `
    <h1>${t("Guess the region")}</h1>
    <p class="lede">${t("Where in Karnataka would you hear this?")}</p>
    <div class="quiz-card">
      <p class="progress"><span>${t("Word {i} of {n}", { i: quiz.i + 1, n: quiz.questions.length })}</span><span>${t("Score {s}", { s: quiz.score })}</span></p>
      <div class="word-top"><div class="main">${dialectHtml(e, { asButton: true })}</div>${soundButton(e, "dialect", "big")}</div>
      ${e.dialect?.kn && e.dialect?.tr ? `<p class="tr">${esc(e.dialect.tr)}</p>` : ""}
      ${sayLine(e.dialect?.kn)}
      <p class="meaning">${t("means “{m}”", { m: esc(dt.meaning(e)) })}</p>
      <div class="options">${q.options.map((p, n) => `<button type="button" data-place="${p.id}"><span class="k" aria-hidden="true">${n + 1}</span>${esc(placeName(p))}</button>`).join("")}</div>
      <p class="kbd-hint">${t("Tip: press 1 to 4 to answer, Enter for the next word.")}</p>
      <div id="result"></div>
    </div>`;

  wireAudio(root);
  bindQuizKeys();
  root.querySelectorAll(".options button").forEach((b) => {
    b.addEventListener("click", () => {
      if (quiz.answered) return;
      quiz.answered = true;
      const right = b.dataset.place === e.place;
      if (right) quiz.score++;
      root.querySelectorAll(".options button").forEach((x) => {
        x.disabled = true;
        if (x.dataset.place === e.place) x.classList.add("right");
        else if (x === b) x.classList.add("wrong");
      });
      const place = store.places.get(e.place);
      map.flash(e.place, "correct");
      if (!right) map.flash(b.dataset.place, "wrong");
      const res = root.querySelector("#result");
      res.innerHTML = `
        <p class="result ${right ? "right" : "wrong"}"><strong>${t(right ? "Right." : "Not quite.")}</strong>
        ${t("This is from {place}.", { place: esc(placeName(place)) })}${e.standard?.tr ? " " + t("In standard Kannada it is {w}.", { w: esc(isKn() && e.standard.kn ? e.standard.kn : e.standard.tr) }) : ""}</p>
        ${dt.note(e) ? `<p class="note">${esc(dt.note(e))}</p>` : ""}
        <div class="actions"><button class="btn" type="button" id="next">${t(quiz.i + 1 < quiz.questions.length ? "Next word" : "See your score")}</button></div>`;
      const next = res.querySelector("#next");
      next.focus();
      next.addEventListener("click", () => {
        quiz.i++;
        quiz.answered = false;
        renderQuiz(root);
      });
    });
  });
}

export function resetQuiz() { quiz = null; }

// Number keys answer, Enter moves on. Bound once, only acts on the quiz page.
let quizKeysBound = false;
function bindQuizKeys() {
  if (quizKeysBound) return;
  quizKeysBound = true;
  document.addEventListener("keydown", (ev) => {
    if (!location.hash.startsWith("#/quiz") || ev.target.matches("input, textarea, select")) return;
    const card = document.querySelector(".quiz-card");
    if (!card) return;
    if (/^[1-4]$/.test(ev.key)) {
      card.querySelectorAll(".options button")[Number(ev.key) - 1]?.click();
    } else if (ev.key === "Enter" && document.activeElement?.id !== "next") {
      card.querySelector("#next")?.click();
    }
  });
}

// ---------- Add a word ----------
const KN = /[ಀ-೿]/;
const LATIN = /[A-Za-z]/;

// One rule list per field: [test, message]. The first failing rule is shown.
const RULES = {
  place: [[(v) => v, "Choose where this word is used."]],
  town: [[(v, f) => f.place.value !== "other" || v, "Write the name of your town or village."]],
  kn: [
    [(v) => v, "Write the word in Kannada script."],
    [(v) => KN.test(v), "Use Kannada letters here, like ಬತ್ತೆ. Put the English-letter spelling in the next box."],
    [(v) => !LATIN.test(v), "Keep English letters out of this box. Put them in “How to read it”."],
  ],
  tr: [
    [(v) => v, "Write how it sounds in English letters, like batte."],
    [(v) => !KN.test(v), "Use English letters here, like batte. The Kannada spelling goes in the box before."],
    [(v) => LATIN.test(v), "Write it with English letters, like batte."],
  ],
  english: [
    [(v) => v, "Write what the word means in English."],
    [(v) => LATIN.test(v), "Write the meaning in English, like “I will come”."],
  ],
  std: [[(v) => !v || KN.test(v), "Use Kannada script for the standard form, like ಬರುತ್ತೇನೆ, or leave it empty."]],
};

function fieldError(form, name) {
  const v = (form[name]?.value || "").trim();
  for (const [ok, msg] of RULES[name] || []) if (!ok(v, form)) return t(msg);
  return "";
}

function showFieldError(form, name, msg) {
  const input = form[name];
  const err = form.querySelector(`#err-${name}`);
  if (!input || !err) return;
  input.setAttribute("aria-invalid", msg ? "true" : "false");
  err.textContent = msg;
  err.hidden = !msg;
}

let lastAdded = null; // id of the word just added, for the thank-you page

export function renderAdd(root, { place: preset } = {}) {
  const places = [...store.places.values()].sort((a, b) => placeName(a).localeCompare(placeName(b), isKn() ? "kn" : "en"));
  const mine = readContributions();
  const field = (name, label, input, hint = "") => `
    <div class="field">
      <label for="f-${name}">${label}</label>
      ${input}
      ${hint ? `<p class="hint" id="hint-${name}">${hint}</p>` : ""}
      <p class="err" id="err-${name}" hidden></p>
    </div>`;
  const desc = (name, hint) => `aria-describedby="err-${name}${hint ? ` hint-${name}` : ""}"`;

  root.innerHTML = `
    <h1>${t("Add a word")}</h1>
    <p class="lede">${t("Know how people talk in your town? Add a word or phrase the way you would say it at home.")}</p>
    <form class="form" id="add" novalidate>
      <div class="form-alert" id="form-alert" role="alert" tabindex="-1" hidden></div>
      ${field("place", t("Where is it said?"), `
        <select id="f-place" name="place" required ${desc("place")}>
          <option value="">${t("Choose a place")}</option>
          ${places.map((p) => `<option value="${p.id}" ${p.id === preset ? "selected" : ""}>${esc(placeName(p))}</option>`).join("")}
          <option value="other">${t("My town is not on the map")}</option>
        </select>`)}
      <div id="town-field" hidden>
        ${field("town", t("Your town or village"), `<input id="f-town" name="town" maxlength="60" autocomplete="address-level2" ${desc("town")}>`)}
      </div>
      <div class="two">
        ${field("kn", t("The word, in Kannada"), `<input id="f-kn" name="kn" lang="kn" maxlength="80" required placeholder="ಬತ್ತೆ" ${desc("kn")}>`)}
        ${field("tr", t("How to read it in English letters"), `<input id="f-tr" name="tr" maxlength="80" required placeholder="batte" autocapitalize="off" ${desc("tr")}>`)}
      </div>
      ${field("english", t("What it means in English"), `<input id="f-en" name="english" maxlength="120" required placeholder="I will come" ${desc("english")}>`)}
      ${field("std", `${t("Standard Kannada for the same thing")} <span class="muted">${t("(optional)")}</span>`, `<input id="f-std" name="std" lang="kn" maxlength="80" placeholder="ಬರುತ್ತೇನೆ" ${desc("std")}>`)}
      ${field("note", `${t("An example or story behind it")} <span class="muted">${t("(optional)")}</span>`, `<textarea id="f-note" name="note" maxlength="500" placeholder="${t("My grandmother says this when...")}" ${desc("note", true)}></textarea>`, t("{n} of 500 characters", { n: `<span id="note-count">0</span>` }))}
      ${field("name", `${t("Your name")} <span class="muted">${t("(optional)")}</span>`, `<input id="f-name" name="name" maxlength="60" autocomplete="name" ${desc("name", true)}>`, t("Shown as the contributor if the word is added to the site."))}
      <div class="actions"><button class="btn" type="submit" id="add-submit">${t("Add this word")}</button></div>
    </form>
    <h2>${t("Words you added on this device")}</h2>
    ${mine.length
      ? `<div class="words">${mine.map((e) => wordCard(e, { showPlace: true })).join("")}</div>`
      : `<p class="muted empty-line">${t("Nothing yet. Words you add appear here and on the map, marked as added by you.")}</p>`}
  `;
  wireAudio(root);

  const form = root.querySelector("#add");
  const alertBox = root.querySelector("#form-alert");
  const townField = root.querySelector("#town-field");
  const submitBtn = root.querySelector("#add-submit");
  const noteCount = root.querySelector("#note-count");
  const syncTown = () => {
    townField.hidden = form.place.value !== "other";
    if (townField.hidden) showFieldError(form, "town", "");
  };
  form.place.addEventListener("change", syncTown);
  syncTown();
  form.note.addEventListener("input", () => { noteCount.textContent = form.note.value.length; });

  // Check a field when the visitor leaves it, and clear its error as soon as it is fixed.
  const touched = new Set();
  for (const name of Object.keys(RULES)) {
    const input = form[name];
    input.addEventListener("blur", () => {
      if (!input.value.trim() && !touched.has(name)) return; // don't nag on an untouched empty field
      touched.add(name);
      showFieldError(form, name, fieldError(form, name));
    });
    input.addEventListener(input.tagName === "SELECT" ? "change" : "input", () => {
      if (input.getAttribute("aria-invalid") === "true") {
        const msg = fieldError(form, name);
        showFieldError(form, name, msg);
        if (!msg && !form.querySelector('[aria-invalid="true"]')) alertBox.hidden = true;
      }
    });
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const bad = [];
    for (const name of Object.keys(RULES)) {
      if (name === "town" && form.place.value !== "other") continue;
      const msg = fieldError(form, name);
      showFieldError(form, name, msg);
      touched.add(name);
      if (msg) bad.push(name);
    }
    if (bad.length) {
      alertBox.innerHTML = `<strong>${bad.length === 1 ? t("One field needs fixing.") : t("{n} fields need fixing.", { n: bad.length })}</strong> ${t("The message under each one says what to change.")}`;
      alertBox.className = "form-alert error";
      alertBox.hidden = false;
      form[bad[0]].focus();
      return;
    }
    alertBox.hidden = true;

    const isOther = form.place.value === "other";
    const entry = {
      id: `you-${Date.now()}`,
      place: isOther ? null : form.place.value,
      town: isOther ? form.town.value.trim() : undefined,
      type: "word",
      english: form.english.value.trim(),
      standard: form.std.value.trim() ? { kn: form.std.value.trim(), tr: "" } : null,
      dialect: { kn: form.kn.value.trim(), tr: form.tr.value.trim() },
      note: form.note.value.trim() || undefined,
      contributor: form.name.value.trim() || undefined,
      source: null,
      confidence: "contributed",
      verified: false,
      contributed: true,
    };

    setBusy(submitBtn, true, t("Saving…"));
    // Saving is instant, but a short beat lets the visitor see it happen.
    setTimeout(() => {
      const saved = saveContribution(entry);
      setBusy(submitBtn, false);
      if (!saved) {
        alertBox.innerHTML = `<strong>${t("Could not save on this device.")}</strong> ${t("Your browser is blocking storage (private mode can do this). Copy the word instead and send it to the project.")}
          <div class="actions"><button class="btn ghost" type="button" id="copy-failed">${t("Copy as JSON")}</button></div>`;
        alertBox.className = "form-alert error";
        alertBox.hidden = false;
        alertBox.focus();
        alertBox.querySelector("#copy-failed").addEventListener("click", async () => {
          const ok = await copyText(JSON.stringify(entry, null, 2));
          toast(t(ok ? "Copied. Paste it in a message to the project." : "Could not copy. Select the text and copy it yourself."), ok ? "ok" : "error");
        });
        return;
      }
      map.refreshPinCounts();
      lastAdded = entry.id;
      try { sessionStorage.setItem("nk.lastAdded", entry.id); } catch { /* fine without it */ }
      location.hash = "#/thanks";
    }, 350);
  });

  map.setActive(preset || null);
  map.highlightZone(preset ? store.places.get(preset)?.zone : null);
}

// ---------- Thank you, after adding a word ----------
export function renderThanks(root) {
  let id = lastAdded;
  if (!id) { try { id = sessionStorage.getItem("nk.lastAdded"); } catch { id = null; } }
  const e = id ? entryById(id) : null;
  map.setActive(e?.place || null);
  map.highlightZone(e?.place ? store.places.get(e.place)?.zone : null);

  if (!e) {
    root.innerHTML = `<h1>${t("Add a word")}</h1>` + emptyHtml({
      title: t("Nothing added yet"),
      body: t("This page thanks you after you add a word. Add one from your town to see it here."),
      actions: `<a class="btn" href="#/add">${t("Add a word")}</a><a class="btn ghost" href="#/">${t("Explore the map")}</a>`,
    });
    return;
  }

  const place = e.place ? store.places.get(e.place) : null;
  const where = place ? placeName(place) : e.town;
  root.innerHTML = `
    <div class="thanks" tabindex="-1">
      <p class="thanks-kn" lang="kn" aria-hidden="true">ಧನ್ಯವಾದ!</p>
      <h1>${e.contributor ? t("Thank you, {name}!", { name: esc(e.contributor) }) : t("Thank you!")}</h1>
      <p class="lede">${place ? t("Your word from {place} is saved and now shows on the {place} page, marked as added by you.", { place: esc(where) }) : t("Your word from {place} is saved on this device.", { place: esc(where) })}</p>
    </div>
    <div class="words">${wordCard(e, { showPlace: true })}</div>
    <div class="next-steps">
      <h2>${t("What happens next")}</h2>
      <ol class="steps">
        <li>${t("It is saved in this browser, so only you can see it for now.")}</li>
        <li>${t(CONFIG.GOOGLE_FORM_URL ? "Send it to the project so it can be checked by a speaker and added for everyone." : "Copy it and send it to the project so it can be checked by a speaker and added for everyone.")}</li>
      </ol>
    </div>
    <div class="actions">
      ${place ? `<a class="btn" href="#/place/${place.id}">${t("See it on {place}", { place: esc(placeName(place)) })}</a>` : ""}
      <a class="btn ghost" href="#/add${place ? `?place=${place.id}` : ""}">${t("Add another word")}</a>
      <button class="btn ghost" type="button" id="copy">${t("Copy as JSON")}</button>
      ${CONFIG.GOOGLE_FORM_URL ? `<a class="btn ghost" href="${esc(CONFIG.GOOGLE_FORM_URL)}" target="_blank" rel="noopener">${t("Send it to the project")}</a>` : ""}
    </div>`;
  wireAudio(root);
  root.querySelector(".thanks").focus();
  toast(t("Word added. Thank you!"));
  root.querySelector("#copy").addEventListener("click", async (ev) => {
    const b = ev.currentTarget;
    const ok = await copyText(JSON.stringify(e, null, 2));
    if (ok) { b.textContent = t("Copied ✓"); setTimeout(() => { b.textContent = t("Copy as JSON"); }, 2000); }
    toast(t(ok ? "Copied to your clipboard." : "Could not copy. Your browser blocked the clipboard."), ok ? "ok" : "error");
  });
}

// ---------- How to say it ----------
const VOWEL_GUIDE = [
  ["a", "a in about", "blr-13", "dialect"],
  ["aa", "a in father", "kun-02", "dialect"],
  ["i", "i in sit", "dwd-01", "dialect"],
  ["ee", "ee in see", "bdr-01", "dialect"],
  ["u", "u in put", "kun-03", "dialect"],
  ["oo", "oo in food", "sir-09", "dialect"],
  ["e / eh", "e in bet", "sir-01", "dialect"],
  ["ay", "ay in say", "dwd-02", "standard"],
  ["o", "o in go, but short", "sir-10", "dialect"],
  ["oh", "o in go, held longer", "blr-14", "dialect"],
  ["ai", "ai in aisle", "bgm-04", "standard"],
];
const CONSONANT_GUIDE = [
  ["T  D  N  L  Sh", "Capital letters: curl the tip of your tongue back and touch the roof of your mouth. ಡ in ಬೇಡ is not the English d.", ["dwd-02:standard", "dwd-04:dialect", "bgm-03:dialect"]],
  ["t  d", "Small t and d: touch your tongue to the back of your upper teeth. Softer than English t and d.", ["sir-04:dialect", "bgk-10:dialect"]],
  ["kh  gh  th  dh  ph  bh", "An h after a letter means a puff of air: say k and breathe out with it. th is never the th in 'the' or 'thin'.", ["bgm-01:dialect", "bdr-01:dialect"]],
  ["kk  tt  TT  ll", "Doubled letters are held a beat longer, split across syllables: bat-teh, not ba-teh. Getting this wrong can change the word.", ["blr-01:dialect", "bgk-04:dialect"]],
  ["r", "A quick tap of the tongue, as in Spanish pero. Never silent.", ["sir-10:dialect"]],
];
const SOUND_CHANGES = [
  ["North Karnataka", "A final e becomes i, and a long e turns into yaa.", ["dwd-01", "dwd-02"]],
  ["Bagalkote", "A final u becomes a, and a long e at the end turns into yaa.", ["bgk-01", "bgk-04"]],
  ["Dharwad", "An a is added after words, and akka becomes yakka.", ["dwd-03", "dwd-05"]],
  ["Havyaka (Sirsi)", "o and e at the start of a word become wa and ye: ole is said wale. Short three-syllable words double their last consonant: harake becomes harakke.", ["sir-14", "sir-20"]],
  ["Kundapura", "Long verb endings are cut short: hoguttene becomes hote.", ["kun-01"]],
  ["Halakki (Ankola)", "An r before D turns into y, so eraDu becomes eyDu. Middle vowels drop: bāgilu becomes bāgla.", ["hlk-11", "hlk-04"]],
  ["Malenadu", "Some s and L sounds shift: sappe becomes chappe, kēLu becomes kēNu.", ["mal-04", "mal-05"]],
  ["Kalaburagi", "Final e and u turn to i or a, e and o at the start become ya and va (ondu is vandu), and long ē and ō become yā and wā (kōNa is kwāNā).", ["klb-04", "klb-15", "klb-17"]],
  ["Arebhashe", "The final u falls off (nānu becomes nā), i turns into e (ili is eli), and g hardens to k (kāge is kakke).", ["are-01", "are-12", "are-14"]],
];

function guideExample(ref) {
  const [id, side = "dialect"] = ref.split(":");
  const e = entryById(id);
  if (!e || !e[side]) return "";
  const p = store.places.get(e.place);
  const kn = e[side].kn;
  return `<span class="ex">
    ${kn ? `<span lang="kn">${esc(kn)}</span>` : ""}
    <span class="s">${esc(kn ? sayIt(kn) : e[side].tr)}</span>
    <span class="muted">${esc(dt.meaning(e))}${side === "standard" ? `, ${t("standard")}` : `, <a href="#/place/${p.id}">${esc(placeName(p))}</a>`}</span>
    ${soundButton(e, side, "small")}
  </span>`;
}

export function renderGuide(root) {
  root.innerHTML = `
    <h1>${t("How to say it")}</h1>
    <p class="lede">${t("Every word has a “Say it” line that spells it the way it sounds, split into syllables. Say each syllable evenly: Kannada doesn't punch one syllable the way English does.")}</p>
    <p class="muted">${t("Kannada is written the way it is spoken, so these spellings come straight from the Kannada letters.")}</p>

    <h2>${t("Vowels")}</h2>
    <table class="guide">
      <thead><tr><th scope="col">${t("Written")}</th><th scope="col">${t("Sounds like")}</th><th scope="col">${t("Example")}</th></tr></thead>
      <tbody>${VOWEL_GUIDE.map(([w, like, id, side]) => `
        <tr><td class="w">${esc(w)}</td><td>${esc(t(like))}</td><td>${guideExample(`${id}:${side}`)}</td></tr>`).join("")}
      </tbody>
    </table>
    <p class="muted">${t("A final e is written eh so you don't drop it: ಬತ್ತೆ is bat-teh, two full syllables.")}</p>

    <h2>${t("Sounds English doesn't have")}</h2>
    <div class="guide-list">${CONSONANT_GUIDE.map(([w, how, refs]) => `
      <section>
        <h3 class="w">${esc(w)}</h3>
        <p>${esc(t(how))}</p>
        <div class="exs">${refs.map(guideExample).join("")}</div>
      </section>`).join("")}
    </div>

    <h2>${t("How regions change the sound")}</h2>
    <p>${t("The same letters can be bent differently from place to place. These patterns are what make a speaker sound like they're from somewhere.")}</p>
    <div class="guide-list">${SOUND_CHANGES.map(([where, how, ids]) => `
      <section>
        <h3>${esc(t(where))}</h3>
        <p>${esc(t(how))}</p>
        <div class="exs">${ids.map((id) => guideExample(id)).join("")}</div>
      </section>`).join("")}
    </div>
  `;
  wireAudio(root);
  map.setActive(null);
  map.highlightZone(null);
}

// ---------- Sources ----------
const SOURCE_NOTES = {
  havyaka: "Havyaka (Havigannada) comparison tables: pronouns, verbs, question words",
  bengaluru: "Bengaluru slang and Kanglish phrases",
  kanglish: "How English words take a -u ending",
  tnm_north: "North Karnataka sound changes and Marathi and Dakhni loanwords",
  ciil_dharwad: "CIIL description of Dharwad Kannada",
  kundapura_wiki: "Where Kundagannada is spoken",
  kundapura_dictionary: "Kundapura Kannada dictionary (archived)",
  kundapura_blog: "Kundapura words shared by speakers (blog)",
  kundapura_prajavani: "Prajavani feature on the Kundagannada dictionary",
  mangaluru_wiki: "Mangaluru Kannada overview",
  deccan_herald: "Deccan Herald on Karnataka's dialect regions",
  kannada_dialects_list: "List of Kannada dialects",
  kolar_wiki: "Kolar's languages",
  mandya_quora: "Mandya greeting compared with Bengaluru (forum)",
  mandya_thesis: "University of Mysore thesis on a Mandya dialect",
  mysuru_blog: "Mysuru Kannada as the prestige spoken variety",
  sarvam_voice: "Sarvam AI Bulbul: AI voice clips",
  aarva_karnaata: "@aarva_karnaata on Instagram: dialect posts on Bagalkote, Halakki, Malenadu, Arebhashe, Dharwad, Kalaburagi, Kundapura and Havyaka Kannada",
  kannada_gothilla: "@kannada.gothilla on Instagram: Bengaluru slang",
  malenada_nudikosha: "Malenada Nudikosha, ed. Venakshi S. D., Karnataka Folklore University, 2014 (read on Bharatavani): Malenadu words checked against it, with page numbers",
  padakanaja: "Kannada Janapada Nighantu (Karnataka Folklore University, 2014) on Padakanaja, the Government of Karnataka's dictionary portal: district-tagged folk words, cited by entry number",
  alar_voice: "Alar voice corpus: dictionary audio clips (GPL-2.0, generated with Google TTS)",
};

export function renderSources(root) {
  const counts = {};
  for (const e of store.entries) {
    counts[e.source] = (counts[e.source] || 0) + 1;
    if (e.dict) counts[e.dict.ref] = (counts[e.dict.ref] || 0) + 1;
  }
  root.innerHTML = `
    <h1>${t("Sources")}</h1>
    <p class="lede">${t("Every word links back to where it came from. Words marked “Not yet checked by a speaker” are waiting for a native speaker to confirm them.")}</p>
    ${Object.keys(store.data.sources || {}).length ? "" : emptyHtml({ title: t("No sources listed yet") })}
    <ol class="sources">
      ${Object.entries(store.data.sources || {}).map(([k, url]) => `
        <li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(t(SOURCE_NOTES[k] || k))}</a>
        <span class="muted">${counts[k] ? `, ${plural(counts[k], "word", "words")}` : ""}</span></li>`).join("")}
    </ol>
    ${isKn() ? SOURCES_TAIL_KN : `<h2>Sound</h2>
    <p>“Recording” plays a clip recorded by a Kannada speaker. “Listen” is a computer voice reading the spelling in a standard accent, so it gives the shape of a word but not its local tune. Clips made with <a href="https://www.sarvam.ai/text-to-speech" target="_blank" rel="noopener">Sarvam AI’s Bulbul</a> voice are used first; where there is none and the <a href="https://github.com/Aditya-ds-1806/Alar-voice-corpus" target="_blank" rel="noopener">Alar voice corpus</a> has the word, its clip is used. Both play in any browser. Otherwise the browser’s own Kannada voice is used: Microsoft Edge on Windows and Chrome on Android have one, other browsers may not, and the button is hidden there.</p>
    <p><a href="#/record">Record words</a> to add real voices.</p>
    <h2>Map</h2>
    <p>District boundaries from <a href="https://github.com/udit-001/india-maps-data" target="_blank" rel="noopener">india-maps-data</a> (2011 census districts). Regions are approximate cultural zones, not official divisions.</p>`}`;
  map.setActive(null);
  map.highlightZone(null);
}

// ---------- Privacy policy and terms (drafts for the owner to review) ----------
const LEGAL_UPDATED = "25 October 2026";
const REPO_URL = "https://github.com/akshobyaas/nammakannada-ak";

function draftNote() {
  return `<div class="draft-note" role="note">
    <strong>Plain-language summary.</strong> This page describes how this student project works. It was not written or checked by a lawyer.
  </div>`;
}

function contactLine() {
  const c = CONFIG.CONTACT || {};
  if (c.email) return `email <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`;
  return `open an issue on the project's <a href="${REPO_URL}/issues" target="_blank" rel="noopener">GitHub page</a>`;
}

export function renderPrivacy(root) {
  const form = !!CONFIG.GOOGLE_FORM_URL;
  if (isKn()) { root.innerHTML = privacyKn(form); map.setActive(null); map.highlightZone(null); return; }
  root.innerHTML = `
    <article class="legal">
      <h1>Privacy policy</h1>
      <p class="muted">Last updated ${LEGAL_UPDATED}</p>
      ${draftNote()}
      <p class="lede">Namma Kannada is a free, non-commercial project that documents how Kannada is spoken across Karnataka. It collects as little as possible.</p>

      <h2>The short version</h2>
      <ul>
        <li>No accounts, no ads, and no tracking cookies.</li>
        <li>Words you add and recordings you make stay on your own device unless you choose to send them.</li>
        <li>We count visits with Vercel Web Analytics, which does not use cookies and does not store your IP address.</li>
        <li>We never sell or share personal data.</li>
      </ul>

      <h2>What happens when you visit</h2>
      <p>The site is hosted by Vercel. Like any web host, Vercel's servers receive your IP address and browser details to deliver the pages to you. See <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener">Vercel's privacy policy</a>.</p>
      <p>All fonts, sounds and data are served from this site itself. Your browser does not contact Google Fonts or any other third party while you browse.</p>

      <h2>Analytics</h2>
      <p>We use <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener">Vercel Web Analytics</a> to see how many people visit and which parts they use. For each page view it records the page address, the referring site, an approximate location (country, region, city), and your device type, operating system and browser.</p>
      <p>It does not use cookies. Visitors are told apart by a hash made from the request rather than a cookie, Vercel discards visitor sessions after 24 hours, and data points are not tied to your IP address. Blocking the script with a content blocker does not affect how the site works.</p>

      <h2>Words you add</h2>
      <p>When you use <a href="#/add">Add a word</a>, what you type, including your name if you give one, is saved only in your browser's local storage on this device. It is not sent to us. You can remove it at any time by clearing this site's data in your browser settings.</p>
      ${form
        ? `<p>If you press “Send it to the project”, you are taken to a Google Form. What you submit there is stored by Google and shared with the project owner, under <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's privacy policy</a>. We use it only to review your word and, if you agree, publish it with credit.</p>`
        : `<p>“Copy as JSON” copies your word so you can send it to the project yourself. Whatever you send is used only to review the word and, with your agreement, publish it with credit.</p>`}

      <h2>Recordings</h2>
      <p>The <a href="#/record">Record words</a> and <a href="#/ajji">Ajji's words</a> pages ask for your microphone only when you start recording. Recordings stay in your browser tab and are only saved to your device, or shared through your phone's share menu, when you choose to. Nothing is uploaded to this site. Ajji's words asks you to confirm the speaker has agreed to be recorded before it starts.</p>

      <h2>Cookies and storage</h2>
      <p>The site sets no cookies. It uses your browser's local storage only for the words you add and to remember the language you chose, which those features need to work. Because there are no tracking cookies, there is no cookie banner.</p>

      <h2>Links to other sites</h2>
      <p>Word sources link to sites such as Instagram, Wikipedia and news websites. They have their own privacy policies, which apply once you follow a link.</p>

      <h2>Children</h2>
      <p>The site is suitable for all ages and does not knowingly collect personal data from anyone. Some entries document caste terms, insults or violence as part of the language record; these are labelled or hidden behind a tap.</p>

      <h2>Your rights and contact</h2>
      <p>Namma Kannada is run by Akshobya A S, a student in Mysuru, Karnataka.</p>
      <p>Because we hold no personal data on our servers, there is usually nothing to access or delete. If you sent us a word and want it removed or your name taken off, ${contactLine()}.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the new version will be posted here with a new date.</p>
    </article>`;
  map.setActive(null);
  map.highlightZone(null);
}

export function renderTerms(root) {
  if (isKn()) { root.innerHTML = termsKn(); map.setActive(null); map.highlightZone(null); return; }
  root.innerHTML = `
    <article class="legal">
      <h1>Terms of use</h1>
      <p class="muted">Last updated ${LEGAL_UPDATED}</p>
      ${draftNote()}
      <p>Namma Kannada is run by Akshobya A S.</p>
      <p class="lede">By using Namma Kannada you agree to these terms. If you do not agree, please do not use the site.</p>

      <h2>What this site is</h2>
      <p>Namma Kannada is a free, non-commercial educational project, built for the Kannada Digital Innovation Hackathon 2026, that records how spoken Kannada varies across Karnataka.</p>

      <h2>Accuracy</h2>
      <p>Words come from published dictionaries, research, articles, social media posts and native speakers. Each one links to its source. Most have <strong>not yet been checked by a speaker</strong> and are marked that way. Spellings, meanings and pronunciations may be wrong. Please do not rely on the site for anything where accuracy matters.</p>
      <p>Computer voices (Sarvam AI's Bulbul and the Alar voice corpus) read words in a standard accent and can mispronounce them. They are not recordings of local speakers.</p>

      <h2>Sensitive content</h2>
      <p>Language includes words about caste, community and violence, and insults. Some are included because they are part of how people actually speak. They are documented, not endorsed. Such entries are labelled, and the strongest are hidden until you tap to show them.</p>

      <h2>Words you contribute</h2>
      <ul>
        <li>Only send words and stories you know first-hand or have the right to share.</li>
        <li>Do not include other people's personal details, or anything hateful, abusive or meant to harm a group.</li>
        <li>By sending a word to the project, you allow it to be published on the site and in its open dataset, credited with the name you give, or without a name if you leave it blank.</li>
        <li>We may edit, correct or decline any contribution.</li>
      </ul>

      <h2>Content and credits</h2>
      <ul>
        <li>Short dialect examples are quoted from the sources listed on the <a href="#/sources">Sources</a> page for documentation. Those sources keep their own rights.</li>
        <li>Map boundaries come from <a href="https://github.com/udit-001/india-maps-data" target="_blank" rel="noopener">india-maps-data</a>. Some sound clips come from the <a href="https://github.com/Aditya-ds-1806/Alar-voice-corpus" target="_blank" rel="noopener">Alar voice corpus</a> (GPL-2.0).</li>
        <li>Fonts (Gluten, Fredoka, Baloo Tamma 2) are used under the SIL Open Font License.</li>
        <li>The site's own code is released under the <a href="https://github.com/akshobyaas/nammakannada-ak/blob/main/LICENSE" target="_blank" rel="noopener">MIT License</a>. The dataset in <code>data/dialects.json</code>, as compiled here, is shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>: you may reuse it with credit, under the same licence. Quoted material, the Alar clips and the fonts keep their own licences listed above.</li>
      </ul>

      <h2>No warranty</h2>
      <p>The site is provided “as is”, without any warranty. To the extent the law allows, the project and its creator are not liable for any loss arising from use of the site or reliance on its content.</p>

      <h2>Changes and contact</h2>
      <p>These terms may change; the date above shows the latest version. For questions, ${contactLine()}.</p>
      <p>These terms are governed by the laws of India.</p>
    </article>`;
  map.setActive(null);
  map.highlightZone(null);
}

export function renderNotFound(root) {
  root.innerHTML = `
    <div class="notfound">
      <p class="nf-code" aria-hidden="true">404</p>
      <h1><span lang="kn">ಅಯ್ಯೋ!</span> ${t("This page got lost")}</h1>
      <p class="lede">${t("There is no place or page at this address. It may have been renamed, or the link has a typo.")}</p>
      <div class="actions">
        <a class="btn" href="#/">${t("Back to the map")}</a>
        <a class="btn ghost" href="#/quiz">${t("Play Guess the region")}</a>
      </div>
    </div>`;
  map.setActive(null);
  map.highlightZone(null);
}

// ---------- Kannada versions of the long prose pages ----------
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const SOURCES_TAIL_KN = `
    <h2>ಧ್ವನಿ</h2>
    <p>“ಧ್ವನಿಮುದ್ರಣ” ಕನ್ನಡ ಮಾತನಾಡುವವರು ದಾಖಲಿಸಿದ ತುಣುಕನ್ನು ಕೇಳಿಸುತ್ತದೆ. “ಕೇಳಿ” ಎಂಬುದು ಕಂಪ್ಯೂಟರ್ ಧ್ವನಿ; ಅದು ಕಾಗುಣಿತವನ್ನು ಶಿಷ್ಟ ಉಚ್ಚಾರದಲ್ಲಿ ಓದುತ್ತದೆ, ಹಾಗಾಗಿ ಪದದ ಆಕಾರ ತಿಳಿಯುತ್ತದೆಯೇ ಹೊರತು ಸ್ಥಳೀಯ ಧಾಟಿಯಲ್ಲ. ${A("https://www.sarvam.ai/text-to-speech", "ಸರ್ವಮ್ ಎಐನ ಬುಲ್‌ಬುಲ್")} ಧ್ವನಿಯಲ್ಲಿ ಮಾಡಿದ ತುಣುಕುಗಳಿಗೆ ಮೊದಲ ಆದ್ಯತೆ; ಅದು ಇಲ್ಲದಿದ್ದರೆ ಮತ್ತು ${A("https://github.com/Aditya-ds-1806/Alar-voice-corpus", "ಅಲರ್ ಧ್ವನಿ ಸಂಗ್ರಹ")}ದಲ್ಲಿ ಪದವಿದ್ದರೆ ಅದರ ತುಣುಕು ಬಳಕೆಯಾಗುತ್ತದೆ. ಇವೆರಡೂ ಯಾವ ಬ್ರೌಸರ್‌ನಲ್ಲಾದರೂ ಕೇಳಿಸುತ್ತವೆ. ಇಲ್ಲದಿದ್ದರೆ ಬ್ರೌಸರ್‌ನದೇ ಕನ್ನಡ ಧ್ವನಿ ಬಳಕೆಯಾಗುತ್ತದೆ: ವಿಂಡೋಸ್‌ನ ಮೈಕ್ರೋಸಾಫ್ಟ್ ಎಡ್ಜ್ ಮತ್ತು ಆಂಡ್ರಾಯ್ಡ್‌ನ ಕ್ರೋಮ್‌ನಲ್ಲಿ ಅದು ಇದೆ; ಬೇರೆ ಬ್ರೌಸರ್‌ಗಳಲ್ಲಿ ಇಲ್ಲದಿರಬಹುದು, ಆಗ ಆ ಬಟನ್ ಕಾಣುವುದಿಲ್ಲ.</p>
    <p><a href="#/record">ಪದಗಳನ್ನು ಧ್ವನಿಮುದ್ರಿಸಿ</a>, ನಿಜವಾದ ಧ್ವನಿಗಳನ್ನು ಸೇರಿಸಿ.</p>
    <h2>ನಕ್ಷೆ</h2>
    <p>ಜಿಲ್ಲಾ ಗಡಿಗಳು ${A("https://github.com/udit-001/india-maps-data", "india-maps-data")}ಯಿಂದ (2011ರ ಜನಗಣತಿ ಜಿಲ್ಲೆಗಳು). ಪ್ರದೇಶಗಳು ಅಂದಾಜು ಸಾಂಸ್ಕೃತಿಕ ವಲಯಗಳು, ಅಧಿಕೃತ ವಿಭಾಗಗಳಲ್ಲ.</p>`;

function contactLineKn() {
  const c = CONFIG.CONTACT || {};
  if (c.email) return `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a> ಗೆ ಇಮೇಲ್ ಮಾಡಿ`;
  return `ಯೋಜನೆಯ ${A(`${REPO_URL}/issues`, "ಗಿಟ್‌ಹಬ್ ಪುಟ")}ದಲ್ಲಿ ಒಂದು ಇಶ್ಯೂ ತೆರೆಯಿರಿ`;
}

const LEGAL_NOTE_KN = `<div class="draft-note" role="note"><strong>ಸರಳ ಭಾಷೆಯ ಸಾರಾಂಶ.</strong> ಈ ವಿದ್ಯಾರ್ಥಿ ಯೋಜನೆ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ ಎಂಬುದನ್ನು ಈ ಪುಟ ವಿವರಿಸುತ್ತದೆ. ಇದನ್ನು ವಕೀಲರು ಬರೆದಿಲ್ಲ ಅಥವಾ ಪರಿಶೀಲಿಸಿಲ್ಲ. ಇಂಗ್ಲಿಷ್ ಆವೃತ್ತಿಯೇ ಮೂಲ.</div>`;

function privacyKn(form) {
  return `
    <article class="legal">
      <h1>ಗೌಪ್ಯತಾ ನೀತಿ</h1>
      <p class="muted">ಕೊನೆಯ ಪರಿಷ್ಕರಣೆ: 25 ಅಕ್ಟೋಬರ್ 2026</p>
      ${LEGAL_NOTE_KN}
      <p class="lede">ನಮ್ಮ ಕನ್ನಡ ಉಚಿತ, ವಾಣಿಜ್ಯೇತರ ಯೋಜನೆ; ಕರ್ನಾಟಕದಾದ್ಯಂತ ಕನ್ನಡ ಹೇಗೆ ಮಾತನಾಡಲ್ಪಡುತ್ತದೆ ಎಂಬುದನ್ನು ದಾಖಲಿಸುತ್ತದೆ. ಇದು ಸಾಧ್ಯವಾದಷ್ಟು ಕಡಿಮೆ ಮಾಹಿತಿಯನ್ನು ಸಂಗ್ರಹಿಸುತ್ತದೆ.</p>

      <h2>ಸಂಕ್ಷಿಪ್ತವಾಗಿ</h2>
      <ul>
        <li>ಖಾತೆಗಳಿಲ್ಲ, ಜಾಹೀರಾತುಗಳಿಲ್ಲ, ಟ್ರ್ಯಾಕಿಂಗ್ ಕುಕೀಗಳಿಲ್ಲ.</li>
        <li>ನೀವು ಸೇರಿಸುವ ಪದಗಳು ಮತ್ತು ಧ್ವನಿಮುದ್ರಣಗಳು ನೀವಾಗಿ ಕಳುಹಿಸದ ಹೊರತು ನಿಮ್ಮ ಸಾಧನದಲ್ಲೇ ಇರುತ್ತವೆ.</li>
        <li>ಭೇಟಿಗಳನ್ನು ವರ್ಸೆಲ್ ವೆಬ್ ಅನಾಲಿಟಿಕ್ಸ್ ಮೂಲಕ ಎಣಿಸುತ್ತೇವೆ; ಅದು ಕುಕೀ ಬಳಸುವುದಿಲ್ಲ, ನಿಮ್ಮ ಐಪಿ ವಿಳಾಸವನ್ನು ಉಳಿಸುವುದಿಲ್ಲ.</li>
        <li>ವೈಯಕ್ತಿಕ ಮಾಹಿತಿಯನ್ನು ನಾವು ಎಂದಿಗೂ ಮಾರುವುದಿಲ್ಲ ಅಥವಾ ಹಂಚುವುದಿಲ್ಲ.</li>
      </ul>

      <h2>ನೀವು ಭೇಟಿ ನೀಡಿದಾಗ</h2>
      <p>ಈ ತಾಣವನ್ನು ವರ್ಸೆಲ್ ಹೋಸ್ಟ್ ಮಾಡುತ್ತದೆ. ಯಾವುದೇ ವೆಬ್ ಹೋಸ್ಟ್‌ನಂತೆ, ಪುಟಗಳನ್ನು ನಿಮಗೆ ತಲುಪಿಸಲು ವರ್ಸೆಲ್‌ನ ಸರ್ವರ್‌ಗಳು ನಿಮ್ಮ ಐಪಿ ವಿಳಾಸ ಮತ್ತು ಬ್ರೌಸರ್ ವಿವರಗಳನ್ನು ಪಡೆಯುತ್ತವೆ. ${A("https://vercel.com/legal/privacy-policy", "ವರ್ಸೆಲ್‌ನ ಗೌಪ್ಯತಾ ನೀತಿ")} ನೋಡಿ.</p>
      <p>ಎಲ್ಲಾ ಫಾಂಟ್‌ಗಳು, ಧ್ವನಿಗಳು ಮತ್ತು ಮಾಹಿತಿ ಈ ತಾಣದಿಂದಲೇ ಬರುತ್ತವೆ. ನೀವು ಬ್ರೌಸ್ ಮಾಡುವಾಗ ನಿಮ್ಮ ಬ್ರೌಸರ್ ಗೂಗಲ್ ಫಾಂಟ್ಸ್ ಅಥವಾ ಬೇರೆ ಯಾವುದೇ ಮೂರನೇ ವ್ಯಕ್ತಿಯನ್ನು ಸಂಪರ್ಕಿಸುವುದಿಲ್ಲ.</p>

      <h2>ಅನಾಲಿಟಿಕ್ಸ್</h2>
      <p>ಎಷ್ಟು ಜನ ಭೇಟಿ ನೀಡುತ್ತಾರೆ, ಯಾವ ಭಾಗಗಳನ್ನು ಬಳಸುತ್ತಾರೆ ಎಂದು ತಿಳಿಯಲು ${A("https://vercel.com/docs/analytics/privacy-policy", "ವರ್ಸೆಲ್ ವೆಬ್ ಅನಾಲಿಟಿಕ್ಸ್")} ಬಳಸುತ್ತೇವೆ. ಪ್ರತಿ ಪುಟ ವೀಕ್ಷಣೆಗೆ ಅದು ಪುಟದ ವಿಳಾಸ, ನಿಮ್ಮನ್ನು ಕಳುಹಿಸಿದ ತಾಣ, ಅಂದಾಜು ಸ್ಥಳ (ದೇಶ, ಪ್ರದೇಶ, ನಗರ), ಮತ್ತು ನಿಮ್ಮ ಸಾಧನದ ಬಗೆ, ಆಪರೇಟಿಂಗ್ ಸಿಸ್ಟಮ್ ಹಾಗೂ ಬ್ರೌಸರ್ ಅನ್ನು ದಾಖಲಿಸುತ್ತದೆ.</p>
      <p>ಇದು ಕುಕೀ ಬಳಸುವುದಿಲ್ಲ. ಸಂದರ್ಶಕರನ್ನು ಕುಕೀಯ ಬದಲು ವಿನಂತಿಯಿಂದ ಮಾಡಿದ ಹ್ಯಾಶ್ ಮೂಲಕ ಗುರುತಿಸಲಾಗುತ್ತದೆ; ವರ್ಸೆಲ್ ಸಂದರ್ಶಕರ ಸೆಷನ್‌ಗಳನ್ನು 24 ಗಂಟೆಗಳ ನಂತರ ಅಳಿಸುತ್ತದೆ, ಮತ್ತು ಮಾಹಿತಿ ನಿಮ್ಮ ಐಪಿ ವಿಳಾಸಕ್ಕೆ ಜೋಡಣೆಯಾಗಿರುವುದಿಲ್ಲ. ಕಂಟೆಂಟ್ ಬ್ಲಾಕರ್‌ನಿಂದ ಈ ಸ್ಕ್ರಿಪ್ಟ್ ತಡೆದರೂ ತಾಣ ಸರಿಯಾಗಿ ಕೆಲಸ ಮಾಡುತ್ತದೆ.</p>

      <h2>ನೀವು ಸೇರಿಸುವ ಪದಗಳು</h2>
      <p><a href="#/add">ಪದ ಸೇರಿಸಿ</a> ಬಳಸಿದಾಗ, ನೀವು ಟೈಪ್ ಮಾಡಿದ್ದು (ನೀವು ಕೊಟ್ಟರೆ ನಿಮ್ಮ ಹೆಸರೂ ಸೇರಿ) ಈ ಸಾಧನದ ಬ್ರೌಸರ್‌ನ ಲೋಕಲ್ ಸ್ಟೋರೇಜ್‌ನಲ್ಲಿ ಮಾತ್ರ ಉಳಿಯುತ್ತದೆ. ಅದು ನಮಗೆ ಬರುವುದಿಲ್ಲ. ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಈ ತಾಣದ ಮಾಹಿತಿಯನ್ನು ಅಳಿಸಿ ಯಾವಾಗ ಬೇಕಾದರೂ ತೆಗೆದುಹಾಕಬಹುದು.</p>
      ${form
        ? `<p>“ಯೋಜನೆಗೆ ಕಳುಹಿಸಿ” ಒತ್ತಿದರೆ ನೀವು ಗೂಗಲ್ ಫಾರ್ಮ್‌ಗೆ ಹೋಗುತ್ತೀರಿ. ಅಲ್ಲಿ ಸಲ್ಲಿಸಿದ್ದು ${A("https://policies.google.com/privacy", "ಗೂಗಲ್‌ನ ಗೌಪ್ಯತಾ ನೀತಿ")}ಯಂತೆ ಗೂಗಲ್‌ನಲ್ಲಿ ಉಳಿದು ಯೋಜನೆಯ ಮಾಲೀಕರಿಗೆ ಹಂಚಲ್ಪಡುತ್ತದೆ. ನಿಮ್ಮ ಪದವನ್ನು ಪರಿಶೀಲಿಸಲು ಮತ್ತು ನೀವು ಒಪ್ಪಿದರೆ ಶ್ರೇಯದೊಂದಿಗೆ ಪ್ರಕಟಿಸಲು ಮಾತ್ರ ಅದನ್ನು ಬಳಸುತ್ತೇವೆ.</p>`
        : `<p>“JSON ಆಗಿ ನಕಲಿಸಿ” ನಿಮ್ಮ ಪದವನ್ನು ನಕಲಿಸುತ್ತದೆ, ಅದನ್ನು ನೀವೇ ಯೋಜನೆಗೆ ಕಳುಹಿಸಬಹುದು. ನೀವು ಕಳುಹಿಸಿದ್ದನ್ನು ಪದವನ್ನು ಪರಿಶೀಲಿಸಲು ಮತ್ತು ನಿಮ್ಮ ಒಪ್ಪಿಗೆಯೊಂದಿಗೆ ಶ್ರೇಯ ನೀಡಿ ಪ್ರಕಟಿಸಲು ಮಾತ್ರ ಬಳಸುತ್ತೇವೆ.</p>`}

      <h2>ಧ್ವನಿಮುದ್ರಣಗಳು</h2>
      <p><a href="#/record">ಪದಗಳನ್ನು ಧ್ವನಿಮುದ್ರಿಸಿ</a> ಮತ್ತು <a href="#/ajji">ಅಜ್ಜಿ ಮಾತು</a> ಪುಟಗಳು ನೀವು ಧ್ವನಿಮುದ್ರಣ ಶುರುಮಾಡಿದಾಗ ಮಾತ್ರ ಮೈಕ್ರೊಫೋನ್ ಕೇಳುತ್ತವೆ. ಧ್ವನಿಮುದ್ರಣಗಳು ನಿಮ್ಮ ಬ್ರೌಸರ್ ಟ್ಯಾಬ್‌ನಲ್ಲೇ ಇದ್ದು, ನೀವು ಆರಿಸಿದಾಗ ಮಾತ್ರ ನಿಮ್ಮ ಸಾಧನಕ್ಕೆ ಉಳಿಯುತ್ತವೆ ಅಥವಾ ಫೋನಿನ ಹಂಚಿಕೆ ಮೆನು ಮೂಲಕ ಹಂಚಲ್ಪಡುತ್ತವೆ. ಈ ತಾಣಕ್ಕೆ ಏನೂ ಅಪ್‌ಲೋಡ್ ಆಗುವುದಿಲ್ಲ. ಅಜ್ಜಿ ಮಾತು ಶುರುವಾಗುವ ಮುನ್ನ, ಮಾತುಗಾರರು ಧ್ವನಿಮುದ್ರಣಕ್ಕೆ ಒಪ್ಪಿದ್ದಾರೆ ಎಂದು ದೃಢೀಕರಿಸಲು ಕೇಳುತ್ತದೆ.</p>

      <h2>ಕುಕೀಗಳು ಮತ್ತು ಸಂಗ್ರಹಣೆ</h2>
      <p>ಈ ತಾಣ ಯಾವುದೇ ಕುಕೀ ಇಡುವುದಿಲ್ಲ. ನೀವು ಸೇರಿಸುವ ಪದಗಳಿಗೆ ಮತ್ತು ನೀವು ಆರಿಸಿದ ಭಾಷೆಯನ್ನು ನೆನಪಿಡಲು ಮಾತ್ರ ಬ್ರೌಸರ್‌ನ ಲೋಕಲ್ ಸ್ಟೋರೇಜ್ ಬಳಸುತ್ತದೆ. ಟ್ರ್ಯಾಕಿಂಗ್ ಕುಕೀಗಳಿಲ್ಲದ್ದರಿಂದ ಕುಕೀ ಬ್ಯಾನರ್ ಇಲ್ಲ.</p>

      <h2>ಬೇರೆ ತಾಣಗಳ ಕೊಂಡಿಗಳು</h2>
      <p>ಪದಗಳ ಮೂಲಗಳು ಇನ್‌ಸ್ಟಾಗ್ರಾಮ್, ವಿಕಿಪೀಡಿಯ ಮತ್ತು ಸುದ್ದಿ ತಾಣಗಳಿಗೆ ಕೊಂಡಿ ಕೊಡುತ್ತವೆ. ಅವುಗಳಿಗೆ ತಮ್ಮದೇ ಗೌಪ್ಯತಾ ನೀತಿಗಳಿದ್ದು, ಕೊಂಡಿ ತೆರೆದ ಮೇಲೆ ಅವು ಅನ್ವಯಿಸುತ್ತವೆ.</p>

      <h2>ಮಕ್ಕಳು</h2>
      <p>ಈ ತಾಣ ಎಲ್ಲಾ ವಯಸ್ಸಿನವರಿಗೂ ಸೂಕ್ತ ಮತ್ತು ಯಾರಿಂದಲೂ ಉದ್ದೇಶಪೂರ್ವಕವಾಗಿ ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ. ಭಾಷೆಯ ದಾಖಲೆಯ ಭಾಗವಾಗಿ ಕೆಲವು ಪದಗಳು ಜಾತಿ ಪದಗಳು, ಬೈಗುಳಗಳು ಅಥವಾ ಹಿಂಸೆಯನ್ನು ದಾಖಲಿಸುತ್ತವೆ; ಅವುಗಳಿಗೆ ಗುರುತು ಹಾಕಲಾಗಿದೆ ಅಥವಾ ಒತ್ತಿದ ಮೇಲೆ ಮಾತ್ರ ಕಾಣುವಂತೆ ಮಾಡಲಾಗಿದೆ.</p>

      <h2>ನಿಮ್ಮ ಹಕ್ಕುಗಳು ಮತ್ತು ಸಂಪರ್ಕ</h2>
      <p>ನಮ್ಮ ಕನ್ನಡವನ್ನು ಕರ್ನಾಟಕದ ಮೈಸೂರಿನ ವಿದ್ಯಾರ್ಥಿ ಅಕ್ಷೋಭ್ಯ ಎ ಎಸ್ ನಡೆಸುತ್ತಿದ್ದಾರೆ.</p>
      <p>ನಮ್ಮ ಸರ್ವರ್‌ಗಳಲ್ಲಿ ಯಾವುದೇ ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ ಇಲ್ಲದ್ದರಿಂದ ಸಾಮಾನ್ಯವಾಗಿ ನೋಡಲು ಅಥವಾ ಅಳಿಸಲು ಏನೂ ಇರುವುದಿಲ್ಲ. ನೀವು ಕಳುಹಿಸಿದ ಪದವನ್ನು ತೆಗೆಯಬೇಕಿದ್ದರೆ ಅಥವಾ ನಿಮ್ಮ ಹೆಸರು ತೆಗೆಯಬೇಕಿದ್ದರೆ, ${contactLineKn()}.</p>

      <h2>ಬದಲಾವಣೆಗಳು</h2>
      <p>ಈ ನೀತಿ ಬದಲಾದರೆ, ಹೊಸ ಆವೃತ್ತಿಯನ್ನು ಹೊಸ ದಿನಾಂಕದೊಂದಿಗೆ ಇಲ್ಲಿ ಪ್ರಕಟಿಸಲಾಗುತ್ತದೆ.</p>
    </article>`;
}

function termsKn() {
  return `
    <article class="legal">
      <h1>ಬಳಕೆಯ ನಿಯಮಗಳು</h1>
      <p class="muted">ಕೊನೆಯ ಪರಿಷ್ಕರಣೆ: 25 ಅಕ್ಟೋಬರ್ 2026</p>
      ${LEGAL_NOTE_KN}
      <p>ನಮ್ಮ ಕನ್ನಡವನ್ನು ಅಕ್ಷೋಭ್ಯ ಎ ಎಸ್ ನಡೆಸುತ್ತಿದ್ದಾರೆ.</p>
      <p class="lede">ನಮ್ಮ ಕನ್ನಡವನ್ನು ಬಳಸುವ ಮೂಲಕ ನೀವು ಈ ನಿಯಮಗಳಿಗೆ ಒಪ್ಪುತ್ತೀರಿ. ಒಪ್ಪದಿದ್ದರೆ ದಯವಿಟ್ಟು ಈ ತಾಣವನ್ನು ಬಳಸಬೇಡಿ.</p>

      <h2>ಈ ತಾಣ ಏನು</h2>
      <p>ನಮ್ಮ ಕನ್ನಡ ಉಚಿತ, ವಾಣಿಜ್ಯೇತರ ಶೈಕ್ಷಣಿಕ ಯೋಜನೆ; ಕನ್ನಡ ಡಿಜಿಟಲ್ ಇನ್ನೋವೇಶನ್ ಹ್ಯಾಕಥಾನ್ 2026ಕ್ಕಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದ್ದು, ಕರ್ನಾಟಕದಾದ್ಯಂತ ಆಡುಮಾತಿನ ಕನ್ನಡ ಹೇಗೆ ಬದಲಾಗುತ್ತದೆ ಎಂಬುದನ್ನು ದಾಖಲಿಸುತ್ತದೆ.</p>

      <h2>ನಿಖರತೆ</h2>
      <p>ಪದಗಳು ಪ್ರಕಟಿತ ನಿಘಂಟುಗಳು, ಸಂಶೋಧನೆ, ಲೇಖನಗಳು, ಸಾಮಾಜಿಕ ಮಾಧ್ಯಮ ಪೋಸ್ಟ್‌ಗಳು ಮತ್ತು ಸ್ಥಳೀಯ ಭಾಷಿಕರಿಂದ ಬಂದಿವೆ. ಪ್ರತಿಯೊಂದಕ್ಕೂ ಮೂಲದ ಕೊಂಡಿ ಇದೆ. ಬಹುತೇಕ ಪದಗಳನ್ನು <strong>ಇನ್ನೂ ಭಾಷಿಕರು ಪರಿಶೀಲಿಸಿಲ್ಲ</strong>, ಅವುಗಳಿಗೆ ಹಾಗೆಯೇ ಗುರುತು ಹಾಕಲಾಗಿದೆ. ಕಾಗುಣಿತ, ಅರ್ಥ ಮತ್ತು ಉಚ್ಚಾರ ತಪ್ಪಿರಬಹುದು. ನಿಖರತೆ ಮುಖ್ಯವಾದ ಯಾವುದಕ್ಕೂ ದಯವಿಟ್ಟು ಈ ತಾಣವನ್ನು ಅವಲಂಬಿಸಬೇಡಿ.</p>
      <p>ಕಂಪ್ಯೂಟರ್ ಧ್ವನಿಗಳು (ಸರ್ವಮ್ ಎಐನ ಬುಲ್‌ಬುಲ್ ಮತ್ತು ಅಲರ್ ಧ್ವನಿ ಸಂಗ್ರಹ) ಪದಗಳನ್ನು ಶಿಷ್ಟ ಉಚ್ಚಾರದಲ್ಲಿ ಓದುತ್ತವೆ, ತಪ್ಪಾಗಿ ಉಚ್ಚರಿಸಬಹುದು. ಅವು ಸ್ಥಳೀಯರ ಧ್ವನಿಮುದ್ರಣಗಳಲ್ಲ.</p>

      <h2>ಸೂಕ್ಷ್ಮ ವಿಷಯ</h2>
      <p>ಭಾಷೆಯಲ್ಲಿ ಜಾತಿ, ಸಮುದಾಯ ಮತ್ತು ಹಿಂಸೆಯ ಬಗೆಗಿನ ಪದಗಳು ಹಾಗೂ ಬೈಗುಳಗಳೂ ಇವೆ. ಜನ ನಿಜವಾಗಿ ಹಾಗೆ ಮಾತನಾಡುವುದರಿಂದ ಕೆಲವನ್ನು ಸೇರಿಸಲಾಗಿದೆ. ಅವುಗಳನ್ನು ದಾಖಲಿಸಲಾಗಿದೆಯೇ ಹೊರತು ಸಮರ್ಥಿಸಲಾಗಿಲ್ಲ. ಅಂತಹ ಪದಗಳಿಗೆ ಗುರುತು ಹಾಕಲಾಗಿದೆ; ತೀವ್ರವಾದವು ನೀವು ಒತ್ತಿದ ಮೇಲೆ ಮಾತ್ರ ಕಾಣುತ್ತವೆ.</p>

      <h2>ನೀವು ಕೊಡುವ ಪದಗಳು</h2>
      <ul>
        <li>ನಿಮಗೆ ನೇರವಾಗಿ ತಿಳಿದಿರುವ ಅಥವಾ ಹಂಚಿಕೊಳ್ಳುವ ಹಕ್ಕಿರುವ ಪದಗಳು ಮತ್ತು ಕತೆಗಳನ್ನು ಮಾತ್ರ ಕಳುಹಿಸಿ.</li>
        <li>ಬೇರೆಯವರ ವೈಯಕ್ತಿಕ ವಿವರಗಳನ್ನು, ಅಥವಾ ದ್ವೇಷಪೂರಿತ, ನಿಂದನೀಯ ಅಥವಾ ಯಾವುದೇ ಗುಂಪಿಗೆ ಹಾನಿ ಮಾಡುವ ಉದ್ದೇಶದ ಯಾವುದನ್ನೂ ಸೇರಿಸಬೇಡಿ.</li>
        <li>ಯೋಜನೆಗೆ ಪದ ಕಳುಹಿಸುವ ಮೂಲಕ, ಅದನ್ನು ತಾಣದಲ್ಲಿ ಮತ್ತು ಮುಕ್ತ ದತ್ತಾಂಶದಲ್ಲಿ ನೀವು ಕೊಟ್ಟ ಹೆಸರಿನೊಂದಿಗೆ (ಅಥವಾ ಖಾಲಿ ಬಿಟ್ಟರೆ ಹೆಸರಿಲ್ಲದೆ) ಪ್ರಕಟಿಸಲು ಅನುಮತಿ ನೀಡುತ್ತೀರಿ.</li>
        <li>ಯಾವುದೇ ಕೊಡುಗೆಯನ್ನು ನಾವು ತಿದ್ದಬಹುದು, ಸರಿಪಡಿಸಬಹುದು ಅಥವಾ ತಿರಸ್ಕರಿಸಬಹುದು.</li>
      </ul>

      <h2>ವಿಷಯ ಮತ್ತು ಶ್ರೇಯ</h2>
      <ul>
        <li>ಉಪಭಾಷೆಯ ಚಿಕ್ಕ ಉದಾಹರಣೆಗಳನ್ನು ದಾಖಲೀಕರಣಕ್ಕಾಗಿ <a href="#/sources">ಮೂಲಗಳು</a> ಪುಟದಲ್ಲಿರುವ ಮೂಲಗಳಿಂದ ಉಲ್ಲೇಖಿಸಲಾಗಿದೆ. ಅವುಗಳ ಹಕ್ಕುಗಳು ಆ ಮೂಲಗಳಿಗೇ ಸೇರಿವೆ.</li>
        <li>ನಕ್ಷೆಯ ಗಡಿಗಳು ${A("https://github.com/udit-001/india-maps-data", "india-maps-data")}ಯಿಂದ. ಕೆಲವು ಧ್ವನಿ ತುಣುಕುಗಳು ${A("https://github.com/Aditya-ds-1806/Alar-voice-corpus", "ಅಲರ್ ಧ್ವನಿ ಸಂಗ್ರಹ")}ದಿಂದ (GPL-2.0).</li>
        <li>ಫಾಂಟ್‌ಗಳನ್ನು (Gluten, Fredoka, Baloo Tamma 2) SIL ಓಪನ್ ಫಾಂಟ್ ಲೈಸೆನ್ಸ್ ಅಡಿ ಬಳಸಲಾಗಿದೆ.</li>
        <li>ತಾಣದ ಸ್ವಂತ ಕೋಡ್ ${A("https://github.com/akshobyaas/nammakannada-ak/blob/main/LICENSE", "MIT ಲೈಸೆನ್ಸ್")} ಅಡಿ ಬಿಡುಗಡೆಯಾಗಿದೆ. <code>data/dialects.json</code> ದತ್ತಾಂಶವನ್ನು ${A("https://creativecommons.org/licenses/by-sa/4.0/", "CC BY-SA 4.0")} ಅಡಿ ಹಂಚಲಾಗಿದೆ: ಶ್ರೇಯ ನೀಡಿ, ಅದೇ ಲೈಸೆನ್ಸ್‌ನಲ್ಲಿ ಮರುಬಳಸಬಹುದು. ಉಲ್ಲೇಖಿತ ವಿಷಯ, ಅಲರ್ ತುಣುಕುಗಳು ಮತ್ತು ಫಾಂಟ್‌ಗಳಿಗೆ ಮೇಲೆ ಹೇಳಿದ ಅವುಗಳದೇ ಲೈಸೆನ್ಸ್‌ಗಳು ಅನ್ವಯಿಸುತ್ತವೆ.</li>
      </ul>

      <h2>ಯಾವುದೇ ಖಾತರಿ ಇಲ್ಲ</h2>
      <p>ಈ ತಾಣವನ್ನು “ಇದ್ದಂತೆಯೇ” ಯಾವುದೇ ಖಾತರಿ ಇಲ್ಲದೆ ಒದಗಿಸಲಾಗಿದೆ. ಕಾನೂನು ಅನುಮತಿಸುವ ಮಟ್ಟಿಗೆ, ತಾಣದ ಬಳಕೆ ಅಥವಾ ಅದರ ವಿಷಯವನ್ನು ಅವಲಂಬಿಸಿದ್ದರಿಂದ ಆಗುವ ಯಾವುದೇ ನಷ್ಟಕ್ಕೆ ಯೋಜನೆ ಮತ್ತು ಅದರ ನಿರ್ಮಾತೃ ಹೊಣೆಯಲ್ಲ.</p>

      <h2>ಬದಲಾವಣೆಗಳು ಮತ್ತು ಸಂಪರ್ಕ</h2>
      <p>ಈ ನಿಯಮಗಳು ಬದಲಾಗಬಹುದು; ಮೇಲಿನ ದಿನಾಂಕ ಇತ್ತೀಚಿನ ಆವೃತ್ತಿಯನ್ನು ತೋರಿಸುತ್ತದೆ. ಪ್ರಶ್ನೆಗಳಿದ್ದರೆ, ${contactLineKn()}.</p>
      <p>ಈ ನಿಯಮಗಳಿಗೆ ಭಾರತದ ಕಾನೂನುಗಳು ಅನ್ವಯಿಸುತ್ತವೆ.</p>
    </article>`;
}
