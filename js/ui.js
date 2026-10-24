// Shared UI states: loading blocks, empty states, toasts and clipboard copy.

export const spinner = `<span class="spinner" aria-hidden="true"></span>`;

export function loadingHtml(text = "Loading…") {
  return `<div class="state loading" role="status">${spinner}<span>${text}</span></div>`;
}

// Empty state card. `actions` is ready-made HTML (links or buttons).
export function emptyHtml({ title, body = "", actions = "", kn = "" }) {
  return `
    <div class="state empty">
      ${kn ? `<p class="state-kn" lang="kn" aria-hidden="true">${kn}</p>` : ""}
      <h2>${title}</h2>
      ${body ? `<p>${body}</p>` : ""}
      ${actions ? `<div class="actions">${actions}</div>` : ""}
    </div>`;
}

// Short message that slides up from the bottom and fades. kind: "ok" | "error" | "info".
let toastTimer = null;
export function toast(message, kind = "ok") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast ${kind}`;
  el.hidden = false;
  // restart the animation if a toast is already showing
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.hidden = true; }, 250);
  }, kind === "error" ? 5000 : 2800);
}

// Copy text, with a fallback for browsers that block the clipboard API.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// Put a button into a busy state while async work runs.
export function setBusy(button, busy, busyText) {
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.innerHTML = `${spinner}<span>${busyText}</span>`;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  } else {
    if (button.dataset.label) button.innerHTML = button.dataset.label;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
