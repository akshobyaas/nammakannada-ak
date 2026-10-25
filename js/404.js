// 404 page: footer year and the same mobile menu as the main site, without loading the app.
document.getElementById("year").textContent = String(new Date().getFullYear());
(function () {
  var btn = document.querySelector(".menu-btn"), nav = document.getElementById("nav");
  function set(open) {
    nav.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  btn.addEventListener("click", function () { set(!nav.classList.contains("open")); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  document.addEventListener("click", function (e) { if (!e.target.closest(".top")) set(false); });
})();
