/* Brand preloader: monogram draws itself, then the curtain lifts. First visit per session, home page only.
   Failsafe timers guarantee the page is never left covered. */
(function () {
  "use strict";
  var WB = window.WB;
  var root = document.documentElement;
  var pre = document.querySelector(".preloader");
  if (pre && !root.classList.contains("wb-preload")) { pre.parentNode.removeChild(pre); return; } // not needed on this view
  if (!WB || !pre) return;

  var ms = parseInt(root.getAttribute("data-preload-ms"), 10);
  if (!ms || ms < 1200 || ms > 6000) ms = 2700;   // how long the splash is held before the curtain lifts
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    pre.classList.add("is-done");
    setTimeout(WB.markReady, 380);            // hero starts animating as the curtain rises
    setTimeout(function () {
      root.classList.remove("wb-preload");
      pre.parentNode && pre.parentNode.removeChild(pre);
    }, 1400);
  }

  var minTime = new Promise(function (r) { setTimeout(r, ms); });
  var loaded = new Promise(function (r) {
    if (document.readyState === "complete") r(); else window.addEventListener("load", r);
  });
  var fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
  Promise.all([minTime, loaded, fonts]).then(finish, finish);
  setTimeout(finish, ms + 2100);              // hard failsafe
})();
