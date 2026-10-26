// Ajji Mode (#/ajji): hand the phone to an elder and record how they really say everyday words.
// The prompt is a picture plus one generic question, never the word itself: written prompts pull
// people towards standard Kannada, pictures don't. This is how field linguists elicit dialect.
import { store, allEntries } from "./store.js";
import { esc } from "./views.js";
import * as map from "./map.js";
import { t, isKn, placeName } from "./i18n.js";
import { toast, emptyHtml, setBusy } from "./ui.js";
import { makeZip } from "./zip.js";

// Each prompt: a picture, the question to ask, and the meaning used in the dataset (for "how others say it").
const ASK_NAME = "ಇದಕ್ಕೆ ನಿಮ್ಮೂರಲ್ಲಿ ಏನಂತಾರೆ?";
const ASK_COUNT = "ಇಲ್ಲಿ ಎಷ್ಟಿವೆ?";
const PROMPTS = [
  { id: "rain", pic: "🌧️", ask: ASK_NAME, en: "rain", kn: "ಮಳೆ" },
  { id: "house", pic: "🏠", ask: ASK_NAME, en: "house", kn: "ಮನೆ" },
  { id: "door", pic: "🚪", ask: ASK_NAME, en: "door", kn: "ಬಾಗಿಲು" },
  { id: "one", pic: "🍎", ask: ASK_COUNT, en: "one", kn: "ಒಂದು" },
  { id: "snake", pic: "🐍", ask: ASK_NAME, en: "snake", kn: "ಹಾವು" },
  { id: "leaf", pic: "🍃", ask: ASK_NAME, en: "leaf", kn: "ಎಲೆ" },
  { id: "two", pic: "🍎🍎", ask: ASK_COUNT, en: "two", kn: "ಎರಡು" },
  { id: "monkey", pic: "🐒", ask: ASK_NAME, en: "monkey", kn: "ಕೋತಿ" },
  { id: "onion", pic: "🧅", ask: ASK_NAME, en: "onion", kn: "ಈರುಳ್ಳಿ" },
  { id: "owl", pic: "🦉", ask: ASK_NAME, en: "owl", kn: "ಗೂಬೆ" },
  { id: "cloud", pic: "☁️", ask: ASK_NAME, en: "cloud", kn: "ಮೋಡ" },
  { id: "tongue", pic: "👅", ask: ASK_NAME, en: "tongue", kn: "ನಾಲಿಗೆ" },
  { id: "rat", pic: "🐀", ask: ASK_NAME, en: "rat", kn: "ಇಲಿ" },
  { id: "rope", pic: "🪢", ask: ASK_NAME, en: "rope", kn: "ಹಗ್ಗ" },
  { id: "coconut", pic: "🥥", ask: ASK_NAME, en: "tender coconut", kn: "ಎಳನೀರು" },
  { id: "buffalo", pic: "🐃", ask: ASK_NAME, en: "male buffalo", kn: "ಕೋಣ" },
  { id: "finger", pic: "☝️", ask: ASK_NAME, en: "finger", kn: "ಬೆರಳು" },
  { id: "ball", pic: "⚽", ask: ASK_NAME, en: "ball", kn: "ಚೆಂಡು" },
];
const MAX_SECONDS = 8;

// ---------- Recording helpers ----------
function pickType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  const m = types.find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported(x));
  return m ? { mime: m, ext: m.includes("mp4") ? "m4a" : m.includes("ogg") ? "ogg" : "webm" } : null;
}

let stream = null;
async function getMic() {
  if (!stream || stream.getTracks().every((tr) => tr.readyState === "ended")) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  }
  return stream;
}
function releaseMic() {
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
}

// Speak the question aloud with the browser's Kannada voice, if it has one.
function knVoice() {
  return window.speechSynthesis?.getVoices().find((v) => /^kn/i.test(v.lang)) || null;
}
function sayQuestion(text) {
  const v = knVoice();
  if (!v) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v; u.lang = v.lang; u.rate = 0.85;
  speechSynthesis.speak(u);
  return true;
}

// ---------- Session state (kept in memory only) ----------
let session = null; // { town, placeId, age, clips: { [promptId]: { blob, url, note } }, type, startedAt }

const slug = (s) => String(s || "town").normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "town";

// ---------- Intro / consent ----------
export function renderAjji(root) {
  map.setActive(null);
  map.highlightZone(null);
  const type = pickType();
  if (!type || !navigator.mediaDevices?.getUserMedia) {
    root.innerHTML = `<h1>${t("Ajji's words")}</h1>` + emptyHtml({
      title: t("This browser cannot record audio"),
      body: t("Open the site in Chrome or Edge on a computer or phone with a microphone."),
      actions: `<a class="btn" href="#/">${t("Back to the map")}</a>`,
    });
    return;
  }
  if (session && Object.keys(session.clips).length && !session.open) { renderReview(root); return; }

  const places = [...store.places.values()].sort((a, b) => placeName(a).localeCompare(placeName(b), isKn() ? "kn" : "en"));
  root.innerHTML = `
    <div class="ajji-hero">
      <p class="ajji-kicker" lang="kn">${isKn() ? "ಹೊಸತು!" : "ಅಜ್ಜಿ ಮಾತು"}</p>
      <h1>${t("Ajji's words")}</h1>
      <p class="lede">${t("Every family has an elder whose Kannada is not in any dictionary. Hand them your phone for two minutes and save it.")}</p>
    </div>

    <div class="ajji-why">
      <h2>${t("Why pictures, not words")}</h2>
      <p>${t("If you ask “what is the word for rain?” in writing, people answer in textbook Kannada. So Ajji Mode never shows the word. It shows a picture and asks one simple question, the way language researchers record dialects in the field. What comes back is how they really talk at home.")}</p>
      <ol class="steps">
        <li>${t("Choose their town and ask if they are happy to be recorded.")}</li>
        <li>${t("Hand over the phone. They see a big picture and tap the red button to answer.")}</li>
        <li>${t("Afterwards, play the answers back, write down what they said, and send them to the project.")}</li>
      </ol>
    </div>

    <form class="form" id="ajji-form" novalidate>
      <div class="form-alert" id="ajji-alert" role="alert" tabindex="-1" hidden></div>
      <div class="field">
        <label for="a-place">${t("Which town is their Kannada from?")}</label>
        <select id="a-place" name="place" required aria-describedby="err-a-place">
          <option value="">${t("Choose a place")}</option>
          ${places.map((p) => `<option value="${p.id}">${esc(placeName(p))}</option>`).join("")}
          <option value="other">${t("My town is not on the map")}</option>
        </select>
        <p class="err" id="err-a-place" hidden></p>
      </div>
      <div class="field" id="a-town-field" hidden>
        <label for="a-town">${t("Town or village")}</label>
        <input id="a-town" name="town" maxlength="60" aria-describedby="err-a-town">
        <p class="err" id="err-a-town" hidden></p>
      </div>
      <div class="field">
        <span class="label" id="a-age-l">${t("Their age")} <span class="muted">${t("(optional)")}</span></span>
        <div class="seg" role="radiogroup" aria-labelledby="a-age-l">
          ${["Under 40", "40–60", "60–75", "Over 75"].map((a) => `
            <label class="seg-opt"><input type="radio" name="age" value="${a}"><span>${t(a)}</span></label>`).join("")}
        </div>
      </div>
      <label class="check-row">
        <input type="checkbox" name="consent" id="a-consent" aria-describedby="err-a-consent">
        <span>${t("They know they are being recorded and are happy to share their voice with Namma Kannada.")}</span>
      </label>
      <p class="err" id="err-a-consent" hidden></p>
      <div class="actions"><button class="btn big-btn" type="submit" id="a-start">${t("Start Ajji Mode")}</button></div>
      <p class="muted">${t("Recordings stay on this phone. Nothing is uploaded unless you choose to share it at the end.")}</p>
    </form>`;

  const form = root.querySelector("#ajji-form");
  const townField = root.querySelector("#a-town-field");
  const showErr = (id, msg) => {
    const el = root.querySelector(`#err-${id}`);
    el.textContent = msg; el.hidden = !msg;
    const input = root.querySelector(`#${id}`);
    input?.setAttribute("aria-invalid", msg ? "true" : "false");
  };
  form.place.addEventListener("change", () => {
    townField.hidden = form.place.value !== "other";
    if (form.place.value) showErr("a-place", "");
  });
  form.town.addEventListener("input", () => form.town.value.trim() && showErr("a-town", ""));
  form.consent.addEventListener("change", () => form.consent.checked && showErr("a-consent", ""));

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const bad = [];
    if (!form.place.value) { showErr("a-place", t("Choose where their Kannada is from.")); bad.push(form.place); }
    if (form.place.value === "other" && !form.town.value.trim()) { showErr("a-town", t("Write the name of the town or village.")); bad.push(form.town); }
    if (!form.consent.checked) { showErr("a-consent", t("Ask them first, then tick this box.")); bad.push(form.consent); }
    if (bad.length) { bad[0].focus(); return; }

    const btn = root.querySelector("#a-start");
    setBusy(btn, true, t("Asking for the microphone…"));
    try {
      await getMic();
    } catch (err) {
      setBusy(btn, false);
      const box = root.querySelector("#ajji-alert");
      box.className = "form-alert error";
      box.innerHTML = `<strong>${t(err?.name === "NotFoundError" ? "No microphone found. Plug one in and try again." : "Microphone blocked. Allow microphone access in the address bar and try again.")}</strong>`;
      box.hidden = false; box.focus();
      return;
    }
    setBusy(btn, false);
    const place = form.place.value === "other" ? null : store.places.get(form.place.value);
    session = {
      placeId: place?.id || null,
      town: place ? place.name : form.town.value.trim(),
      age: form.age.value || "",
      clips: {},
      type,
      startedAt: new Date().toISOString(),
      open: true,
    };
    openRecorder(root, 0);
  });
}

// ---------- Full-screen recording flow for the elder ----------
function openRecorder(root, start = 0) {
  document.querySelector(".ajji-stage")?.remove();
  const stage = document.createElement("div");
  stage.className = "ajji-stage";
  stage.setAttribute("role", "dialog");
  stage.setAttribute("aria-modal", "true");
  stage.setAttribute("aria-label", t("Ajji Mode recording"));
  document.body.append(stage);
  document.body.classList.add("ajji-open");

  let i = start;
  let recorder = null, timer = null, tick = null;

  const close = (toReview) => {
    if (recorder?.state === "recording") recorder.stop();
    clearTimeout(timer); clearInterval(tick);
    window.speechSynthesis?.cancel();
    releaseMic();
    stage.remove();
    document.body.classList.remove("ajji-open");
    document.removeEventListener("keydown", onKey);
    session.open = false;
    if (toReview) renderReview(root);
  };

  function draw() {
    const p = PROMPTS[i];
    const clip = session.clips[p.id];
    const canSpeak = !!knVoice();
    stage.innerHTML = `
      <div class="ajji-top">
        <div class="ajji-dots" aria-label="${esc(t("Picture {i} of {n}", { i: i + 1, n: PROMPTS.length }))}">
          ${PROMPTS.map((q, k) => `<span class="${k === i ? "now" : session.clips[q.id] ? "done" : ""}"></span>`).join("")}
        </div>
        <button type="button" class="ajji-x" id="ajji-done">${t("Finish")}</button>
      </div>
      <div class="ajji-card" aria-hidden="true"><span class="ajji-pic">${p.pic}</span></div>
      <p class="ajji-ask" lang="kn">${p.ask}</p>
      ${isKn() ? "" : `<p class="ajji-ask-en">${t(p.ask === ASK_COUNT ? "How many are there?" : "What do you call this where you live?")}</p>`}
      ${canSpeak ? `<button type="button" class="ajji-hear" id="ajji-hear">🔊 ${t("Read the question aloud")}</button>` : ""}
      <div class="ajji-controls">
        <button type="button" class="ajji-rec ${clip ? "has" : ""}" id="ajji-rec" aria-label="${esc(t(clip ? "Record again" : "Tap and speak"))}">
          <span class="dot" aria-hidden="true"></span>
          <span class="lbl">${t(clip ? "Record again" : "Tap and speak")}</span>
        </button>
        <p class="ajji-status" id="ajji-status" aria-live="polite">${clip ? t("Saved. Listen, or go to the next picture.") : ""}</p>
        <div class="ajji-row">
          ${i > 0 ? `<button type="button" class="btn ghost" id="ajji-prev" aria-label="${esc(t("Previous picture"))}">◀</button>` : ""}
          ${clip ? `<button type="button" class="btn ghost" id="ajji-play">▶ ${t("Listen")}</button>`
                 : `<button type="button" class="btn ghost" id="ajji-skip">${t("Don't know, skip")}</button>`}
          ${clip ? `<button type="button" class="btn" id="ajji-next">${t(i === PROMPTS.length - 1 ? "Finish" : "Next picture")} ➜</button>` : ""}
        </div>
      </div>`;

    const status = stage.querySelector("#ajji-status");
    const recBtn = stage.querySelector("#ajji-rec");
    stage.querySelector("#ajji-done").addEventListener("click", () => close(true));
    stage.querySelector("#ajji-hear")?.addEventListener("click", () => sayQuestion(p.ask));
    stage.querySelector("#ajji-play")?.addEventListener("click", () => {
      new Audio(clip.url).play().catch(() => toast(t("Could not play the recording. Record it again."), "error"));
    });
    stage.querySelector("#ajji-skip")?.addEventListener("click", next);
    stage.querySelector("#ajji-prev")?.addEventListener("click", () => { i--; draw(); });
    stage.querySelector("#ajji-next")?.addEventListener("click", next);

    recBtn.addEventListener("click", async () => {
      if (recorder?.state === "recording") { recorder.stop(); return; }
      window.speechSynthesis?.cancel();
      let s;
      try { s = await getMic(); } catch {
        status.textContent = t("Microphone blocked. Allow microphone access in the address bar and try again.");
        status.dataset.kind = "error";
        return;
      }
      const chunks = [];
      recorder = new MediaRecorder(s, { mimeType: session.type.mime });
      recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      recorder.onstop = () => {
        clearTimeout(timer); clearInterval(tick);
        const blob = new Blob(chunks, { type: session.type.mime });
        if (blob.size < 1500) {
          recBtn.classList.remove("live");
          status.textContent = t("We didn't hear anything. Tap the red button and speak a little louder.");
          status.dataset.kind = "error";
          return;
        }
        const old = session.clips[p.id];
        if (old) URL.revokeObjectURL(old.url);
        session.clips[p.id] = { blob, url: URL.createObjectURL(blob), note: old?.note || "" };
        draw();
        stage.querySelector("#ajji-next")?.focus();
      };
      recorder.start();
      recBtn.classList.add("live");
      recBtn.querySelector(".lbl").textContent = t("Listening… tap to stop");
      let left = MAX_SECONDS;
      status.dataset.kind = "live";
      status.textContent = t("{s} seconds", { s: left });
      tick = setInterval(() => { left--; if (left > 0) status.textContent = t("{s} seconds", { s: left }); }, 1000);
      timer = setTimeout(() => recorder?.state === "recording" && recorder.stop(), MAX_SECONDS * 1000);
    });

    recBtn.focus();
  }

  function next() {
    if (i < PROMPTS.length - 1) { i++; draw(); } else close(true);
  }

  function onKey(e) {
    if (e.key === "Escape") close(true);
  }
  document.addEventListener("keydown", onKey);
  draw();
}

// ---------- Review: listen, write down, compare, share ----------
function othersFor(p) {
  return allEntries()
    .filter((e) => !e.contributed && e.english === p.en && e.dialect?.kn)
    .slice(0, 4)
    .map((e) => `<span class="ajji-other"><span lang="kn">${esc(e.dialect.kn)}</span> <span class="muted">${esc(placeName(store.places.get(e.place)))}</span></span>`)
    .join("");
}

function renderReview(root) {
  const done = PROMPTS.filter((p) => session.clips[p.id]);
  const place = session.placeId ? store.places.get(session.placeId) : null;
  const where = place ? placeName(place) : session.town;
  if (!done.length) {
    root.innerHTML = `<h1>${t("Ajji's words")}</h1>` + emptyHtml({
      title: t("Nothing was recorded"),
      body: t("No answers were saved this time. You can start again whenever you are ready."),
      actions: `<button class="btn" type="button" id="ajji-again">${t("Start again")}</button>`,
    });
    root.querySelector("#ajji-again").addEventListener("click", () => { session = null; renderAjji(root); });
    return;
  }

  root.innerHTML = `
    <div class="thanks">
      <p class="thanks-kn" lang="kn" aria-hidden="true">ಧನ್ಯವಾದ!</p>
      <h1>${t("{n} words saved from {place}", { n: done.length, place: esc(where) })}</h1>
      <p class="lede">${t("Play each one back and write down what they said. Then send the recordings to the project, so their Kannada can be checked and added to the map.")}</p>
    </div>
    <p class="form-alert">${t("These recordings are only in this browser tab. Share or download them before you close the page.")}</p>
    <div class="ajji-list">
      ${done.map((p) => `
        <section class="ajji-item" data-id="${p.id}">
          <span class="ajji-mini" aria-hidden="true">${p.pic}</span>
          <div class="ajji-body">
            <p class="ajji-label"><strong>${esc(isKn() ? p.kn : p.en)}</strong> <span class="muted">${esc(isKn() ? p.en : p.kn)}</span></p>
            <div class="ajji-actions">
              <button type="button" class="play small" data-play="${p.id}">▶ <span>${t("Listen")}</span></button>
              <label class="visually-hidden" for="note-${p.id}">${t("What did they say?")}</label>
              <input id="note-${p.id}" class="ajji-note" lang="kn" maxlength="80" placeholder="${esc(t("What did they say? (in Kannada)"))}" value="${esc(session.clips[p.id].note)}">
            </div>
            ${othersFor(p) ? `<p class="ajji-others"><span class="muted">${t("Elsewhere:")}</span> ${othersFor(p)}</p>` : ""}
          </div>
        </section>`).join("")}
    </div>
    <div class="actions">
      ${navigator.canShare ? `<button class="btn" type="button" id="ajji-share">${t("Share with the project")}</button>` : ""}
      <button class="btn ${navigator.canShare ? "ghost" : ""}" type="button" id="ajji-zip">${t("Download all (.zip)")}</button>
      <button class="btn ghost" type="button" id="ajji-more">${t("Record more")}</button>
      <button class="btn ghost" type="button" id="ajji-new">${t("New speaker")}</button>
    </div>
    <p class="muted">${t("Send the file to the project on WhatsApp or by email. Each recording is named by picture, with a list of what was said.")}</p>`;

  root.querySelectorAll("[data-play]").forEach((b) => b.addEventListener("click", () => {
    new Audio(session.clips[b.dataset.play].url).play().catch(() => toast(t("Could not play the recording. Record it again."), "error"));
  }));
  root.querySelectorAll(".ajji-note").forEach((inp) => inp.addEventListener("input", () => {
    session.clips[inp.id.slice(5)].note = inp.value;
  }));

  const files = () => {
    const base = `${slug(session.town)}-${session.startedAt.slice(0, 10)}`;
    const list = done.map((p) => ({ p, name: `${base}/${String(PROMPTS.indexOf(p) + 1).padStart(2, "0")}-${p.id}.${session.type.ext}` }));
    const manifest = {
      project: "Namma Kannada · Ajji's words",
      town: session.town,
      place_id: session.placeId,
      speaker_age: session.age || null,
      recorded_at: session.startedAt,
      consent: true,
      method: "picture prompt, no written word shown",
      answers: list.map(({ p, name }) => ({
        file: name.split("/")[1], meaning: p.en, standard_kannada: p.kn, question: p.ask,
        what_they_said: session.clips[p.id].note || null,
      })),
    };
    return { base, list, manifest };
  };

  root.querySelector("#ajji-zip").addEventListener("click", async (ev) => {
    const b = ev.currentTarget;
    setBusy(b, true, t("Preparing…"));
    const { base, list, manifest } = files();
    const zip = await makeZip([
      ...list.map(({ p, name }) => ({ name, data: session.clips[p.id].blob })),
      { name: `${base}/answers.json`, data: JSON.stringify(manifest, null, 2) },
    ]);
    setBusy(b, false);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zip);
    a.download = `namma-kannada-${base}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(t("Saved {file} to your downloads.", { file: a.download }));
  });

  root.querySelector("#ajji-share")?.addEventListener("click", async () => {
    const { list, manifest } = files();
    const shareFiles = [
      ...list.map(({ p, name }) => new File([session.clips[p.id].blob], name.split("/")[1], { type: session.type.mime })),
      new File([JSON.stringify(manifest, null, 2)], "answers.json", { type: "application/json" }),
    ];
    const data = { files: shareFiles, title: "Namma Kannada · Ajji's words", text: `${manifest.town}: ${list.length} recordings` };
    if (!navigator.canShare(data)) { toast(t("This browser can't share files. Use Download instead."), "error"); return; }
    try { await navigator.share(data); toast(t("Shared. Thank you!")); }
    catch (err) { if (err?.name !== "AbortError") toast(t("Sharing didn't work. Use Download instead."), "error"); }
  });

  root.querySelector("#ajji-more").addEventListener("click", async () => {
    try { await getMic(); } catch { toast(t("Microphone blocked. Allow microphone access in the address bar and try again."), "error"); return; }
    const firstMissing = PROMPTS.findIndex((p) => !session.clips[p.id]);
    session.open = true;
    openRecorder(root, firstMissing < 0 ? 0 : firstMissing);
  });
  root.querySelector("#ajji-new").addEventListener("click", () => {
    if (!confirmLeave()) return;
    Object.values(session.clips).forEach((c) => URL.revokeObjectURL(c.url));
    session = null;
    renderAjji(root);
    window.scrollTo({ top: 0 });
  });
  if (place) { map.setActive(place.id); map.highlightZone(place.zone); }
}

// Warn before throwing away unsaved recordings (in-page, no browser dialog).
let leaveArmed = false;
function confirmLeave() {
  if (leaveArmed) { leaveArmed = false; return true; }
  leaveArmed = true;
  toast(t("Tap again to clear these recordings and start with a new speaker."), "info");
  setTimeout(() => { leaveArmed = false; }, 4000);
  return false;
}

// Warn if the tab is closed with recordings that were never saved.
window.addEventListener("beforeunload", (e) => {
  if (session && Object.keys(session.clips).length) { e.preventDefault(); e.returnValue = ""; }
});

export const ajjiPrompts = PROMPTS;
