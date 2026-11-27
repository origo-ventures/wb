/* Core behaviour: mobile navigation and footer year. No dependencies. */
(function () {
  "use strict";
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");

  var behind = function () { return Array.prototype.slice.call(document.querySelectorAll("main, footer, .wa-btn, .skip-link")); };
  function setOpen(open, returnFocus) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    nav.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    behind().forEach(function (e) { if ("inert" in e) e.inert = open; });   // the page behind cannot be tabbed into while the menu is open
    if (!open && returnFocus) toggle.focus();
  }
  function menuFocusables() { return [toggle].concat(Array.prototype.slice.call(nav.querySelectorAll("a[href]"))); }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (e.key === "Escape") { setOpen(false, true); return; }
      if (e.key === "Tab") {                                   // keep Tab inside the open menu
        var f = menuFocusables(), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.matchMedia("(min-width: 960px)").addEventListener("change", function (m) {
      if (m.matches) setOpen(false);
    });
  }

  var year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
