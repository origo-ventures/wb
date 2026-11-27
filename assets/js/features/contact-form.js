/* Contact form behaviour: validation, spam traps and delivery.
   Delivery methods (set in the Control Panel): "script" = Google Apps Script (sheet + email), "whatsapp", "email".
   For "script" the form is posted into a hidden iframe (no CORS problem) and the script answers with a postMessage. */
(function () {
  "use strict";
  var form = document.querySelector("[data-wbform]");
  if (!form) return;
  var statusEl = form.querySelector(".wbform__status");
  var btn = form.querySelector("button[type=submit]");
  var btnText = btn.textContent;
  var done = document.querySelector(".wbform__done");
  var again = document.querySelector("[data-wbform-again]");
  var method = form.getAttribute("data-method");
  var scriptUrl = form.getAttribute("data-script");
  var wa = form.getAttribute("data-wa");
  var mail = form.getAttribute("data-mail");
  var started = Date.now(), busy = false;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function controls() {
    return Array.prototype.slice.call(form.elements).filter(function (c) { return c.name && c.name !== "website" && c.type !== "submit" && c.type !== "button"; });
  }
  function setErr(c, msg) {
    var box = document.getElementById(c.id + "-err");
    if (box) box.textContent = msg || "";
    c.setAttribute("aria-invalid", msg ? "true" : "false");
    var wrap = c.closest(".wbfield"); if (wrap) wrap.classList.toggle("has-error", !!msg);
  }
  function validate() {
    var first = null;
    controls().forEach(function (c) {
      var isBox = c.type === "checkbox", v = isBox ? c.checked : c.value.trim(), msg = "";
      if (c.required && (isBox ? !c.checked : !v)) msg = isBox ? "Please tick this box to continue." : "This field is required.";
      else if (v && c.type === "email" && !EMAIL.test(v)) msg = "Please enter a valid email address.";
      else if (v && c.type === "tel" && (!/^[0-9+()\s.-]+$/.test(v) || v.replace(/\D/g, "").length < 6)) msg = "Please enter a valid phone number.";
      setErr(c, msg);
      if (msg && !first) first = c;
    });
    return first;
  }
  controls().forEach(function (c) {
    c.addEventListener(c.type === "checkbox" || c.tagName === "SELECT" ? "change" : "input", function () { if (c.getAttribute("aria-invalid") === "true") setErr(c, ""); });
  });

  function pairs() {
    var out = [];
    controls().forEach(function (c) {
      if (c.type === "checkbox") { if (c.checked) out.push([c.name, c.value]); return; }
      var v = c.value.trim(); if (v) out.push([c.name, v]);
    });
    return out;
  }
  function asText(p) { return p.map(function (x) { return x[0] + ": " + x[1]; }).join("\n"); }
  function show(msg, kind) {
    statusEl.textContent = ""; statusEl.className = "wbform__status" + (kind ? " is-" + kind : "");
    if (msg) statusEl.appendChild(document.createTextNode(msg));
  }
  function setBusy(b) { busy = b; btn.disabled = b; btn.textContent = b ? form.getAttribute("data-sending") : btnText; form.setAttribute("aria-busy", b ? "true" : "false"); }
  function fail(msg, offerWhatsapp) {
    setBusy(false); show(msg, "error");
    if (offerWhatsapp && form.getAttribute("data-fallback") === "1" && wa) {
      var a = document.createElement("a");
      a.href = "https://wa.me/" + wa + "?text=" + encodeURIComponent(asText(pairs()));
      a.target = "_blank"; a.rel = "noopener"; a.textContent = "Message us on WhatsApp instead";
      statusEl.appendChild(document.createTextNode(" ")); statusEl.appendChild(a);
    }
  }
  function finish(note) {
    setBusy(false); show("");
    if (note) { done.querySelector("h3").textContent = note[0]; done.querySelector("p").textContent = note[1]; }
    form.hidden = true; done.hidden = false; done.focus();
    form.reset(); controls().forEach(function (c) { setErr(c, ""); });
    if (typeof window.gtag === "function") { try { window.gtag("event", "generate_lead", { method: method }); } catch (e) { /* ignore */ } }
  }

  function sendScript(data) {
    if (!scriptUrl) { fail("The enquiry form is not connected yet. Please contact us directly.", true); return; }
    var id = "wb" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    var frame = document.createElement("iframe"); frame.name = "wbframe_" + id; frame.title = "Form response"; frame.setAttribute("aria-hidden", "true"); frame.tabIndex = -1; frame.style.display = "none";
    var f = document.createElement("form"); f.method = "POST"; f.action = scriptUrl; f.target = frame.name; f.acceptCharset = "UTF-8"; f.style.display = "none";
    data.concat([["_id", id], ["_page", location.href], ["_ms", String(Date.now() - started)]]).forEach(function (x) {
      var i = document.createElement("input"); i.type = "hidden"; i.name = x[0]; i.value = x[1]; f.appendChild(i);
    });
    var timer;
    function cleanup() { clearTimeout(timer); window.removeEventListener("message", onMsg); setTimeout(function () { frame.remove(); f.remove(); }, 500); }
    function onMsg(e) {
      var host = ""; try { host = new URL(e.origin).hostname; } catch (x) { return; }
      if (!/(^|\.)(google\.com|googleusercontent\.com)$/.test(host)) return;
      var d = e.data; if (!d || typeof d !== "object" || d.id !== id) return;
      cleanup();
      if (d.wb === "ok") finish(); else fail(typeof d.msg === "string" && d.msg ? d.msg : form.getAttribute("data-error"), d.msg ? false : true);
    }
    window.addEventListener("message", onMsg);
    timer = setTimeout(function () { cleanup(); fail(form.getAttribute("data-error"), true); }, 25000);
    document.body.appendChild(frame); document.body.appendChild(f);
    f.submit();
  }
  function sendWhatsapp(data) {
    if (!wa) { fail("A WhatsApp number has not been set up for this form yet."); return; }
    var url = "https://wa.me/" + wa + "?text=" + encodeURIComponent("New enquiry\n" + asText(data));
    var w = window.open(url, "_blank");          // (not "noopener": that makes window.open always return null)
    if (w) { try { w.opener = null; } catch (x) { /* ignore */ } } else { location.href = url; }   // popup blocked: open in this tab
    finish(["One more step", "WhatsApp has opened with your message. Please press Send there to complete your enquiry."]);
  }
  function sendEmail(data) {
    if (!mail) { fail("An email address has not been set up for this form yet."); return; }
    location.href = "mailto:" + mail + "?subject=" + encodeURIComponent("Website enquiry") + "&body=" + encodeURIComponent(asText(data));
    finish(["One more step", "Your email app has opened with your message. Please press Send there to complete your enquiry."]);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    show("");
    var bad = validate();
    if (bad) { show("Please check the highlighted fields.", "error"); bad.focus(); return; }
    var trap = form.querySelector("input[name=website]");
    if (trap && trap.value) { finish(); return; }                                  // bot: pretend it worked
    if (Date.now() - started < 1500) { show("Please check your details and press the button once more.", "error"); return; }
    var data = pairs();
    setBusy(true);
    if (method === "whatsapp") sendWhatsapp(data);
    else if (method === "email") sendEmail(data);
    else sendScript(data);
  });
  if (again) again.addEventListener("click", function () { done.hidden = true; form.hidden = false; started = Date.now() - 2000; show(""); var f1 = controls()[0]; if (f1) f1.focus(); });
})();
