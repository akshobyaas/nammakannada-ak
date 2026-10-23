// Namma Kannada: entry point and router.
import { loadData, store } from "./store.js";
import { renderMap } from "./map.js";
import * as views from "./views.js";
import { renderRecord } from "./recorder.js";

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

function route({ fromUser = false } = {}) {
  const { parts, params } = parseHash();
  const [section, id] = parts;
  q.value = "";

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

async function start() {
  try {
    await loadData();
  } catch (err) {
    view.innerHTML = `<h1>The words did not load</h1>
      <p class="lede">${views.esc(err.message)}. Open this site through a local server, for example <code>npx serve</code>, not by double-clicking index.html.</p>`;
    return;
  }

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
      if (q.value.trim()) views.renderSearch(view, q.value);
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
