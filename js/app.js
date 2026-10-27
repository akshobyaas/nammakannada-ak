// Namma Kannada: entry point and router.
import { loadData, loadPublic, store } from "./store.js";
import { renderMap } from "./map.js";
import * as views from "./views.js";
import { renderRecord } from "./recorder.js";
import { renderAjji } from "./ajji.js";
import { CONFIG } from "./config.js";
import { loadingHtml } from "./ui.js";
import { t, isKn, setLang, plural, placeName, zoneName, dt, loadDataKn } from "./i18n.js";

// ---------- Footer: year and contact ----------
document.getElementById("year").textContent = String(new Date().getFullYear());

function renderContact() {
  const c = CONFIG.CONTACT || {};
  const esc = views.esc;
  const rows = [];
  if (c.email) rows.push(`<p><span class="lbl">${t("Email")}</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>`);
  if (c.phone) rows.push(`<p><span class="lbl">${t("Phone")}</span><a href="tel:${esc(c.phone.replace(/[^+\d]/g, ""))}">${esc(c.phone)}</a></p>`);
  if (c.address) rows.push(`<p><span class="lbl">${t("Address")}</span><span>${esc(c.address).replace(/\n/g, "<br>")}</span></p>`);
  const links = (c.links || []).filter((l) => l && l.url);
  if (links.length) rows.push(`<p><span class="lbl">${t("Online")}</span>${links.map((l) =>
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

// ---------- Keep the map exactly below the sticky header ----------
const header = document.querySelector(".top");
const syncHead = () => document.documentElement.style.setProperty("--head", `${header.offsetHeight}px`);
new ResizeObserver(syncHead).observe(header);
syncHead();

// ---------- Mobile menu ----------
const menuBtn = document.querySelector(".menu-btn");
const nav = document.getElementById("nav");
function setMenu(open) {
  nav.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", t(open ? "Close menu" : "Open menu"));
}
menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
});
document.addEventListener("click", (e) => {
  if (nav.classList.contains("open") && !e.target.closest(".top")) setMenu(false);
});
window.matchMedia("(max-width: 1279px)").addEventListener("change", () => setMenu(false));

// ---------- Sticky main action on phones ----------
const cta = document.getElementById("sticky-cta");
const ctaLink = document.getElementById("cta-main");
function syncCta(section, id) {
  const hide = section === "add" || section === "thanks" || section === "record" || section === "ajji";
  cta.hidden = hide;
  document.body.classList.toggle("has-cta", !hide);
  const place = section === "place" ? store.places.get(id) : null;
  ctaLink.href = place ? `#/add?place=${place.id}` : "#/add";
  ctaLink.textContent = place ? t("Add a word from {place}", { place: placeName(place).replace(/\s*\(.*\)/, "") }) : t("Add a word from your town");
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

function setMeta(title, desc = t(DEFAULT_DESC)) {
  const site = t(SITE);
  const full = title ? `${t(title)} · ${site}` : `${site} · ${t("Kannada dialects of Karnataka on an interactive map")}`;
  const d = clip(t(desc));
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
    case undefined: return [null, t(DEFAULT_DESC)];
    case "zone": {
      const z = store.zones.get(id);
      if (!z) return ["Page not found", "This page does not exist on Namma Kannada."];
      const places = [...store.places.values()].filter((p) => p.zone === id);
      const n = places.reduce((s, p) => s + count(p.id), 0);
      return [t("{zone} Kannada: dialects and words", { zone: zoneName(z) }),
        t("How Kannada is spoken in {zone}: {n} words and phrases from {p} places, with sound, pronunciation and sources.", { zone: zoneName(z), n, p: places.length })];
    }
    case "place": {
      const p = store.places.get(id);
      if (!p) return ["Page not found", "This page does not exist on Namma Kannada."];
      const n = count(p.id);
      const name = placeName(p);
      return n
        ? [p.id === "brhills" ? t("{place}: {n} Solega words", { place: name, n })
          : n === 1 ? t("{place} Kannada: a local word", { place: name }) : t("{place} Kannada: {n} local words and phrases", { place: name, n }), dt.about(p) || t("Words and phrases from {place}, with sound and sources.", { place: name })]
        : [t("{place} Kannada", { place: name }), t("No words from {place} yet. Know how people talk in {place}? Add the first word or phrase the way it is said at home.", { place: name })];
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
    case "privacy": return ["Privacy policy",
      "How Namma Kannada handles your data: no tracking cookies, cookie-free Vercel analytics, and words you add stay on your own device."];
    case "terms": return ["Terms of use",
      "The terms for using Namma Kannada: an educational project, unchecked dialect entries, sensitive content, and how contributed words are used."];
    case "admin": return ["Visitor words", "Remove visitor words from Namma Kannada."];
    case "ajji": return ["Ajji's words: record an elder's Kannada",
      "Hand your phone to a grandparent: they see a picture, not a word, and answer the way they really talk. Save your family's dialect in two minutes."];
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
  document.body.dataset.page = section || "home";
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
    case "ajji":
      setNav("ajji"); renderAjji(view); break;
    case "admin":
      setNav(null); views.renderAdmin(view); break;
    default:
      setNav(null); views.renderNotFound(view);
  }

  if (fromUser) {
    // On phones the panel sits below the map, so bring it into view.
    if (isNarrow() && section) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0 });
  }
}

// ---------- One-tap language switch: English ⇄ ಕನ್ನಡ ----------
let drawMapAndLegend = null;
let syncLegendRef = null;
const langBtn = document.getElementById("lang-btn");

// Fixed text in index.html carries its English in data-i18n attributes.
function applyStatic() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)); });
  // The button always offers the other language, written in that language.
  langBtn.textContent = isKn() ? "English" : "ಕನ್ನಡ";
  langBtn.lang = isKn() ? "en" : "kn";
  langBtn.setAttribute("aria-label", isKn() ? "Switch to English" : "ಕನ್ನಡದಲ್ಲಿ ಓದಿ (Switch to Kannada)");
  langBtn.title = langBtn.getAttribute("aria-label");
  menuBtn.setAttribute("aria-label", t(nav.classList.contains("open") ? "Close menu" : "Open menu"));
  renderContact();
}

// Keep what someone has typed in the Add a word form across the switch.
function captureForm() {
  const form = document.getElementById("add");
  if (!form) return null;
  const vals = {};
  for (const el of form.elements) if (el.name) vals[el.name] = el.value;
  return vals;
}
function restoreForm(vals) {
  const form = document.getElementById("add");
  if (!form || !vals) return;
  for (const [k, v] of Object.entries(vals)) if (form.elements[k]) form.elements[k].value = v;
  form.elements.place?.dispatchEvent(new Event("change"));
  form.elements.note?.dispatchEvent(new Event("input"));
}

langBtn.addEventListener("click", () => {
  setLang(isKn() ? "en" : "kn");
  applyStatic();
  if (!store.data) return; // still loading: the page will render in the new language
  const typed = captureForm();
  const scrollY = window.scrollY;
  drawMapAndLegend?.();
  if (q.value.trim()) {
    views.renderSearch(view, q.value);
    setMeta(t("“{q}” in Kannada dialects", { q: q.value.trim() }), t("Kannada words and phrases matching “{q}”, from places across Karnataka.", { q: q.value.trim() }));
    syncCta(...parseHash().parts);
  } else {
    route();
  }
  syncLegendRef?.();
  restoreForm(typed);
  window.scrollTo({ top: scrollY });
});
applyStatic();

let started = false;
async function start() {
  view.innerHTML = loadingHtml(t("Loading words from across Karnataka…"));
  document.getElementById("map").innerHTML = `<div class="map-loading">${loadingHtml(t("Drawing the map…"))}</div>`;
  const slow = setTimeout(() => {
    const s = view.querySelector(".state.loading span:last-child");
    if (s) s.textContent = t("Still loading… a slow connection can take a few seconds.");
  }, 6000);
  try {
    await Promise.all([loadData(), loadDataKn(), loadPublic()]);
  } catch (err) {
    clearTimeout(slow);
    const offline = navigator.onLine === false;
    const local = location.protocol === "file:";
    document.getElementById("map").innerHTML = "";
    view.innerHTML = `
      <div class="state error" role="alert">
        <p class="state-kn" lang="kn" aria-hidden="true">ಅಯ್ಯೋ!</p>
        <h2>${t("The words did not load")}</h2>
        <p>${t(offline
          ? "You seem to be offline. Check your internet connection and try again."
          : local
            ? "This site has to be opened through a web server, not by double-clicking index.html. Run <code>npx serve</code> in the project folder."
            : "Something went wrong while loading the words. Please try again in a moment.")}</p>
        <div class="actions"><button class="btn" type="button" id="retry">${t("Try again")}</button></div>
      </div>`;
    view.querySelector("#retry").addEventListener("click", start);
    return;
  }
  clearTimeout(slow);
  if (started) { route(); return; }
  started = true;

  const legend = document.getElementById("legend");
  drawMapAndLegend = () => {
    renderMap(document.getElementById("map"), {
      onSelect: (id) => { location.hash = `#/place/${id}`; },
    });
    legend.innerHTML = store.data.zones.map((z) =>
      `<li><button type="button" data-zone="${z.id}" style="--zone:${z.color}" aria-pressed="false"><span class="sw"></span>${views.esc(zoneName(z))}</button></li>`
    ).join("");
  };
  drawMapAndLegend();
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
        setMeta(t("“{q}” in Kannada dialects", { q: q.value.trim() }), t("Kannada words and phrases matching “{q}”, from places across Karnataka.", { q: q.value.trim() }));
      }
      else route();
    }, 120);
  });

  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#/quiz")) views.resetQuiz();
    route({ fromUser: true });
    syncLegend();
  });
  syncLegendRef = syncLegend;
  route();
  syncLegend();
}

start();
