// 404 page: footer year, the mobile menu and the language switch, without loading the app.
import { t, isKn, setLang } from "/js/i18n.js";

document.getElementById("year").textContent = String(new Date().getFullYear());

const btn = document.querySelector(".menu-btn");
const nav = document.getElementById("nav");
const langBtn = document.getElementById("lang-btn");

function setMenu(open) {
  nav.classList.toggle("open", open);
  btn.setAttribute("aria-expanded", String(open));
  btn.setAttribute("aria-label", t(open ? "Close menu" : "Open menu"));
}
btn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
document.addEventListener("click", (e) => { if (!e.target.closest(".top")) setMenu(false); });

function apply() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  document.title = `${t("Page not found")} · ${t("Namma Kannada")}`;
  langBtn.textContent = isKn() ? "English" : "ಕನ್ನಡ";
  langBtn.lang = isKn() ? "en" : "kn";
  langBtn.setAttribute("aria-label", isKn() ? "Switch to English" : "ಕನ್ನಡದಲ್ಲಿ ಓದಿ (Switch to Kannada)");
  btn.setAttribute("aria-label", t(nav.classList.contains("open") ? "Close menu" : "Open menu"));
}
langBtn.addEventListener("click", () => { setLang(isKn() ? "en" : "kn"); apply(); });
apply();
