/* Falling rose petals on canvas. Add data-petals to any positioned container.
   Pauses when off-screen or tab hidden; skipped entirely for reduced motion. */
(function () {
  "use strict";
  var WB = window.WB;
  if (!WB || WB.reduce || WB.off("petals")) return;

  var COLORS = ["#E9B9BF", "#D98C98", "#B76E79", "#F3D3D3", "#C9A27A", "#F6E3DC"];

  function Petal(w, h, spread) {
    this.reset(w, h, spread);
  }
  Petal.prototype.reset = function (w, h, spread) {
    this.z = 0.4 + Math.random() * 0.9;                    // depth: bigger = closer
    this.size = (10 + Math.random() * 15) * this.z * (window.WB && window.WB.small ? 0.65 : 1);
    this.x = Math.random() * w;
    this.y = spread ? Math.random() * h : -20 - Math.random() * h * 0.3;
    this.vy = (0.35 + Math.random() * 0.8) * this.z;
    this.sway = 14 + Math.random() * 38;
    this.swaySpeed = 0.4 + Math.random() * 0.9;
    this.phase = Math.random() * Math.PI * 2;
    this.rot = Math.random() * Math.PI * 2;
    this.rotV = (Math.random() - 0.5) * 0.03;
    this.flip = Math.random() * Math.PI * 2;
    this.flipV = 0.02 + Math.random() * 0.05;
    this.alpha = 0.5 + Math.random() * 0.45;
    this.color = COLORS[(Math.random() * COLORS.length) | 0];
  };

  function Field(host) {
    this.host = host;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "petals-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(this.canvas, host.firstChild);
    this.ctx = this.canvas.getContext("2d");
    this.petals = [];
    this.running = false;
    this.visible = true;
    this.mx = 0; this.my = 0; this.tx = 0; this.ty = 0;
    this.t = 0;
    this.resize();
    var self = this;
    this.loop = function (now) { self.frame(now); };
    if ("ResizeObserver" in window) new ResizeObserver(function () { self.resize(); }).observe(host);
    else window.addEventListener("resize", function () { self.resize(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { self.visible = en[0].isIntersecting; self.toggle(); }).observe(host);
    }
    document.addEventListener("visibilitychange", function () { self.toggle(); });
    if (WB.fine) {
      host.addEventListener("pointermove", function (e) {
        var r = host.getBoundingClientRect();
        self.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        self.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      });
    }
    this.toggle();
  }
  Field.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.round(WB.clamp((w * h) / 42000, 12, 44));
    if (WB.small) count = Math.min(count, 16);
    while (this.petals.length < count) this.petals.push(new Petal(w, h, true));
    this.petals.length = count;
  };
  Field.prototype.toggle = function () {
    var should = this.visible && !document.hidden;
    if (should && !this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this.loop); }
    else if (!should) this.running = false;
  };
  Field.prototype.draw = function (p) {
    var ctx = this.ctx;
    var s = p.size;
    ctx.save();
    ctx.translate(p.px, p.py);
    ctx.rotate(p.rot);
    ctx.scale(Math.cos(p.flip) * 0.85 + 0.15 * Math.sign(Math.cos(p.flip) || 1), 1);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s * 0.55, s * 0.8, s * 0.6, 0, s);
    ctx.bezierCurveTo(-s * 0.8, s * 0.6, -s * 0.9, -s * 0.55, 0, -s);
    ctx.fill();
    ctx.restore();
  };
  Field.prototype.frame = function (now) {
    if (!this.running) return;
    var dt = Math.min((now - this.last) / 16.67, 3);
    this.last = now;
    this.t += dt * 0.016;
    this.mx += (this.tx - this.mx) * 0.04;
    this.my += (this.ty - this.my) * 0.04;
    this.ctx.clearRect(0, 0, this.w, this.h);
    for (var i = 0; i < this.petals.length; i++) {
      var p = this.petals[i];
      p.y += p.vy * dt;
      p.rot += p.rotV * dt;
      p.flip += p.flipV * dt;
      p.px = p.x + Math.sin(this.t * p.swaySpeed * 6 + p.phase) * p.sway - this.mx * 24 * p.z;
      p.py = p.y - this.my * 14 * p.z;
      if (p.y > this.h + 30) p.reset(this.w, this.h, false);
      this.draw(p);
    }
    requestAnimationFrame(this.loop);
  };

  WB.qsa("[data-petals]").forEach(function (host) { new Field(host); });
})();
