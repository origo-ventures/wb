/* Gallery: category filter + accessible lightbox (keyboard, swipe, focus return).
   Markup: [data-gallery] > a[data-lightbox][data-cat][data-caption] > img ; buttons [data-filter] */
(function () {
  "use strict";
  var WB = window.WB || { qsa: function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }, reduce: false };
  var galleries = WB.qsa("[data-gallery]");
  if (!galleries.length && !WB.qsa("[data-filter]").length) return;

  /* ---------- Filter ---------- */
  WB.qsa("[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var cat = btn.getAttribute("data-filter");
      WB.qsa("[data-filter]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      WB.qsa("[data-cat]").forEach(function (it) {
        var show = cat === "all" || it.getAttribute("data-cat") === cat;
        it.hidden = !show;
        if (show) { it.classList.remove("is-in"); void it.offsetWidth; it.classList.add("is-in"); }
      });
    });
  });

  /* ---------- Lightbox ---------- */
  if (!galleries.length) return;
  var box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Image viewer");
  box.hidden = true;
  box.innerHTML =
    '<button class="lightbox__close" type="button" aria-label="Close">&times;</button>' +
    '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Previous image">&#8249;</button>' +
    '<figure class="lightbox__figure"><img class="lightbox__img" alt=""><figcaption class="lightbox__caption"></figcaption></figure>' +
    '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Next image">&#8250;</button>' +
    '<p class="lightbox__count" aria-live="polite"></p>';
  document.body.appendChild(box);
  var img = box.querySelector(".lightbox__img");
  var cap = box.querySelector(".lightbox__caption");
  var count = box.querySelector(".lightbox__count");
  var items = [], index = 0, opener = null;

  function show(i, dir) {
    index = (i + items.length) % items.length;
    var it = items[index];
    var thumb = it.querySelector("img");
    img.classList.remove("is-swap");
    void img.offsetWidth;
    img.src = it.getAttribute("href");
    img.alt = (thumb && thumb.alt) || "";
    cap.textContent = it.getAttribute("data-caption") || "";
    count.textContent = (index + 1) + " / " + items.length;
    if (!WB.reduce) img.classList.add("is-swap");
    var n = new Image(); n.src = items[(index + 1) % items.length].getAttribute("href");
  }
  function open(it) {
    var group = it.closest("[data-gallery]");
    items = WB.qsa("[data-lightbox]", group).filter(function (x) { return !x.hidden; });
    opener = it;
    box.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () { box.classList.add("is-open"); });
    show(items.indexOf(it));
    box.querySelector(".lightbox__close").focus();
  }
  function close() {
    box.classList.remove("is-open");
    document.body.style.overflow = "";
    setTimeout(function () { box.hidden = true; }, WB.reduce ? 0 : 250);
    if (opener) opener.focus();
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-lightbox]");
    if (a) { e.preventDefault(); e.stopPropagation(); open(a); }
  }, true);
  box.querySelector(".lightbox__close").addEventListener("click", close);
  box.querySelector(".lightbox__nav--prev").addEventListener("click", function () { show(index - 1); });
  box.querySelector(".lightbox__nav--next").addEventListener("click", function () { show(index + 1); });
  box.addEventListener("click", function (e) { if (e.target === box) close(); });
  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") show(index + 1);
    else if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "Tab") {                       // keep focus inside the dialog
      var f = WB.qsa("button", box);
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  var sx = null;
  box.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    sx = null;
  });
})();
