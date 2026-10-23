// Sound for word cards.
// 1. A recorded clip (entry.audio) always wins: it carries the real local accent.
// 2. Otherwise, the browser's built-in Kannada voice reads the Kannada spelling.
//    Edge on Windows and Chrome on Android usually have one; desktop Chrome often does not.

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
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = knVoice.lang;
  try { u.voice = knVoice; } catch { /* lang alone still selects a Kannada voice */ }
  u.rate = 0.85;
  button.classList.add("playing");
  u.onend = u.onerror = () => button.classList.remove("playing");
  speechSynthesis.speak(u);
}

function playFile(src, button) {
  if (current) current.pause();
  const a = new Audio(src);
  current = a;
  button.classList.add("playing");
  a.onended = () => button.classList.remove("playing");
  a.play().catch(() => {
    button.classList.remove("playing");
    button.textContent = "Recording missing";
    button.disabled = true;
  });
}

// Play several clips one after another (for entries with variant forms).
function playClips(list, button) {
  if (current) current.pause();
  window.speechSynthesis?.cancel();
  let i = 0;
  button.classList.add("playing");
  const next = () => {
    if (i >= list.length) { button.classList.remove("playing"); return; }
    const a = new Audio(list[i++]);
    current = a;
    a.onended = () => setTimeout(next, 250);
    a.play().catch(() => button.classList.remove("playing"));
  };
  next();
}

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
