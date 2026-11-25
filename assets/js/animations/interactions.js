/* Delight layer: soft custom cursor, magnetic buttons, 3D tilt, petal burst on click.
   Pointer-precise devices only; skipped for reduced motion. */
(function () {
  "use strict";
  var WB = window.WB;
  if (!WB || WB.reduce) return;

  /* ---------- Petal burst (works on touch too) ---------- */
  var COLORS = ["#E9B9BF", "#D98C98", "#B76E79", "#C9A27A", "#F3D3D3"];
  document.addEventListener("click", function (e) {
    var host = e.target.closest && e.target.closest("[data-burst]");
    if (!host) return;
    var x = e.clientX || host.getBoundingClientRect().left + host.offsetWidth / 2;
    var y = e.clientY || host.getBoundingClientRect().top + host.offsetHeight / 2;
    for (var i = 0; i < 14; i++) {
      var p = document.createElement("span");
      p.className = "burst-petal";
      p.setAttribute("aria-hidden", "true");
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.background = COLORS[i % COLORS.length];
      document.body.appendChild(p);
      var a = (Math.PI * 2 * i) / 14 + Math.random() * 0.5;
      var d = 50 + Math.random() * 70;
      var anim = p.animate([
        { transform: "translate(-50%,-50%) rotate(0deg) scale(0.4)", opacity: 1 },
        { transform: "translate(calc(-50% + " + (Math.cos(a) * d).toFixed(0) + "px), calc(-50% + " + (Math.sin(a) * d + 30).toFixed(0) + "px)) rotate(" + (Math.random() * 360).toFixed(0) + "deg) scale(1)", opacity: 0 }
      ], { duration: 800 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.3,1)" });
      anim.onfinish = (function (el) { return function () { el.remove(); }; })(p);
    }
  });

  if (!WB.fine || WB.off("cursor")) return;

  /* ---------- Custom cursor ---------- */
  var ring = document.createElement("div");
  ring.className = "cursor";
  ring.setAttribute("aria-hidden", "true");
  var label = document.createElement("span");
  label.className = "cursor__label";
  ring.appendChild(label);
  document.body.appendChild(ring);
  var cx = 0, cy = 0, tx = 0, ty = 0, shown = false, raf = false;
  function move() {
    cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
    ring.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
    if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) requestAnimationFrame(move); else raf = false;
  }
  document.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    tx = e.clientX; ty = e.clientY;
    if (!shown) { shown = true; cx = tx; cy = ty; ring.classList.add("is-active"); }
    if (!raf) { raf = true; requestAnimationFrame(move); }
    var t = e.target.closest && e.target.closest("a, button, summary, input, label, [data-cursor]");
    ring.classList.toggle("is-hover", !!t);
    var txt = t && t.closest("[data-cursor]") ? t.closest("[data-cursor]").getAttribute("data-cursor") : "";
    label.textContent = txt;
    ring.classList.toggle("has-label", !!txt);
  });
  document.addEventListener("pointerleave", function () { ring.classList.remove("is-active"); shown = false; });
  document.addEventListener("pointerdown", function () { ring.classList.add("is-down"); });
  document.addEventListener("pointerup", function () { ring.classList.remove("is-down"); });

  /* ---------- Magnetic buttons ---------- */
  WB.qsa("[data-magnetic]").forEach(function (el) {
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) * 0.28;
      var dy = (e.clientY - (r.top + r.height / 2)) * 0.38;
      el.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
    });
    el.addEventListener("pointerleave", function () { el.style.transform = ""; });
  });

  /* ---------- 3D tilt with moving light ---------- */
  WB.qsa("[data-tilt]").forEach(function (el) {
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.transform = "perspective(900px) rotateY(" + ((px - 0.5) * 9).toFixed(2) + "deg) rotateX(" + ((0.5 - py) * 9).toFixed(2) + "deg) scale(1.02)";
      el.style.setProperty("--mx", (px * 100).toFixed(0) + "%");
      el.style.setProperty("--my", (py * 100).toFixed(0) + "%");
    });
    el.addEventListener("pointerleave", function () { el.style.transform = ""; });
  });
})();
