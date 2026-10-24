// #/record: record each word in the browser and save clips for the audio/ folder.
import { store, entriesFor } from "./store.js";
import { esc } from "./views.js";
import * as map from "./map.js";
import { toast, emptyHtml, setBusy } from "./ui.js";

function pickType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  const t = types.find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported(x));
  return t ? { mime: t, ext: t.includes("mp4") ? "m4a" : t.includes("ogg") ? "ogg" : "webm" } : null;
}

let stream = null;

async function getMic() {
  if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return stream;
}

export function renderRecord(root) {
  map.setActive(null);
  map.highlightZone(null);
  const type = pickType();
  if (!type || !navigator.mediaDevices?.getUserMedia) {
    root.innerHTML = `<h1>Record words</h1>` + emptyHtml({
      title: "This browser cannot record audio",
      body: "Open the site in Chrome or Edge on a computer or phone with a microphone.",
      actions: `<a class="btn" href="#/">Back to the map</a>`,
    });
    return;
  }

  const places = [...store.places.values()].filter((p) => entriesFor(p.id).some((e) => !e.contributed));
  root.innerHTML = `
    <h1>Record words</h1>
    <p class="lede">Record each word the way it is said in that place. Real voices carry the local accent that a computer voice cannot.</p>
    <ol class="steps">
      <li>Press <strong>Record</strong>, say the word clearly once, then press <strong>Stop</strong>.</li>
      <li>Press <strong>Play</strong> to check it. Record again if needed.</li>
      <li>Press <strong>Save</strong>. Move the file into the project's <code>audio</code> folder.</li>
      <li>When you are done, run <code>node scripts/link-audio.mjs</code> in the project folder. Each word then plays your recording first.</li>
    </ol>
    <p class="muted">Record in a quiet room, about a hand's width from the microphone.</p>
    ${places.map((p) => `
      <h2>${esc(p.name)}</h2>
      <div class="rec-list">
        ${entriesFor(p.id).filter((e) => !e.contributed && (e.dialect?.kn || e.dialect?.tr)).map((e) => `
          <div class="rec" data-id="${e.id}">
            <div class="rec-word">
              ${e.dialect.kn ? `<span lang="kn">${esc(e.dialect.kn)}</span>` : ""}
              <span class="t">${esc(e.dialect.tr || "")}</span>
              <span class="muted">${esc(e.english)}${e.audio ? ", recorded" : ""}</span>
            </div>
            <div class="rec-btns">
              <button type="button" class="btn ghost" data-act="rec">Record</button>
              <button type="button" class="btn ghost" data-act="play" disabled>Play</button>
              <button type="button" class="btn" data-act="save" disabled>Save</button>
            </div>
            <p class="rec-status muted" aria-live="polite"></p>
          </div>`).join("")}
      </div>`).join("")}
  `;

  root.querySelectorAll(".rec").forEach((row) => {
    const id = row.dataset.id;
    const [recBtn, playBtn, saveBtn] = row.querySelectorAll("button");
    const status = row.querySelector(".rec-status");
    let recorder = null, blob = null, url = null;

    recBtn.addEventListener("click", async () => {
      if (recorder && recorder.state === "recording") { recorder.stop(); return; }
      const setStatus = (text, kind = "") => { status.textContent = text; status.dataset.kind = kind; };
      try {
        if (!stream) { setBusy(recBtn, true, "Asking for the microphone…"); setStatus("Allow the microphone when your browser asks."); }
        const s = await getMic();
        setBusy(recBtn, false);
        const chunks = [];
        recorder = new MediaRecorder(s, { mimeType: type.mime });
        recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
        recorder.onstop = () => {
          blob = new Blob(chunks, { type: type.mime });
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(blob);
          recBtn.textContent = "Record again";
          recBtn.classList.remove("live");
          playBtn.disabled = saveBtn.disabled = false;
          if (blob.size < 1000) { setStatus("Nothing was recorded. Check the microphone and try again.", "error"); playBtn.disabled = saveBtn.disabled = true; return; }
          setStatus(`Recorded ${(blob.size / 1024).toFixed(0)} KB. Play it to check.`, "ok");
        };
        recorder.start();
        recBtn.textContent = "Stop";
        recBtn.classList.add("live");
        setStatus("Recording… press Stop when you are done.", "live");
      } catch (err) {
        setBusy(recBtn, false);
        setStatus(err?.name === "NotFoundError"
          ? "No microphone found. Plug one in and try again."
          : "Microphone blocked. Allow microphone access in the address bar and try again.", "error");
      }
    });

    playBtn.addEventListener("click", () => {
      if (!url) return;
      new Audio(url).play().catch(() => toast("Could not play the recording. Record it again.", "error"));
    });

    saveBtn.addEventListener("click", () => {
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.${type.ext}`;
      a.click();
      status.textContent = `Saved as ${id}.${type.ext}. Move it into the audio folder.`;
      status.dataset.kind = "ok";
      toast(`Saved ${id}.${type.ext} to your downloads.`);
    });
  });
}
