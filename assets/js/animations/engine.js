/* Wedding Berries animation engine.
   Scroll reveals, split-text, counters, parallax, scroll progress, smart header, marquee velocity,
   timeline, page transitions. One shared rAF-throttled scroll handler keeps it light. */
(function () {
  "use strict";
  var WB = window.WB;
  if (!WB) return;
  var root = document.documentElement;
  var qsa = WB.qsa;
  var animOn = root.classList.contains("js-anim") && !WB.reduce;

  /* ---------- Split text into masked words ---------- */
  qsa('[data-anim="words"]').forEach(function (el) {
    var text = el.textContent.replace(/\s+/g, " ").trim();
    if (!text) return;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    text.split(" ").forEach(function (w, i, arr) {
      var outer = document.createElement("span");
      outer.className = "word";
      outer.setAttribute("aria-hidden", "true");
      var inner = document.createElement("span");
      inner.textContent = w;
      inner.style.setProperty("--i", i);
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });

  /* ---------- Delays and stagger ---------- */
  qsa("[data-delay]").forEach(function (el) { el.style.setProperty("--d", el.getAttribute("data-delay") + "s"); });
  qsa("[data-stagger]").forEach(function (parent) {
    var step = parseFloat(parent.getAttribute("data-stagger")) || 0.12;
    Array.prototype.forEach.call(parent.children, function (child, i) {
      if (!child.hasAttribute("data-anim")) child.setAttribute("data-anim", "fade-up");
      child.style.setProperty("--d", (i * step).toFixed(2) + "s");
      child.setAttribute("data-staggered", "");
    });
  });

  /* ---------- Counters ---------- */
  function runCounter(el) {
    var end = parseFloat(el.getAttribute("data-count"));
    if (isNaN(end)) return;
    var suffix = el.getAttribute("data-suffix") || "";
    var prefix = el.getAttribute("data-prefix") || "";
    var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var dur = 2200, t0 = null;
    function fmt(v) { return prefix + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix; }
    if (WB.reduce) { el.textContent = fmt(end); return; }
    function tick(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = fmt(end * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    el.textContent = fmt(0);
    requestAnimationFrame(tick);
  }

  /* ---------- Reveal observer ---------- */
  var targets = qsa("[data-anim], [data-count], [data-draw]");
  function reveal(el) {
    WB.whenReady(function () {
      el.classList.add("is-in");
      if (el.hasAttribute("data-count")) runCounter(el);
    });
  }
  if (!animOn || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    // clip-path hides an element from IntersectionObserver, so clipped reveals are watched through their parent.
    var proxy = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        (proxy.get(en.target) || [en.target]).forEach(reveal);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    targets.forEach(function (el) {
      var watch = el.getAttribute("data-anim") === "clip-up" && el.parentElement ? el.parentElement : el;
      if (watch !== el) { if (!proxy.has(watch)) proxy.set(watch, []); proxy.get(watch).push(el); }
      io.observe(watch);
    });
  }

  /* ---------- Scroll-linked effects (single rAF loop) ---------- */
  var progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.appendChild(progress);

  var header = document.querySelector(".site-header");
  var navToggle = document.querySelector("[data-nav-toggle]");
  var parallax = animOn ? qsa("[data-parallax]") : [];
  var heroInner = animOn ? document.querySelector("[data-hero-scroll]") : null;
  var timelines = qsa("[data-timeline]");
  var track = document.querySelector(".marquee__track");
  var marqueeAnim = null;
  var lastY = window.pageYOffset, velocity = 0, ticking = false, vh = window.innerHeight;

  function update() {
    ticking = false;
    var y = window.pageYOffset;
    var dy = y - lastY;
    lastY = y;
    var max = document.documentElement.scrollHeight - vh;
    progress.style.transform = "scaleX(" + (max > 0 ? WB.clamp(y / max, 0, 1) : 0) + ")";

    if (header && !(navToggle && navToggle.getAttribute("aria-expanded") === "true")) {
      header.classList.toggle("is-scrolled", y > 8);
      if (y > 160 && dy > 4) header.classList.add("is-hidden");
      else if (dy < -4 || y < 160) header.classList.remove("is-hidden");
    }

    parallax.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var speed = parseFloat(el.getAttribute("data-parallax")) || 0.1;
      var offset = (r.top + r.height / 2 - vh / 2) * -speed;
      el.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
    });

    if (heroInner) {
      var p = WB.clamp(y / (vh * 0.8), 0, 1);
      heroInner.style.transform = "translate3d(0," + (y * 0.18).toFixed(1) + "px,0)";
      heroInner.style.opacity = (1 - p * 0.9).toFixed(2);
    }

    timelines.forEach(function (tl) {
      var r = tl.getBoundingClientRect();
      var p = WB.clamp((vh * 0.6 - r.top) / r.height, 0, 1);
      tl.style.setProperty("--p", p.toFixed(3));
      WB.qsa(".timeline__item", tl).forEach(function (it) {
        it.classList.toggle("is-lit", it.getBoundingClientRect().top < vh * 0.62);
      });
    });

    if (track && !WB.reduce) {
      if (!marqueeAnim && track.getAnimations) marqueeAnim = track.getAnimations()[0] || null;
      velocity = WB.lerp(velocity, Math.abs(dy), 0.25);
      if (marqueeAnim) marqueeAnim.playbackRate = 1 + Math.min(velocity * 0.35, 9);
      if (velocity > 0.2) requestTick();
      else if (marqueeAnim) marqueeAnim.playbackRate = 1;
    }
  }
  function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", function () { vh = window.innerHeight; requestTick(); });
  update();

  /* ---------- Page transitions ---------- */
  if (!WB.reduce) {
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash links
      e.preventDefault();
      document.body.classList.add("is-leaving");
      setTimeout(function () { location.href = url.href; }, 320);
    });
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) document.body.classList.remove("is-leaving");
    });
  }
})();
