/* "Your wedding countdown": visitor picks a date, sees a live countdown.
   The chosen date is remembered in this browser only (try/catch: storage can be unavailable). */
(function () {
  "use strict";
  var host = document.querySelector("[data-countdown]");
  if (!host) return;
  var input = host.querySelector("input[type=date]");
  var sentence = host.querySelector(".countdown__sentence");
  var grid = host.querySelector(".countdown__grid");
  var cells = { d: grid.querySelector("[data-cd=d]"), h: grid.querySelector("[data-cd=h]"), m: grid.querySelector("[data-cd=m]"), s: grid.querySelector("[data-cd=s]") };
  var KEY = "wb_wedding_date";
  var target = null, timer = null;

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  input.min = iso(new Date());

  function parse(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  function render() {
    var diff = target - new Date();
    if (diff <= 0) { stop(); return; }
    var s = Math.floor(diff / 1000);
    cells.d.textContent = Math.floor(s / 86400);
    cells.h.textContent = pad(Math.floor((s % 86400) / 3600));
    cells.m.textContent = pad(Math.floor((s % 3600) / 60));
    cells.s.textContent = pad(s % 60);
  }
  function stop() { clearInterval(timer); timer = null; grid.classList.remove("is-on"); }
  function set(d, save) {
    stop();
    target = d;
    if (!d) { sentence.textContent = "Pick your date to see the countdown begin."; return; }
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((d - today) / 86400000);
    if (days < 0) { sentence.textContent = "That date has already passed. Choose a future date."; return; }
    if (days === 0) { sentence.textContent = "Today is the day. Congratulations!"; return; }
    sentence.textContent = days === 1 ? "Just one more day to go." : days + " days to go. Let\u2019s make every one of them count.";
    grid.classList.add("is-on");
    render();
    timer = setInterval(render, 1000);
    if (save) { try { localStorage.setItem(KEY, input.value); } catch (e) { /* ignore */ } }
  }
  input.addEventListener("change", function () { set(parse(input.value), true); });
  try {
    var saved = localStorage.getItem(KEY);
    var d = parse(saved);
    if (d && d >= new Date(new Date().setHours(0, 0, 0, 0))) { input.value = saved; set(d, false); return; }
  } catch (e) { /* ignore */ }
  set(null, false);
})();
