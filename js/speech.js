// Sound for word cards.
// 1. A recorded clip (entry.audio) always wins: it carries the real local accent.
// 2. Otherwise, the browser's built-in Kannada voice reads the Kannada spelling.
//    Edge on Windows and Chrome on Android usually have one; desktop Chrome often does not.

import { toast } from "./ui.js";

let knVoice = null;
let ready = null;

export function initSpeech() {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve(null);
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      // Prefer natural (online) voices, which sound far better.
      knVoice =
        voices.find((v) => /^kn/i.test(v.lang) && /natural|online/i.test(v.name)) ||
        voices.find((v) => /^kn/i.test(v.lang)) ||
        null;
      return knVoice;
    };
    if (pick()) return resolve(knVoice);
    speechSynthesis.addEventListener("voiceschanged", () => resolve(pick()), { once: true });
    setTimeout(() => resolve(pick()), 1500); // some browsers never fire the event
  });
  return ready;
}

export const hasVoice = () => !!knVoice;

let current = null;

function speak(text, button) {
  stopCurrent();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = knVoice.lang;
  try { u.voice = knVoice; } catch { /* lang alone still selects a Kannada voice */ }
  u.rate = 0.85;
  setState(button, "playing");
  u.onend = () => setState(button, null);
  u.onerror = (ev) => setState(button, ev.error === "interrupted" || ev.error === "canceled" ? null : "error");
  speechSynthesis.speak(u);
}

// Loading -> playing -> idle, or an error flash if the clip cannot play.
function setState(button, state) {
  button.classList.remove("loading", "playing", "error");
  button.removeAttribute("aria-busy");
  if (state === "loading") { button.classList.add("loading"); button.setAttribute("aria-busy", "true"); }
  if (state === "playing") button.classList.add("playing");
  if (state === "error") {
    button.classList.add("error");
    setTimeout(() => button.classList.remove("error"), 1600);
    toast("Could not play this sound. Check your connection and try again.", "error");
  }
}

function stopCurrent() {
  if (current) { current.pause(); current.dispatchEvent(new Event("stopped")); }
  window.speechSynthesis?.cancel();
}

// Play one or more clips one after another (for entries with variant forms).
function playClips(list, button) {
  stopCurrent();
  let i = 0, stopped = false;
  setState(button, "loading");
  const next = () => {
    if (stopped) return;
    if (i >= list.length) { setState(button, null); return; }
    const a = new Audio(list[i++]);
    current = a;
    a.addEventListener("stopped", () => { stopped = true; setState(button, null); }, { once: true });
    a.addEventListener("waiting", () => setState(button, "loading"));
    a.addEventListener("playing", () => setState(button, "playing"));
    a.addEventListener("ended", () => setTimeout(next, 250));
    a.addEventListener("error", () => { stopped = true; setState(button, "error"); }, { once: true });
    a.play().catch((err) => {
      if (stopped || err?.name === "AbortError") return;
      stopped = true;
      setState(button, "error");
    });
  };
  next();
}

const playFile = (src, button) => playClips([src], button);

// Wire every sound button inside root. Buttons for the computer voice are hidden
// when this browser has no Kannada voice.
export async function wireSound(root) {
  await initSpeech();
  root.querySelectorAll("[data-audio]").forEach((b) => {
    b.addEventListener("click", () => playFile(b.dataset.audio, b));
  });
  root.querySelectorAll("[data-clips]").forEach((b) => {
    b.addEventListener("click", () => playClips(b.dataset.clips.split("|"), b));
  });
  root.querySelectorAll("[data-say]").forEach((b) => {
    if (!knVoice) { b.hidden = true; return; }
    b.hidden = false;
    b.addEventListener("click", () => speak(b.dataset.say, b));
  });
}
