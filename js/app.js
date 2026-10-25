// Namma Kannada: entry point and router.
import { loadData, store } from "./store.js";
import { renderMap } from "./map.js";
import * as views from "./views.js";
import { renderRecord } from "./recorder.js";
import { CONFIG } from "./config.js";
import { loadingHtml } from "./ui.js";

// ---------- Footer: year and contact ----------
document.getElementById("year").textContent = String(new Date().getFullYear());

function renderContact() {
  const c = CONFIG.CONTACT || {};
  const esc = views.esc;
  const rows = [];
  if (c.email) rows.push(`<p><span class="lbl">Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>`);
  if (c.phone) rows.push(`<p><span class="lbl">Phone</span><a href="tel:${esc(c.phone.replace(/[^+\d]/g, ""))}">${esc(c.phone)}</a></p>`);
  if (c.address) rows.push(`<p><span class="lbl">Address</span><span>${esc(c.address).replace(/\n/g, "<br>")}</span></p>`);
  const links = (c.links || []).filter((l) => l && l.url);
  if (links.length) rows.push(`<p><span class="lbl">Online</span>${links.map((l) =>
    `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a>`).join(" · ")}</p>`);
  const box = document.getElementById("contact");
  document.getElementById("contact-body").innerHTML = rows.join("");
  box.hidden = rows.length === 0;
}
renderContact();

const view = document.getElementById("view");
const panel = document.getElementById("panel");
const q = document.getElementById("q");
const isNarrow = () => window.matchMedia("(max-width: 860px)").matches;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return { parts, params: Object.fromEntries(new URLSearchParams(query)) };
}

function setNav(name) {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

// ---------- Mobile menu ----------
const menuBtn = document.querySelector(".menu-btn");
const nav = document.getElementById("nav");
function setMenu(open) {
  nav.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
});
document.addEventListener("click", (e) => {
  if (nav.classList.contains("open") && !e.target.closest(".top")) setMenu(false);
});
window.matchMedia("(max-width: 860px)").addEventListener("change", () => setMenu(false));

// ---------- Sticky main action on phones ----------
const cta = document.getElementById("sticky-cta");
const ctaLink = document.getElementById("cta-main");
function syncCta(section, id) {
  const hide = section === "add" || section === "thanks" || section === "record";
  cta.hidden = hide;
  document.body.classList.toggle("has-cta", !hide);
  const place = section === "place" ? store.places.get(id) : null;
  ctaLink.href = place ? `#/add?place=${place.id}` : "#/add";
  ctaLink.textContent = place ? `Add a word from ${place.name.replace(/\s*\(.*\)/, "")}` : "Add a word from your town";
}
// Hide the bar while typing so it does not sit on top of the phone keyboard
document.addEventListener("focusin", (e) => {
  if (e.target.matches("input, textarea, select")) cta.classList.add("typing");
});
document.addEventListener("focusout", () => cta.classList.remove("typing"));

// ---------- Page title and description for each view ----------
const SITE = "Namma Kannada";
const DEFAULT_DESC = document.querySelector('meta[name="description"]').content;

function clip(text, max = 158) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return end > 80 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function setMeta(title, desc = DEFAULT_DESC) {
  const full = title ? `${title} · ${SITE}` : `${SITE} · Kannada dialects of Karnataka on an interactive map`;
  const d = clip(desc);
  document.title = full;
  const set = (sel, val) => document.querySelector(sel)?.setAttribute("content", val);
  set('meta[name="description"]', d);
  set('meta[property="og:title"]', full);
  set('meta[property="og:description"]', d);
  set('meta[name="twitter:title"]', full);
  set('meta[name="twitter:description"]', d);
}

function metaFor(section, id) {
  const count = (placeId) => store.entries.filter((e) => e.place === placeId).length;
  switch (section) {
    case undefined: return [null, DEFAULT_DESC];
    case "zone": {
      const z = store.zones.get(id);
      if (!z) return ["Page not found", "This page does not exist on Namma Kannada."];
      const places = [...store.places.values()].filter((p) => p.zone === id);
      const n = places.reduce((s, p) => s + count(p.id), 0);
      return [`${z.name} Kannada: dialects and words`,
        `How Kannada is spoken in ${z.name}: ${n} words and phrases from ${places.length} places, with sound, pronunciation and sources.`];
    }
    case "place": {
      const p = store.places.get(id);
      if (!p) return ["Page not found", "This page does not exist on Namma Kannada."];
      const n = count(p.id);
      return n
        ? [`${p.name} Kannada: ${n === 1 ? "a local word" : `${n} local words and phrases`}`, p.about || `Words and phrases from ${p.name}, with sound and sources.`]
        : [`${p.name} Kannada`, `No words from ${p.name} yet. Know how people talk in ${p.name}? Add the first word or phrase the way it is said at home.`];
    }
    case "compare": return ["Compare Kannada dialects side by side",
      "The same phrase across Karnataka, from Sirsi and Kundapura to Dharwad and Kalaburagi, next to standard Kannada, with sound."];
    case "guide": return ["How to pronounce Kannada words",
      "A simple guide to reading Kannada in English letters: vowels, curled-tongue sounds, doubled letters, and the sound changes of each region."];
    case "quiz": return ["Guess the region: a Kannada dialect quiz",
      "Hear a Kannada word and guess where in Karnataka it is spoken. A quick quiz built from real regional words and phrases."];
    case "add": return ["Add a word from your town",
      "Know how people talk in your town? Add a Kannada word or phrase the way it is said at home, with its meaning and the story behind it."];
    case "thanks": return ["Thank you for adding a word", "Your word has been added to Namma Kannada on this device."];
    case "sources": return ["Sources and credits",
      "Where every word on Namma Kannada comes from: dictionaries, research, articles and native speakers, plus credits for the voices and the map."];
    case "privacy": return ["Privacy policy (draft)",
      "How Namma Kannada handles your data: no tracking cookies, cookie-free Vercel analytics, and words you add stay on your own device."];
    case "terms": return ["Terms of use (draft)",
      "The terms for using Namma Kannada: an educational project, unchecked dialect entries, sensitive content, and how contributed words are used."];
    case "record": return ["Record Kannada words",
      "Record each word in your own voice so the site can play the real local accent of each place."];
    default: return ["Page not found", "This page does not exist on Namma Kannada."];
  }
}

function route({ fromUser = false } = {}) {
  const { parts, params } = parseHash();
  const [section, id] = parts;
  q.value = "";
  setMenu(false);
  syncCta(section, id);
  setMeta(...metaFor(section, id));

  switch (section) {
    case undefined:
      setNav("explore"); views.renderExplore(view); break;
    case "zone":
      setNav("explore");
      if (store.zones.has(id)) views.renderExplore(view, { zone: id });
      else views.renderNotFound(view);
      break;
    case "place":
      setNav("explore"); views.renderPlace(view, id); break;
    case "compare":
      setNav("compare"); views.renderCompare(view); break;
    case "quiz":
      setNav("quiz"); views.renderQuiz(view); break;
    case "add":
      setNav("add"); views.renderAdd(view, { place: store.places.has(params.place) ? params.place : null }); break;
    case "sources":
      setNav("sources"); views.renderSources(view); break;
    case "guide":
      setNav("guide"); views.renderGuide(view); break;
    case "thanks":
      setNav("add"); views.renderThanks(view); break;
    case "privacy":
      setNav(null); views.renderPrivacy(view); break;
    case "terms":
      setNav(null); views.renderTerms(view); break;
    case "record":
      setNav(null); renderRecord(view); break;
    default:
      setNav(null); views.renderNotFound(view);
  }

  if (fromUser) {
    // On phones the panel sits below the map, so bring it into view.
    if (isNarrow() && section) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0 });
  }
}

let started = false;
async function start() {
  view.innerHTML = loadingHtml("Loading words from across Karnataka…");
  document.getElementById("map").innerHTML = `<div class="map-loading">${loadingHtml("Drawing the map…")}</div>`;
  const slow = setTimeout(() => {
    const s = view.querySelector(".state.loading span:last-child");
    if (s) s.textContent = "Still loading… a slow connection can take a few seconds.";
  }, 6000);
  try {
    await loadData();
  } catch (err) {
    clearTimeout(slow);
    const offline = navigator.onLine === false;
    const local = location.protocol === "file:";
    document.getElementById("map").innerHTML = "";
    view.innerHTML = `
      <div class="state error" role="alert">
        <p class="state-kn" lang="kn" aria-hidden="true">ಅಯ್ಯೋ!</p>
        <h2>The words did not load</h2>
        <p>${offline
          ? "You seem to be offline. Check your internet connection and try again."
          : local
            ? "This site has to be opened through a web server, not by double-clicking index.html. Run <code>npx serve</code> in the project folder."
            : "Something went wrong while loading the words. Please try again in a moment."}</p>
        <div class="actions"><button class="btn" type="button" id="retry">Try again</button></div>
      </div>`;
    view.querySelector("#retry").addEventListener("click", start);
    return;
  }
  clearTimeout(slow);
  if (started) { route(); return; }
  started = true;

  renderMap(document.getElementById("map"), {
    onSelect: (id) => { location.hash = `#/place/${id}`; },
  });

  const legend = document.getElementById("legend");
  legend.innerHTML = store.data.zones.map((z) =>
    `<li><button type="button" data-zone="${z.id}" style="--zone:${z.color}" aria-pressed="false"><span class="sw"></span>${views.esc(z.name)}</button></li>`
  ).join("");
  legend.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-zone]");
    if (!b) return;
    const already = location.hash === `#/zone/${b.dataset.zone}`;
    location.hash = already ? "#/" : `#/zone/${b.dataset.zone}`;
  });
  const syncLegend = () => {
    const { parts } = parseHash();
    legend.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-pressed", String(parts[0] === "zone" && parts[1] === b.dataset.zone)));
  };

  let searchTimer;
  q.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (q.value.trim()) {
        views.renderSearch(view, q.value);
        setMeta(`“${q.value.trim()}” in Kannada dialects`, `Kannada words and phrases matching “${q.value.trim()}”, from places across Karnataka.`);
      }
      else route();
    }, 120);
  });

  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#/quiz")) views.resetQuiz();
    route({ fromUser: true });
    syncLegend();
  });
  route();
  syncLegend();
}

start();
