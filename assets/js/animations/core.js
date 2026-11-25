/* Wedding Berries animation core: shared helpers, motion preferences and the "ready" signal.
   Dependency-free. Everything is progressive enhancement: with JS off, or reduced motion on, all content stays visible. */
(function () {
  "use strict";
  var root = document.documentElement;
  var WB = (window.WB = window.WB || {});

  WB.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  WB.fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  WB.small = window.matchMedia("(max-width: 720px)").matches;

  WB.qsa = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  WB.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  WB.lerp = function (a, b, t) { return a + (b - a) * t; };

  var queue = [];
  WB.isReady = false;
  WB.whenReady = function (fn) { if (WB.isReady) fn(); else queue.push(fn); };
  WB.markReady = function () {
    if (WB.isReady) return;
    WB.isReady = true;
    queue.splice(0).forEach(function (fn) { try { fn(); } catch (e) { /* keep going */ } });
  };

  // No preloader on this page view: ready immediately.
  if (!root.classList.contains("wb-preload")) WB.markReady();
  WB.engineOn = true; // tells the head failsafe that scripts loaded
})();
