// Panel views. Each returns an HTML string or wires up its own DOM.
import {
  store, allEntries, entriesFor, entryById, zoneOf,
  sourceUrl, sourceLabel, readContributions, saveContribution, search,
} from "./store.js";
import { CONFIG } from "./config.js";
import * as map from "./map.js";
import { wireSound } from "./speech.js";
import { sayIt } from "./pronounce.js";

const ZONE_ORDER = ["south", "malnad", "coast", "north", "kalyana"];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- Word card ----------
function dialectHtml(e, cls = "dialect") {
  if (e.dialect?.kn) return `<p class="${cls}" lang="kn">${esc(e.dialect.kn)}</p>`;
  return `<p class="${cls} latin">${esc(e.dialect?.tr)}</p>`;
}

function checkHtml(e) {
  if (e.contributed) return `<span class="check mine">Added by you on this device</span>`;
  if (e.verified) return `<span class="check ok">Checked by a native speaker</span>`;
  return `<span class="check">Not yet checked by a speaker</span>`;
}

// "Say it: bat-teh", with a link to the guide that explains the letters.
function sayLine(kn) {
  const say = sayIt(kn);
  return say ? `<p class="say">Say it: <span>${esc(say)}</span> <a href="#/guide">How to read this</a></p>` : "";
}

export function wordCard(e, { showPlace = false } = {}) {
  const place = store.places.get(e.place);
  const zone = zoneOf(e.place);
  const src = sourceUrl(e.source);
  const std = e.standard
    ? `<p class="standard">Standard Kannada: ${e.standard.kn ? `<span lang="kn">${esc(e.standard.kn)}</span> ` : ""}${esc(e.standard.tr || "")} ${soundButton(e, "standard").replace('class="play"', 'class="play small"')}</p>`
    : "";
  return `
  <article class="word" style="--zone:${zone?.color || "#999"}">
    ${showPlace && place ? `<p class="where"><a href="#/place/${place.id}">${esc(place.name)}</a></p>` : ""}
    ${showPlace && !place && e.town ? `<p class="where">${esc(e.town)}</p>` : ""}
    ${dialectHtml(e)}
    ${e.dialect?.kn && e.dialect?.tr ? `<p class="tr">${esc(e.dialect.tr)}</p>` : ""}
    ${sayLine(e.dialect?.kn)}
    <p class="meaning">${esc(e.english)}</p>
    ${std}
    ${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}
    <footer>
      ${checkHtml(e)}
      ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener">Source: ${esc(sourceLabel(e.source))}</a>` : ""}
      ${e.confidence === "informal" ? `<span>Blog or forum source</span>` : ""}
      ${soundButton(e)}
    </footer>
  </article>`;
}

// Sound, best first: a speaker's recording, then an AI voice clip, then a dictionary clip,
// then the browser's own Kannada voice (hidden when the browser has none).
function soundButton(e, side = "dialect") {
  if (side === "dialect" && e.audio)
    return `<button class="play" type="button" data-audio="${esc(e.audio)}">Play recording</button>`;
  if (e.voice?.[side])
    return `<button class="play" type="button" data-clips="${esc(e.voice[side])}"
      title="AI voice (Sarvam Bulbul) reading the spelling">Listen</button>`;
  const clips = e.tts?.[side];
  if (clips?.length)
    return `<button class="play" type="button" data-clips="${esc(clips.join("|"))}"
      title="Computer voice from the Alar dictionary audio, reading the spelling">Listen</button>`;
  const kn = e[side]?.kn;
  if (!kn) return "";
  const text = kn.replace(/\s*[/;]\s*/g, ", ");
  return `<button class="play" type="button" data-say="${esc(text)}" hidden
    title="Your browser's Kannada voice, reading the spelling">Listen</button>`;
}

export const wireAudio = wireSound;

// ---------- Explore (home) ----------
export function renderExplore(root, { zone } = {}) {
  const zones = zone ? [zone] : ZONE_ORDER;
  const intro = store.data.compare_sets.find((s) => s.id === "cmp-will-come");
  const total = allEntries().length;
  const withWords = [...store.places.values()].filter((p) => entriesFor(p.id).length).length;

  let html = "";
  if (!zone) {
    html += `
      <h1>One language, many ways to say it</h1>
      <p class="lede">Kannada sounds different in Sirsi, Kundapura, Dharwad and Bengaluru.
      Pick a place on the map to hear how people there really talk.</p>
      <p class="muted">${plural(total, "word", "words")} from ${withWords} of ${store.places.size} places so far, each linked to its source.</p>
      ${intro ? compareBlock(intro) : ""}
      <h2>Places</h2>`;
  } else {
    const z = store.zones.get(zone);
    html += `
      <a class="back" href="#/">All regions</a>
      <h1>${esc(z.name)} <span class="muted" lang="kn">${esc(z.name_kn)}</span></h1>`;
  }

  html += `<div class="zones">`;
  for (const zid of zones) {
    const z = store.zones.get(zid);
    const places = [...store.places.values()].filter((p) => p.zone === zid);
    html += `<section class="zone" style="--zone:${z.color}">
      ${zone ? "" : `<h3><span class="zone-chip"></span>${esc(z.name)} <span class="kn" lang="kn">${esc(z.name_kn)}</span></h3>`}
      <ul class="chips">${places.map((p) => {
        const n = entriesFor(p.id).length;
        return `<li><a href="#/place/${p.id}" class="${n ? "" : "empty"}">${esc(p.name)} <span class="n">${n ? n : "add words"}</span></a></li>`;
      }).join("")}</ul>
    </section>`;
  }
  html += `</div>`;
  root.innerHTML = html;
  map.setActive(null);
  map.highlightZone(zone || null);
}

// ---------- Place ----------
export function renderPlace(root, id) {
  const p = store.places.get(id);
  if (!p) { renderNotFound(root); return; }
  const z = store.zones.get(p.zone);
  const words = entriesFor(id);
  const src = sourceUrl(p.source);

  root.innerHTML = `
    <a class="back" href="#/zone/${z.id}">${esc(z.name)}</a>
    <div class="place-head" style="--zone:${z.color}">
      <h1>${esc(p.name)}</h1>
      <span class="kn" lang="kn">${esc(p.name_kn)}</span>
    </div>
    <p class="lede">${esc(p.about)}</p>
    ${src ? `<p class="muted"><a href="${esc(src)}" target="_blank" rel="noopener">Read more on ${esc(sourceLabel(p.source))}</a></p>` : ""}
    ${words.length
      ? `<h2>${plural(words.length, "word", "words")} from ${esc(p.name)}</h2>
         <div class="words">${words.map((e) => wordCard(e)).join("")}</div>
         <div class="actions"><a class="btn ghost" href="#/add?place=${p.id}">Add a word from ${esc(p.name)}</a></div>`
      : `<div class="empty-state">
           <p>No words from ${esc(p.name)} yet. If you know how people talk here, add the first one.</p>
           <a class="btn" href="#/add?place=${p.id}">Add a word from ${esc(p.name)}</a>
         </div>`}
  `;
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
      <a class="who" href="#/place/${p.id}">${esc(p.name)}</a>
      <div class="say">${say}</div>
      ${sameMeaning ? "" : `<div class="what">${esc(e.english)}${e.standard?.tr ? `, standard ${esc(e.standard.tr)}` : ""}</div>`}
    </div>`;
  }).join("");
  const stdRow = sameMeaning && std
    ? `<div class="cmp-row std"><span class="who">Standard</span><div class="say">${std.kn ? `<span lang="kn">${esc(std.kn)}</span>` : ""}<span class="t">${esc(std.tr || "")}</span></div></div>`
    : "";
  return `<section class="cmp"><h3>${esc(set.english)}</h3>${stdRow}${rows}</section>`;
}

export function renderCompare(root) {
  root.innerHTML = `
    <h1>Compare</h1>
    <p class="lede">The same idea, said across Karnataka.</p>
    <div class="compare">${store.data.compare_sets.map(compareBlock).join("")}</div>`;
  map.setActive(null);
  map.highlightZone(null);
}

// ---------- Search ----------
export function renderSearch(root, q) {
  const results = search(q);
  root.innerHTML = results.length
    ? `<h1>${plural(results.length, "match", "matches")}</h1>
       <div class="words">${results.map((e) => wordCard(e, { showPlace: true })).join("")}</div>`
    : `<h1>No match for “${esc(q)}”</h1>
       <p class="lede">Try the English meaning, like <em>come</em> or <em>house</em>, or a place name like Sirsi.</p>`;
  wireAudio(root);
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
    !e.contributed && e.dialect && (e.dialect.kn || e.dialect.tr) && e.type !== "grammar"
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

  if (quiz.i >= quiz.questions.length) {
    const n = quiz.questions.length;
    root.innerHTML = `
      <h1>You got ${quiz.score} of ${n}</h1>
      <p class="lede">${quiz.score === n ? "Every one. You know your Karnataka." : quiz.score >= n / 2 ? "Good ear. Explore the map to learn the rest." : "Kannada really does change a lot. The map shows where each word comes from."}</p>
      <div class="actions"><button class="btn" type="button" id="again">Play again</button><a class="btn ghost" href="#/">Explore the map</a></div>`;
    root.querySelector("#again").addEventListener("click", () => renderQuiz(root, { restart: true }));
    return;
  }

  const q = quiz.questions[quiz.i];
  const e = q.entry;
  root.innerHTML = `
    <h1>Guess the region</h1>
    <p class="lede">Where in Karnataka would you hear this?</p>
    <div class="quiz-card">
      <p class="progress">Word ${quiz.i + 1} of ${quiz.questions.length}. Score ${quiz.score}</p>
      ${dialectHtml(e)}
      ${e.dialect?.kn && e.dialect?.tr ? `<p class="tr">${esc(e.dialect.tr)}</p>` : ""}
      ${sayLine(e.dialect?.kn)}
      <p class="meaning">means “${esc(e.english)}”</p>
      <p>${soundButton(e)}</p>
      <div class="options">${q.options.map((p) => `<button type="button" data-place="${p.id}">${esc(p.name)}</button>`).join("")}</div>
      <div id="result"></div>
    </div>`;

  wireSound(root);
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
        <p class="result ${right ? "right" : "wrong"}"><strong>${right ? "Right." : "Not quite."}</strong>
        This is from ${esc(place.name)}.${e.standard?.tr ? ` In standard Kannada it is ${esc(e.standard.tr)}.` : ""}</p>
        ${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}
        <div class="actions"><button class="btn" type="button" id="next">${quiz.i + 1 < quiz.questions.length ? "Next word" : "See your score"}</button></div>`;
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

// ---------- Add a word ----------
export function renderAdd(root, { place: preset } = {}) {
  const places = [...store.places.values()].sort((a, b) => a.name.localeCompare(b.name));
  const mine = readContributions();
  root.innerHTML = `
    <h1>Add a word</h1>
    <p class="lede">Know how people talk in your town? Add a word or phrase the way you would say it at home.</p>
    <form class="form" id="add" novalidate>
      <div class="field">
        <label for="f-place">Where is it said?</label>
        <select id="f-place" name="place" required>
          <option value="">Choose a place</option>
          ${places.map((p) => `<option value="${p.id}" ${p.id === preset ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
          <option value="other">My town is not on the map</option>
        </select>
        <p class="err" hidden>Choose where this word is used.</p>
      </div>
      <div class="field" id="town-field" hidden>
        <label for="f-town">Your town or village</label>
        <input id="f-town" name="town" autocomplete="address-level2">
        <p class="err" hidden>Write the name of your town.</p>
      </div>
      <div class="two">
        <div class="field">
          <label for="f-kn">The word, in Kannada</label>
          <input id="f-kn" name="kn" lang="kn" required placeholder="ಬತ್ತೆ">
          <p class="err" hidden>Write the word in Kannada script.</p>
        </div>
        <div class="field">
          <label for="f-tr">How to read it in English letters</label>
          <input id="f-tr" name="tr" required placeholder="batte">
          <p class="err" hidden>Write how it sounds, like batte.</p>
        </div>
      </div>
      <div class="field">
        <label for="f-en">What it means in English</label>
        <input id="f-en" name="english" required placeholder="I will come">
        <p class="err" hidden>Write what the word means.</p>
      </div>
      <div class="field">
        <label for="f-std">Standard Kannada for the same thing <span class="muted">(optional)</span></label>
        <input id="f-std" name="std" lang="kn" placeholder="ಬರುತ್ತೇನೆ">
      </div>
      <div class="field">
        <label for="f-note">An example or story behind it <span class="muted">(optional)</span></label>
        <textarea id="f-note" name="note" placeholder="My grandmother says this when..."></textarea>
      </div>
      <div class="field">
        <label for="f-name">Your name <span class="muted">(optional)</span></label>
        <input id="f-name" name="name" autocomplete="name">
        <p class="hint">Shown as the contributor if the word is added to the site.</p>
      </div>
      <div class="actions"><button class="btn" type="submit">Add this word</button></div>
    </form>
    <div id="done"></div>
    ${mine.length ? `<h2>Words you added on this device</h2><div class="words">${mine.map((e) => wordCard(e, { showPlace: true })).join("")}</div>` : ""}
  `;

  const form = root.querySelector("#add");
  const placeSel = form.place;
  const townField = root.querySelector("#town-field");
  const syncTown = () => { townField.hidden = placeSel.value !== "other"; };
  placeSel.addEventListener("change", syncTown);
  syncTown();

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const req = [form.place, form.kn, form.tr, form.english];
    if (form.place.value === "other") req.push(form.town);
    let firstBad = null;
    for (const input of [form.place, form.town, form.kn, form.tr, form.english]) {
      const bad = req.includes(input) && !input.value.trim();
      input.setAttribute("aria-invalid", bad ? "true" : "false");
      input.closest(".field").querySelector(".err").hidden = !bad;
      if (bad && !firstBad) firstBad = input;
    }
    if (firstBad) { firstBad.focus(); return; }

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
    const saved = saveContribution(entry);
    map.refreshPinCounts();
    const where = isOther ? entry.town : store.places.get(entry.place).name;
    const json = JSON.stringify(entry, null, 2);
    const done = root.querySelector("#done");
    done.innerHTML = `
      <div class="done" tabindex="-1">
        <p><strong>${saved ? "Added." : "Could not save on this device."}</strong>
        ${saved ? (isOther ? `Your word from ${esc(where)} is saved below.` : `It now shows on ${esc(where)}, marked as added by you.`) : "Your browser blocked storage. Copy the word instead."}</p>
        <div class="actions">
          ${isOther ? "" : `<a class="btn" href="#/place/${entry.place}">See ${esc(where)}</a>`}
          <button class="btn ghost" type="button" id="copy">Copy as JSON</button>
          ${CONFIG.GOOGLE_FORM_URL ? `<a class="btn ghost" href="${esc(CONFIG.GOOGLE_FORM_URL)}" target="_blank" rel="noopener">Send it to the project</a>` : ""}
        </div>
      </div>`;
    done.querySelector(".done").focus();
    done.querySelector("#copy").addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(json); e.target.textContent = "Copied"; }
      catch { e.target.textContent = "Copy failed"; }
    });
    form.reset();
    if (preset) form.place.value = preset;
    syncTown();
  });

  map.setActive(preset || null);
  map.highlightZone(preset ? store.places.get(preset)?.zone : null);
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
  ["Havyaka (Sirsi)", "o and e at the start of a word become wa and ye: ole is said wale.", ["sir-14"]],
  ["Kundapura", "Long verb endings are cut short: hoguttene becomes hote.", ["kun-01"]],
  ["Halakki (Ankola)", "An r before D turns into y, so eraDu becomes eyDu. Middle vowels drop: bāgilu becomes bāgla.", ["hlk-11", "hlk-04"]],
  ["Malenadu", "Some s and L sounds shift: sappe becomes chappe, kēLu becomes kēNu.", ["mal-04", "mal-05"]],
  ["Kalaburagi", "Final e and u turn to i or a, and e after a consonant becomes ya: tale is said tyali.", ["klb-04", "klb-01"]],
  ["Arebhashe", "The final u falls off: nānu becomes nā, nāvu becomes nāv.", ["are-01"]],
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
    <span class="muted">${esc(e.english)}${side === "standard" ? ", standard" : `, <a href="#/place/${p.id}">${esc(p.name)}</a>`}</span>
    ${soundButton(e, side).replace('class="play"', 'class="play small"')}
  </span>`;
}

export function renderGuide(root) {
  root.innerHTML = `
    <h1>How to say it</h1>
    <p class="lede">Every word has a “Say it” line that spells it the way it sounds, split into syllables. Say each syllable evenly: Kannada doesn't punch one syllable the way English does.</p>
    <p class="muted">Kannada is written the way it is spoken, so these spellings come straight from the Kannada letters.</p>

    <h2>Vowels</h2>
    <table class="guide">
      <thead><tr><th scope="col">Written</th><th scope="col">Sounds like</th><th scope="col">Example</th></tr></thead>
      <tbody>${VOWEL_GUIDE.map(([w, like, id, side]) => `
        <tr><td class="w">${esc(w)}</td><td>${esc(like)}</td><td>${guideExample(`${id}:${side}`)}</td></tr>`).join("")}
      </tbody>
    </table>
    <p class="muted">A final e is written eh so you don't drop it: ಬತ್ತೆ is bat-teh, two full syllables.</p>

    <h2>Sounds English doesn't have</h2>
    <div class="guide-list">${CONSONANT_GUIDE.map(([w, how, refs]) => `
      <section>
        <h3 class="w">${esc(w)}</h3>
        <p>${esc(how)}</p>
        <div class="exs">${refs.map(guideExample).join("")}</div>
      </section>`).join("")}
    </div>

    <h2>How regions change the sound</h2>
    <p>The same letters can be bent differently from place to place. These patterns are what make a speaker sound like they're from somewhere.</p>
    <div class="guide-list">${SOUND_CHANGES.map(([where, how, ids]) => `
      <section>
        <h3>${esc(where)}</h3>
        <p>${esc(how)}</p>
        <div class="exs">${ids.map((id) => guideExample(id)).join("")}</div>
      </section>`).join("")}
    </div>
  `;
  wireSound(root);
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
  alar_voice: "Alar voice corpus: dictionary audio clips (GPL-2.0, generated with Google TTS)",
};

export function renderSources(root) {
  const counts = {};
  for (const e of store.entries) counts[e.source] = (counts[e.source] || 0) + 1;
  root.innerHTML = `
    <h1>Sources</h1>
    <p class="lede">Every word links back to where it came from. Words marked “Not yet checked by a speaker” are waiting for a native speaker to confirm them.</p>
    <ol class="sources">
      ${Object.entries(store.data.sources).map(([k, url]) => `
        <li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(SOURCE_NOTES[k] || k)}</a>
        <span class="muted">${counts[k] ? `, ${plural(counts[k], "word", "words")}` : ""}</span></li>`).join("")}
    </ol>
    <h2>Sound</h2>
    <p>“Play recording” plays a clip recorded by a Kannada speaker. “Listen” is a computer voice reading the spelling in a standard accent, so it gives the shape of a word but not its local tune. Clips made with <a href="https://www.sarvam.ai/text-to-speech" target="_blank" rel="noopener">Sarvam AI’s Bulbul</a> voice are used first; where there is none and the <a href="https://github.com/Aditya-ds-1806/Alar-voice-corpus" target="_blank" rel="noopener">Alar voice corpus</a> has the word, its clip is used. Both play in any browser. Otherwise the browser’s own Kannada voice is used: Microsoft Edge on Windows and Chrome on Android have one, other browsers may not, and the button is hidden there.</p>
    <p><a href="#/record">Record words</a> to add real voices.</p>
    <h2>Map</h2>
    <p>District boundaries from <a href="https://github.com/udit-001/india-maps-data" target="_blank" rel="noopener">india-maps-data</a> (2011 census districts). Regions are approximate cultural zones, not official divisions.</p>`;
  map.setActive(null);
  map.highlightZone(null);
}

export function renderNotFound(root) {
  root.innerHTML = `<h1>Page not found</h1><p class="lede">That place or page does not exist.</p><a class="btn" href="#/">Go to the map</a>`;
}
