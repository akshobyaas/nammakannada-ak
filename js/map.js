// Renders the Karnataka SVG map with place pins.
import { MAP, projectPoint } from "./map-data.js";
import { store, entriesFor } from "./store.js";

const SVG = "http://www.w3.org/2000/svg";
let root, pins = new Map();

function el(name, attrs = {}) {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

const ZONE_ORDER = ["south", "malnad", "coast", "north", "kalyana"];

export function renderMap(container, { onSelect }) {
  root = container;
  const svg = el("svg", {
    viewBox: `0 0 ${MAP.width} ${MAP.height}`,
    role: "group",
    "aria-label": "Karnataka with regional dialect places",
  });

  const districts = el("g", { "aria-hidden": "true" });
  for (const d of MAP.districts) {
    const zone = store.zones.get(d.zone);
    const p = el("path", { d: d.d, class: "district", "data-zone": d.zone });
    p.style.setProperty("--zone", zone?.color || "#888");
    const t = el("title");
    t.textContent = `${d.name} district`;
    p.append(t);
    districts.append(p);
  }
  svg.append(districts);

  // Pins: drop in zone by zone.
  const pinLayer = el("g");
  const places = [...store.places.values()].sort(
    (a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone)
  );
  places.forEach((place, i) => {
    const [x, y] = projectPoint(place.lng, place.lat);
    const zone = store.zones.get(place.zone);
    const count = entriesFor(place.id).length;
    const g = el("g", {
      class: "pin" + (count ? "" : " empty"),
      tabindex: "0",
      role: "button",
      "data-place": place.id,
      "aria-label": `${place.name}, ${count ? count + (count === 1 ? " word" : " words") : "no words yet"}`,
    });
    g.style.setProperty("--zone", zone.color);
    g.style.setProperty("--delay", `${200 + ZONE_ORDER.indexOf(place.zone) * 140 + (i % 4) * 30}ms`);
    g.append(
      el("circle", { class: "halo", cx: x, cy: y, r: 15 }),
      el("circle", { class: "dot", cx: x, cy: y, r: 7 })
    );
    // Labels sit to the side that keeps them inside the map.
    const left = x > MAP.width * 0.68;
    const label = el("text", {
      class: "label",
      x: left ? x - 14 : x + 14,
      y: y + 5,
      "text-anchor": left ? "end" : "start",
    });
    label.textContent = place.name;
    g.append(label);

    const choose = () => onSelect(place.id);
    g.addEventListener("click", choose);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); }
    });
    pinLayer.append(g);
    pins.set(place.id, g);
  });
  svg.append(pinLayer);

  container.replaceChildren(svg);
}

export function refreshPinCounts() {
  for (const [id, g] of pins) {
    const n = entriesFor(id).length;
    const place = store.places.get(id);
    g.classList.toggle("empty", n === 0);
    g.setAttribute("aria-label", `${place.name}, ${n ? n + (n === 1 ? " word" : " words") : "no words yet"}`);
  }
}

export function setActive(placeId) {
  for (const [id, g] of pins) g.classList.toggle("active", id === placeId);
  // Bring the active pin to the front so its label is readable.
  const g = pins.get(placeId);
  if (g) g.parentNode.append(g);
}

export function highlightZone(zoneId) {
  if (zoneId) root.dataset.zone = zoneId;
  else delete root.dataset.zone;
}

export function flash(placeId, cls = "flash") {
  const g = pins.get(placeId);
  if (!g) return;
  g.classList.add(cls);
  g.parentNode.append(g);
}

export function clearMarks() {
  for (const g of pins.values()) g.classList.remove("flash", "correct", "wrong");
}
