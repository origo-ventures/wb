/* Wedding Berries Control Panel.
   Edits content/*.json in the GitHub repository (one commit per save); GitHub Actions then rebuilds and publishes the site.
   No inline scripts, no innerHTML with data: the page runs under a strict Content-Security-Policy because it handles an access token. */
(function () {
  'use strict';
  var API = 'https://api.github.com';
  var CFG_KEY = 'wb_control_cfg';
  var SCHEMA = window.WB_SCHEMA, SECTIONS = SCHEMA.SECTIONS;
  var app = document.getElementById('app');

  /* ------------------------------------------------------------ helpers */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false && k !== 'value') return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c === null || c === undefined) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function slugify(s) { s = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); return (s || 'item').slice(0, 40); }
  function stamp() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function b64dec(b64) { var bin = atob(String(b64).replace(/\s/g, '')), bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  function splitParas(s) { return String(s || '').replace(/\r/g, '').split(/\n\s*\n/).map(function (p) { return p.replace(/\s*\n\s*/g, ' ').trim(); }).filter(Boolean); }
  var IMG_RE = /^assets\/images\/[A-Za-z0-9_\/.-]+\.(jpg|jpeg|png|webp|svg)$/;
  function isImgPath(p) { return typeof p === 'string' && IMG_RE.test(p) && p.indexOf('..') < 0; }
  var FONT_RE = /^assets\/fonts\/[A-Za-z0-9_\/.-]+\.(woff2|woff|ttf|otf)$/;
  function isFontPath(p) { return typeof p === 'string' && FONT_RE.test(p) && p.indexOf('..') < 0; }
  function isAssetPath(p) { return isImgPath(p) || isFontPath(p); }
  function gather(v, out) { if (Array.isArray(v)) v.forEach(function (x) { gather(x, out); }); else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { gather(v[k], out); }); else if (isAssetPath(v)) out[v] = true; return out; }
  function isPlaceholder(s) { s = String(s || '').trim(); return s.charAt(0) === '[' && s.charAt(s.length - 1) === ']'; }
  function countPlaceholders(v) { if (Array.isArray(v)) return v.reduce(function (n, x) { return n + countPlaceholders(x); }, 0); if (v && typeof v === 'object') return Object.keys(v).reduce(function (n, k) { return n + countPlaceholders(v[k]); }, 0); return typeof v === 'string' && isPlaceholder(v) ? 1 : 0; }
  function hexRGB(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function lum(h) { var c = hexRGB(h).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function contrast(a, b) { var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

  /* ------------------------------------------------------------ state */
  var CFG = null;
  var S = { files: {}, pending: {}, preview: {}, dirty: {}, section: 'dash', busy: false };
  var blobCache = {}, buildWatch = 0, main;

  /* ------------------------------------------------------------ GitHub API */
  function repoBase() { return API + '/repos/' + encodeURIComponent(CFG.owner) + '/' + encodeURIComponent(CFG.repo); }
  function refPath() { return CFG.branch.split('/').map(encodeURIComponent).join('/'); }
  function headers(extra) { var h = { 'Authorization': 'Bearer ' + CFG.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; }); return h; }
  function friendly(status, j, what) {
    var m = (j && j.message) ? j.message : '';
    if (status === 401) return 'GitHub says the token is wrong or expired. Log out and enter a new token.';
    if (status === 403) return 'GitHub refused (' + (m || 'forbidden') + '). Check that the token has "Contents: Read and write" for this repository, or wait a minute if you hit a rate limit.';
    if (status === 404) return 'Not found: ' + what + '. Check the owner, repository and branch names, and that the token can access this repository.';
    if (status === 409 || status === 422) return 'The site changed on GitHub since you opened this panel (' + (m || 'conflict') + '). Press "Reload from GitHub", then make your change again.';
    return 'GitHub error ' + status + (m ? ': ' + m : '') + ' (' + what + ')';
  }
  async function gh(method, path, body) {
    var url = repoBase() + '/' + path;
    if (method === 'GET') url += (path.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now();
    var r;
    try { r = await fetch(url, { method: method, headers: headers(body ? { 'Content-Type': 'application/json' } : null), body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
    catch (e) { throw new Error('Cannot reach GitHub. Check your internet connection.'); }
    var j = {}; try { j = await r.json(); } catch (e2) { j = {}; }
    if (!r.ok) { var err = new Error(friendly(r.status, j, path.split('?')[0])); err.status = r.status; throw err; }
    return j;
  }
  function contentsPath(path) { return 'contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(CFG.branch); }
  function repoImage(path) {
    if (S.preview[path]) return Promise.resolve(S.preview[path]);
    if (blobCache[path]) return blobCache[path];
    var pr = fetch(repoBase() + '/' + contentsPath(path), { headers: headers({ 'Accept': 'application/vnd.github.raw+json' }), cache: 'no-store' })
      .then(function (r) { if (!r.ok) { var e = new Error('missing'); e.status = r.status; throw e; } return r.blob(); })
      .then(function (b) { return URL.createObjectURL(/\.svg$/i.test(path) ? new Blob([b], { type: 'image/svg+xml' }) : b); });
    blobCache[path] = pr; pr.catch(function () { delete blobCache[path]; });
    return pr;
  }
  var bufCache = {};
  function repoBuffer(path) {
    if (bufCache[path]) return bufCache[path];
    var pr = fetch(repoBase() + '/' + contentsPath(path), { headers: headers({ 'Accept': 'application/vnd.github.raw+json' }), cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); });
    bufCache[path] = pr; pr.catch(function () { delete bufCache[path]; });
    return pr;
  }
  async function loadFile(name) {
    var path = 'content/' + name;
    if (S.files[path]) return S.files[path];
    var j, text;
    try { j = await gh('GET', contentsPath(path)); }
    catch (err) {
      if (err.status === 404 && SCHEMA.DEFAULTS && SCHEMA.DEFAULTS[name]) { var nf = { path: path, name: name, sha: null, isNew: true, data: clone(SCHEMA.DEFAULTS[name]), origImgs: {} }; S.files[path] = nf; return nf; }
      throw err;
    }
    if (j.content) text = b64dec(j.content);
    else { var r = await fetch(repoBase() + '/' + contentsPath(path), { headers: headers({ 'Accept': 'application/vnd.github.raw+json' }), cache: 'no-store' }); text = await r.text(); }
    var data;
    try { data = JSON.parse(text); } catch (e) { throw new Error(name + ' has a syntax error and cannot be edited here: ' + e.message); }
    var f = { path: path, name: name, sha: j.sha, data: data, origImgs: gather(data, {}) };
    S.files[path] = f;
    return f;
  }
  async function loadAll() { var out = []; for (var i = 0; i < SCHEMA.FILES.length; i++) out.push(await loadFile(SCHEMA.FILES[i])); return out; }

  /* ------------------------------------------------------------ images */
  function svgSafe(text) {
    if (!/<svg[\s>]/i.test(text)) return 'That file is not a valid SVG.';
    if (/<script|<foreignObject|<iframe|<embed|<object|<!ENTITY|javascript:|\bon[a-z]+\s*=|@import|url\(\s*["']?https?:|href\s*=\s*["']?https?:/i.test(text)) return 'This SVG contains scripts or external links, so it was not accepted. Export a plain SVG, or use a PNG.';
    return '';
  }
  function bufToB64(buf) { var bytes = new Uint8Array(buf), bin = '', CH = 0x8000; for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(bin); }
  function processImage(file, opts) {
    opts = opts || {};
    return new Promise(function (res, rej) {
      if (file.size > 25 * 1024 * 1024) { rej(new Error('Photo is larger than 25 MB.')); return; }
      if (opts.svg && (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name))) {
        if (file.size > 300 * 1024) { rej(new Error('SVG logo is larger than 300 KB. Please simplify it or use a PNG.')); return; }
        var fr = new FileReader();
        fr.onload = function () {
          var bad = svgSafe(String(fr.result)); if (bad) { rej(new Error(bad)); return; }
          var b64 = btoa(unescape(encodeURIComponent(String(fr.result))));
          res({ b64: b64, dataUrl: 'data:image/svg+xml;base64,' + b64, ext: 'svg' });
        };
        fr.onerror = function () { rej(new Error('Could not read that file.')); };
        fr.readAsText(file); return;
      }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas'), cx = c.getContext('2d');
        var png = file.type === 'image/png' || (!!opts.alpha && file.type === 'image/webp') || !!opts.icon;
        if (opts.icon) {
          var side = Math.min(w, h), size = Math.min(opts.icon, side);
          c.width = size; c.height = size; cx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
        } else {
          var max = opts.max || 1800, nw = w > max ? max : w, nh = Math.round(h * nw / w);
          c.width = nw; c.height = nh;
          if (!png) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, nw, nh); }
          cx.drawImage(img, 0, 0, nw, nh);
        }
        var d = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85);
        URL.revokeObjectURL(url);
        res({ b64: d.split(',')[1], dataUrl: d, ext: png ? 'png' : 'jpg' });
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('That file is not a readable image (use JPG, PNG or WebP).')); };
      img.src = url;
    });
  }
  async function addUpload(file, dir, base, opts) {
    var r = await processImage(file, opts);
    var np = 'assets/images/uploads/' + (dir || 'misc') + '/' + slugify(base) + '__p' + stamp() + '.' + r.ext;
    S.pending[np] = r.b64; S.preview[np] = r.dataUrl;
    return np;
  }
  /* custom fonts: the raw file is stored as is, after a header check */
  async function addFontUpload(file) {
    if (file.size > 4 * 1024 * 1024) throw new Error('Font file is larger than 4 MB.');
    var buf = await file.arrayBuffer(), h = new Uint8Array(buf.slice(0, 4)), tag = String.fromCharCode.apply(null, h), ext = '';
    if (tag === 'wOF2') ext = 'woff2'; else if (tag === 'wOFF') ext = 'woff'; else if (tag === 'OTTO') ext = 'otf';
    else if ((h[0] === 0 && h[1] === 1 && h[2] === 0 && h[3] === 0) || tag === 'true') ext = 'ttf';
    if (!ext) throw new Error('That does not look like a font file. Use WOFF2, WOFF, TTF or OTF.');
    var np = 'assets/fonts/uploads/' + slugify(file.name.replace(/\.[^.]+$/, '')) + '__p' + stamp() + '.' + ext;
    var b64 = bufToB64(buf); S.pending[np] = b64; bufCache[np] = Promise.resolve(buf);
    return np;
  }
  function showImg(path, imgEl, msgEl, token, seq, missingText) {
    repoImage(path).then(function (url) { if (token !== seq()) return; imgEl.src = url; imgEl.hidden = false; if (msgEl) msgEl.hidden = true; })
      .catch(function () { if (token !== seq()) return; imgEl.hidden = true; if (msgEl) { msgEl.hidden = false; msgEl.textContent = missingText || 'Photo not found'; } });
  }

  /* ------------------------------------------------------------ dirty / save bar */
  function touch(path) { S.dirty['content/' + path] = true; refreshBar(); }
  function dirtyCount() { return Object.keys(S.dirty).filter(function (k) { return S.dirty[k]; }).length; }
  function refreshBar() {
    var st = document.getElementById('st'), b = document.getElementById('savebtn');
    if (!st || !b) return;
    var n = dirtyCount();
    st.textContent = n ? 'Unsaved changes' : 'No unsaved changes';
    st.className = 'st' + (n ? ' dirty' : '');
    b.disabled = !n || S.busy;
    var db = document.getElementById('discardbtn'); if (db) { var sec0 = secById(S.section); db.disabled = !(sec0 && S.dirty['content/' + sec0.file]); }
  }
  window.addEventListener('beforeunload', function (e) { if (dirtyCount()) { e.preventDefault(); e.returnValue = ''; } });
  function secById(id) { return SECTIONS.filter(function (s) { return s.id === id; })[0]; }
  function note(kind, text, noScroll) { var m = document.getElementById('flash'); if (!m) return; m.textContent = ''; if (text) m.appendChild(typeof text === 'string' ? el('div', { class: 'msg ' + kind, text: text }) : el('div', { class: 'msg ' + kind }, [text])); if (text && !noScroll) window.scrollTo({ top: 0, behavior: 'smooth' }); }

  /* ------------------------------------------------------------ fonts */
  var FONTS = window.WB_FONTS || [];
  var FB = { serif: 'Georgia, serif', sans: 'system-ui, sans-serif', script: 'cursive', display: 'Georgia, serif', bangla: 'system-ui, sans-serif' };
  var CATS = [['all', 'All fonts'], ['serif', 'Serif (elegant)'], ['sans', 'Sans-serif (clean)'], ['script', 'Script (handwriting)'], ['display', 'Display (decorative)'], ['bangla', 'Bangla']];
  function fontByName(n) { for (var i = 0; i < FONTS.length; i++) if (FONTS[i].n === n) return FONTS[i]; return null; }
  function googleSpec(f) {
    var name = f.n.replace(/ /g, '+'), ws = f.w.split(';');
    if (ws.length === 1 && ws[0] === '400') return 'family=' + name + (f.i ? ':ital@0;1' : '');
    if (f.i && ws.indexOf('400') > -1) return 'family=' + name + ':ital,wght@' + ws.map(function (w) { return '0,' + w; }).concat(['1,400']).join(';');
    return 'family=' + name + ':wght@' + ws.join(';');
  }
  var gLoaded = {}, cLoaded = {}, cCount = 0;
  function ensureGoogle(f) { if (gLoaded[f.n]) return; gLoaded[f.n] = 1; document.head.appendChild(el('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?' + googleSpec(f) + '&display=swap' })); }
  function previewCustom(box, path) {
    if (cLoaded[path]) { box.style.fontFamily = '"' + cLoaded[path] + '"'; return Promise.resolve(); }
    return repoBuffer(path).then(function (buf) {
      var fam = 'wbprev' + (++cCount), ff = new FontFace(fam, buf.slice(0));
      return ff.load().then(function (f) { document.fonts.add(f); cLoaded[path] = fam; box.style.fontFamily = '"' + fam + '"'; });
    });
  }
  function migrateFonts(d) {
    if (typeof d.fonts !== 'string') return;
    var m = { classic: ['Cormorant Garamond', 'Jost'], romantic: ['Playfair Display', 'Lato'], modern: ['DM Serif Display', 'Inter'] }[d.fonts] || ['Cormorant Garamond', 'Jost'];
    d.fonts = { display: { source: 'google', google: m[0], custom: '', customKind: 'serif' }, body: { source: 'google', google: m[1], custom: '', customKind: 'sans' }, scale: 'normal' };
  }

  /* ------------------------------------------------------------ form fields */
  function label(fd) { return el('span', { class: 'l', text: fd.label }); }
  function hint(fd) { return fd.hint ? el('small', { text: fd.hint }) : null; }
  var FULL = { textarea: 1, paras: 1, tags: 1, group: 1, list: 1, image: 1, images: 1, sep: 1, contrast: 1, fontpick: 1, fontpairs: 1 };

  function field(fd, obj, ctx) {
    var k = fd.key, t = fd.type, w = el('div', { class: 'fld' + (FULL[t] ? ' full' : '') }), inp;
    function set(v) { obj[k] = v; touch(ctx.file); if (ctx.onInput) ctx.onInput(); }
    if (t === 'sep') { return el('h3', { class: 'sep3 full', text: fd.label }); }
    if (t === 'text' || t === 'link') {
      inp = el('input', { type: 'text', value: obj[k] == null ? '' : obj[k], placeholder: fd.ph || '', autocomplete: 'off' });
      inp.addEventListener('input', function () { set(inp.value); });
      w.appendChild(label(fd)); w.appendChild(inp); if (hint(fd)) w.appendChild(hint(fd));
    } else if (t === 'date') {
      inp = el('input', { type: 'date', value: obj[k] || '' }); inp.addEventListener('input', function () { set(inp.value); });
      w.appendChild(label(fd)); w.appendChild(inp);
    } else if (t === 'textarea') {
      inp = el('textarea', { rows: fd.rows || 4, placeholder: fd.ph || '' }); inp.value = obj[k] == null ? '' : obj[k];
      inp.addEventListener('input', function () { set(inp.value); });
      w.appendChild(label(fd)); w.appendChild(inp); if (hint(fd)) w.appendChild(hint(fd));
    } else if (t === 'paras') {
      inp = el('textarea', { rows: fd.rows || 6 }); inp.value = Array.isArray(obj[k]) ? obj[k].join('\n\n') : (obj[k] || '');
      inp.addEventListener('input', function () { set(splitParas(inp.value)); });
      w.appendChild(label(fd)); w.appendChild(inp);
    } else if (t === 'tags') {
      inp = el('input', { type: 'text', value: Array.isArray(obj[k]) ? obj[k].join(', ') : (obj[k] || '') });
      inp.addEventListener('input', function () { set(inp.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean)); });
      w.appendChild(label(fd)); w.appendChild(inp);
    } else if (t === 'select') {
      inp = el('select', {}, Object.keys(fd.options).map(function (ov) { return el('option', { value: ov, text: fd.options[ov] }); }));
      inp.value = obj[k] && fd.options[obj[k]] ? obj[k] : (fd.def && fd.options[fd.def] ? fd.def : Object.keys(fd.options)[0]);
      inp.addEventListener('change', function () { set(inp.value); });
      w.appendChild(label(fd)); w.appendChild(inp);
    } else if (t === 'bool') {
      var val = obj[k] === undefined ? !!fd.def : !!obj[k];
      inp = el('input', { type: 'checkbox', checked: val }); inp.addEventListener('change', function () { set(inp.checked); });
      w.appendChild(el('label', { class: 'chk' }, [inp, fd.label]));
    } else if (t === 'color') {
      var cur = /^#[0-9a-fA-F]{6}$/.test(obj[k] || '') ? obj[k] : '#000000';
      var pick = el('input', { type: 'color', value: cur, 'aria-label': fd.label }), hex = el('input', { type: 'text', value: cur, maxlength: 7, autocomplete: 'off' });
      pick.addEventListener('input', function () { hex.value = pick.value.toUpperCase(); set(hex.value); });
      hex.addEventListener('input', function () { if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) { pick.value = hex.value; set(hex.value.toUpperCase()); } });
      w.appendChild(label(fd)); w.appendChild(el('div', { class: 'colorrow' }, [pick, hex]));
    } else if (t === 'contrast') {
      var box = el('div', { class: 'contrast' }); w.appendChild(box);
      var paint = function () {
        var c = (ctx.root && ctx.root.colors) || {}; if (!c.berry || !c.ivory) return;
        var r = contrast(c.berry, c.ivory), ok = r >= 4.5;
        box.className = 'contrast ' + (ok ? 'good' : 'bad');
        box.textContent = 'Brand colour on page background: ' + r.toFixed(1) + ':1. ' + (ok ? 'Readable.' : 'Too low for comfortable reading (aim for 4.5 or higher).');
      };
      (ctx.painters = ctx.painters || []).push(paint); paint();
    } else if (t === 'fontpairs') {
      var PAIRS = [['Classic', 'Cormorant Garamond', 'Jost', 'normal'], ['Romantic', 'Playfair Display', 'Lato', 'normal'], ['Modern', 'DM Serif Display', 'Inter', 'normal'], ['Bridal script', 'Great Vibes', 'Jost', 'large'], ['Bangla friendly', 'Noto Serif Bengali', 'Noto Sans Bengali', 'normal']];
      var prow = el('div', { class: 'pairrow' });
      PAIRS.forEach(function (pr) {
        prow.appendChild(el('button', { type: 'button', class: 'tb', text: pr[0], onclick: function () {
          ctx.root.fonts = { display: { source: 'google', google: pr[1], custom: '', customKind: 'serif' }, body: { source: 'google', google: pr[2], custom: '', customKind: 'sans' }, scale: pr[3] };
          touch(ctx.file); renderSection(S.section, true);
        } }));
      });
      w.appendChild(el('span', { class: 'l', text: 'Quick font pairs (you can still change each font below)' })); w.appendChild(prow);
    } else if (t === 'fontpick') {
      if (!obj[k] || typeof obj[k] !== 'object') obj[k] = { source: 'google', google: fd.role === 'display' ? 'Cormorant Garamond' : 'Jost', custom: '', customKind: fd.role === 'display' ? 'serif' : 'sans' };
      var cfg = obj[k], fbox = el('div', { class: 'fontpick' }), cat = null;
      var fset = function () { obj[k] = cfg; touch(ctx.file); if (ctx.onInput) ctx.onInput(); };
      var drawF = function () {
        fbox.textContent = '';
        var isCustom = cfg.source === 'custom';
        var prev = el('div', { class: 'fontprev' }, [el('div', { class: 'fp1' + (fd.role === 'display' ? ' big' : ''), text: fd.role === 'display' ? 'Every love story deserves a beautiful beginning' : 'We plan every detail so you can enjoy every moment of your day. 0123456789' }), el('div', { class: 'fp2', text: 'ABC abc  \u0986\u09AE\u09BE\u09B0 \u09B8\u09CB\u09A8\u09BE\u09B0 \u09AC\u09BE\u0982\u09B2\u09BE' })]);
        var src = el('select', { 'aria-label': fd.label + ': source' }, [el('option', { value: 'google', text: 'Choose from Google Fonts' }), el('option', { value: 'custom', text: 'Upload my own font file' })]);
        src.value = isCustom ? 'custom' : 'google';
        src.addEventListener('change', function () { cfg.source = src.value; fset(); drawF(); });
        fbox.appendChild(el('div', { class: 'fld' }, [el('span', { class: 'l', text: 'Where does the font come from?' }), src]));
        if (!isCustom) {
          var cur = fontByName(cfg.google) || fontByName(fd.role === 'display' ? 'Cormorant Garamond' : 'Jost');
          if (cat === null) cat = cur ? cur.c : 'all';
          var csel = el('select', { 'aria-label': 'Font category' }, CATS.map(function (c) { return el('option', { value: c[0], text: c[1] }); })); csel.value = cat;
          var list = FONTS.filter(function (f) { return cat === 'all' || f.c === cat || (cur && f.n === cur.n); });
          var fsel = el('select', { 'aria-label': 'Font' }, list.map(function (f) { return el('option', { value: f.n, text: f.n }); })); fsel.value = cur ? cur.n : '';
          csel.addEventListener('change', function () { cat = csel.value; drawF(); });
          fsel.addEventListener('change', function () { cfg.google = fsel.value; fset(); drawF(); });
          fbox.appendChild(el('div', { class: 'row2' }, [el('div', { class: 'fld' }, [el('span', { class: 'l', text: 'Style of font' }), csel]), el('div', { class: 'fld' }, [el('span', { class: 'l', text: 'Font (' + list.length + ')' }), fsel])]));
          if (cur) { ensureGoogle(cur); prev.style.fontFamily = '"' + cur.n + '", ' + FB[cur.c]; }
          if (fd.role === 'body' && cur && (cur.c === 'script' || cur.c === 'display')) fbox.appendChild(el('small', { class: 'warnnote', text: 'Script and decorative fonts are hard to read in paragraphs. They look best as the display font.' }));
          fbox.appendChild(prev);
        } else {
          var ff = el('input', { type: 'file', accept: '.woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf' });
          ff.addEventListener('change', async function () {
            var f0 = ff.files && ff.files[0]; if (!f0) return;
            try { cfg.custom = await addFontUpload(f0); cfg.source = 'custom'; fset(); drawF(); } catch (e) { alert(e.message); }
            ff.value = '';
          });
          fbox.appendChild(el('div', { class: 'fld' }, [el('span', { class: 'l', text: 'Font file (WOFF2 is best; WOFF, TTF and OTF also work, max 4 MB)' }), ff,
            el('small', { class: 'pvcap', text: cfg.custom ? (S.pending[cfg.custom] ? 'New font, not saved yet \u00b7 ' : 'Current font file \u00b7 ') + cfg.custom.split('/').pop() : 'No font uploaded yet. Until you upload one, the site uses a standard backup font.' })]));
          var ksel = el('select', { 'aria-label': 'Font look' }, [el('option', { value: 'serif', text: 'Serif (with small feet)' }), el('option', { value: 'sans', text: 'Sans-serif (clean)' }), el('option', { value: 'script', text: 'Script (handwriting)' })]);
          ksel.value = cfg.customKind || (fd.role === 'display' ? 'serif' : 'sans');
          ksel.addEventListener('change', function () { cfg.customKind = ksel.value; fset(); });
          fbox.appendChild(el('div', { class: 'fld' }, [el('span', { class: 'l', text: 'This font looks like (used as the backup while it loads)' }), ksel]));
          if (cfg.custom) {
            fbox.appendChild(prev);
            previewCustom(prev, cfg.custom).catch(function () { prev.textContent = ''; prev.appendChild(el('small', { text: 'Preview not available. The file may be damaged or unsupported.' })); });
            fbox.appendChild(el('div', {}, [el('button', { type: 'button', class: 'btn ghost small', text: 'Remove this font', onclick: function () { cfg.custom = ''; cfg.source = 'google'; fset(); drawF(); } })]));
          }
          fbox.appendChild(el('small', { text: 'Only upload fonts you are licensed to use on a website. Bangla and other scripts work if the font includes them.' }));
        }
      };
      w.appendChild(label(fd)); w.appendChild(fbox); drawF();
    } else if (t === 'group') {
      if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {};
      var g = el('div', { class: 'group' }); w.appendChild(label(fd));
      var pr = el('div', { class: 'pair' });
      fd.fields.forEach(function (sf) { pr.appendChild(field(sf, obj[k], ctx)); });
      g.appendChild(pr); w.appendChild(g);
    } else if (t === 'image') {
      w.appendChild(label(fd));
      var contain = !!(fd.alpha || fd.svg || fd.icon), pv = el('img', { class: 'pv' + (contain ? ' contain' : ''), alt: '', title: 'Click to open full size' }), msg = el('span', { class: 'pvmsg', text: 'Loading…' });
      var cap = el('small', { class: 'pvcap' }), seq = 0;
      var file = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' + (fd.svg ? ',image/svg+xml,.svg' : '') });
      var rm = el('button', { type: 'button', class: 'btn ghost small', text: 'Remove' });
      var paintImg = function () {
        var p = obj[k] || '', token = ++seq;
        pv.hidden = true; msg.hidden = false; rm.hidden = !p;
        if (!p) { msg.textContent = 'No photo yet'; cap.textContent = 'Choose a photo below.'; return; }
        cap.textContent = (S.pending[p] ? 'New photo, not saved yet \u00b7 ' : 'Current photo \u00b7 ') + p.split('/').pop();
        msg.textContent = 'Loading…';
        showImg(p, pv, msg, token, function () { return seq; }, 'Photo file not found on GitHub');
      };
      pv.addEventListener('click', function () { if (pv.src) window.open(pv.src, '_blank', 'noopener'); });
      file.addEventListener('change', async function () {
        var f0 = file.files && file.files[0]; if (!f0) return;
        try { var np = await addUpload(f0, ctx.dir, (ctx.tk && obj[ctx.tk]) || obj.title || obj.name || fd.key, { svg: fd.svg, alpha: fd.alpha, icon: fd.icon, max: fd.max }); set(np); paintImg(); } catch (e) { alert(e.message); }
        file.value = '';
      });
      rm.addEventListener('click', function () { set(''); paintImg(); });
      w.appendChild(el('div', { class: 'imgbox' }, [el('div', { class: 'pvframe' + (contain ? ' light' : '') }, [pv, msg]), el('div', { class: 'imgctl' }, [cap, file, rm, el('small', { text: fd.hint || (fd.svg ? 'SVG, PNG, JPG or WebP. Big images are resized automatically.' : 'JPG, PNG or WebP. Big photos are resized automatically.') })])]));
      paintImg();
    } else if (t === 'images') {
      if (!Array.isArray(obj[k])) obj[k] = [];
      w.appendChild(label(fd));
      var grid = el('div', { class: 'thumbs' }), up = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true });
      var drawT = function () {
        grid.textContent = '';
        obj[k].forEach(function (p, i) {
          var im = el('img', { alt: '' }), tf = el('div', { class: 'tf', text: 'Loading…' }), tk = 0;
          tf.appendChild(im); im.hidden = true;
          repoImage(p).then(function (u) { im.src = u; im.hidden = false; tf.firstChild.nodeType === 3 && (tf.firstChild.nodeValue = ''); }).catch(function () { tf.firstChild.nodeValue = 'Not found'; });
          var l = el('button', { type: 'button', text: '\u25C0', 'aria-label': 'Move earlier' }), r = el('button', { type: 'button', text: '\u25B6', 'aria-label': 'Move later' }), d = el('button', { type: 'button', class: 'del', text: '\u2715', 'aria-label': 'Remove photo' });
          l.addEventListener('click', function () { if (i > 0) { var x = obj[k][i]; obj[k][i] = obj[k][i - 1]; obj[k][i - 1] = x; set(obj[k]); drawT(); } });
          r.addEventListener('click', function () { if (i < obj[k].length - 1) { var x = obj[k][i]; obj[k][i] = obj[k][i + 1]; obj[k][i + 1] = x; set(obj[k]); drawT(); } });
          d.addEventListener('click', function () { obj[k].splice(i, 1); set(obj[k]); drawT(); });
          grid.appendChild(el('div', { class: 'thumb' }, [tf, el('div', { class: 'tb2' }, [l, r, d])]));
        });
        if (!obj[k].length) grid.appendChild(el('small', { text: 'No photos yet.' }));
      };
      up.addEventListener('change', async function () {
        var files = Array.prototype.slice.call(up.files || []);
        for (var i = 0; i < files.length; i++) { try { obj[k].push(await addUpload(files[i], ctx.dir, (ctx.tk && obj[ctx.tk]) || obj.title || 'photo')); } catch (e) { alert(e.message); } }
        set(obj[k]); drawT(); up.value = '';
      });
      w.appendChild(grid); w.appendChild(up); w.appendChild(el('small', { text: 'You can pick several photos at once. JPG, PNG or WebP; big photos are resized automatically.' }));
      drawT();
    } else if (t === 'list') {
      if (!Array.isArray(obj[k])) obj[k] = [];
      w.appendChild(label(fd));
      w.appendChild(listEditor(obj[k], fd, { file: ctx.file, dir: ctx.dir, onInput: ctx.onInput }, true));
    }
    return w;
  }

  function listEditor(arr, spec, ctx, nested) {
    var box = el('div', { class: nested ? 'nested' : '' }), shut = {};
    function title(it) { return spec.titleFn ? spec.titleFn(it) : (it[spec.tk] || ''); }
    function draw() {
      box.textContent = '';
      arr.forEach(function (it, i) { box.appendChild(rowEl(it, i)); });
      var add = el('button', { type: 'button', class: 'btn ghost addrow', text: '+ Add ' + spec.item });
      add.addEventListener('click', function () {
        arr.push(spec.blank ? clone(spec.blank) : {}); shut['o' + (arr.length - 1)] = true; touch(ctx.file); draw();
        var rows = box.querySelectorAll(':scope > .row-card'); var last = rows[rows.length - 1]; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      box.appendChild(add);
    }
    function rowEl(it, i) {
      var tt = el('span', { class: 'rtitle', text: title(it) || ('New ' + spec.item) });
      var up = el('button', { type: 'button', 'aria-label': 'Move up' }, [el('b', { text: '\u2191' }), ' Up']), dn = el('button', { type: 'button', 'aria-label': 'Move down' }, [el('b', { text: '\u2193' }), ' Down']), del = el('button', { type: 'button', class: 'del', 'aria-label': 'Delete' }, [el('b', { text: '\u2715' }), ' Delete']);
      up.addEventListener('click', function () { if (i > 0) { var x = arr[i]; arr[i] = arr[i - 1]; arr[i - 1] = x; touch(ctx.file); draw(); } });
      dn.addEventListener('click', function () { if (i < arr.length - 1) { var x = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = x; touch(ctx.file); draw(); } });
      del.addEventListener('click', function () { if (confirm('Delete this ' + spec.item.toLowerCase() + '? It is removed when you press Save.')) { arr.splice(i, 1); touch(ctx.file); draw(); } });
      var body = el('div', { class: 'rbody' });
      var rctx = { file: ctx.file, dir: ctx.dir, tk: spec.tk, onInput: function () { tt.textContent = title(it) || ('New ' + spec.item); if (ctx.onInput) ctx.onInput(); } };
      spec.fields.forEach(function (fd) { body.appendChild(field(fd, it, rctx)); });
      var card = el('div', { class: 'row-card' + (!nested && arr.length > 4 && !shut['o' + i] ? ' shut' : '') }, [el('div', { class: 'row-head' }, [el('span', { class: 'badge', text: String(i + 1) }), tt, el('span', { class: 'rbtns' }, [up, dn, del])]), body]);
      tt.addEventListener('click', function () { card.classList.toggle('shut'); shut['o' + i] = !card.classList.contains('shut'); });
      return card;
    }
    draw();
    return box;
  }

  function normalizeFile(f) {
    SECTIONS.filter(function (s) { return s.file === f.name && s.kind === 'list'; }).forEach(function (s) {
      if (!Array.isArray(f.data)) return;
      if (s.tk) for (var i = f.data.length - 1; i >= 0; i--) { if (!String(f.data[i][s.tk] || '').trim()) f.data.splice(i, 1); }
    });
  }
  function serialize(f) { return JSON.stringify(f.data, null, 2) + '\n'; }

  /* ------------------------------------------------------------ one commit for everything */
  async function commitChanges(changes, message) {
    var ref = await gh('GET', 'git/ref/heads/' + refPath());
    var parentSha = ref.object.sha;
    var parent = await gh('GET', 'git/commits/' + parentSha);
    var tree = [], lastBlob = {};
    for (var i = 0; i < changes.length; i++) {
      var c = changes[i];
      if (c.remove) { tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null }); continue; }
      var blob = await gh('POST', 'git/blobs', c.b64 ? { content: c.b64, encoding: 'base64' } : { content: c.text, encoding: 'utf-8' });
      lastBlob[c.path] = blob.sha;
      tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    var t = await gh('POST', 'git/trees', { base_tree: parent.tree.sha, tree: tree });
    var commit = await gh('POST', 'git/commits', { message: message, tree: t.sha, parents: [parentSha] });
    await gh('PATCH', 'git/refs/heads/' + refPath(), { sha: commit.sha, force: false });
    return { sha: commit.sha, blobs: lastBlob };
  }

  async function saveAll() {
    var paths = Object.keys(S.dirty).filter(function (k) { return S.dirty[k]; });
    if (!paths.length || S.busy) return;
    S.busy = true; refreshBar(); note('info', 'Saving to GitHub… please wait.');
    try {
      paths.forEach(function (p) { normalizeFile(S.files[p]); });
      for (var c = 0; c < paths.length; c++) {            // refuse to overwrite a file somebody else changed meanwhile
        if (S.files[paths[c]].isNew) continue;
        var live = await gh('GET', contentsPath(paths[c]));
        if (live.sha !== S.files[paths[c]].sha) { var ce = new Error('conflict'); ce.status = 409; throw new Error(friendly(409, { message: paths[c].split('/').pop() + ' was changed on GitHub' }, paths[c])); }
      }
      var refs = {}; Object.keys(S.files).forEach(function (p) { gather(S.files[p].data, refs); });
      var changes = [], uploaded = 0;
      Object.keys(S.pending).filter(function (p) { return refs[p]; }).forEach(function (p) { changes.push({ path: p, b64: S.pending[p] }); uploaded++; });
      paths.forEach(function (p) { changes.push({ path: p, text: serialize(S.files[p]) }); });
      paths.forEach(function (p) { var old = S.files[p].origImgs; for (var op in old) { if (!refs[op] && op.indexOf('__p') > -1) changes.push({ path: op, remove: true }); } });
      var res = await commitChanges(changes, 'Control panel: update ' + paths.map(function (p) { return p.split('/').pop(); }).join(', '));
      paths.forEach(function (p) { var f = S.files[p]; f.sha = res.blobs[p]; f.isNew = false; S.dirty[p] = false; f.origImgs = gather(f.data, {}); });
      Object.keys(S.pending).forEach(function (p) { if (refs[p]) delete S.pending[p]; });
      S.busy = false; refreshBar(); renderSection(S.section, true);
      note('ok', 'Saved to GitHub (' + paths.length + ' file' + (paths.length === 1 ? '' : 's') + (uploaded ? ', ' + uploaded + ' photo' + (uploaded === 1 ? '' : 's') : '') + ').');
      watchBuild(res.sha);
    } catch (e) { S.busy = false; refreshBar(); note('err', e.message); }
  }

  function watchBuild(sha) {
    var id = ++buildWatch, tries = 0;
    function done(kind, text) { if (id === buildWatch) note(kind, text, true); }
    async function poll() {
      if (id !== buildWatch) return;
      tries++;
      try {
        var j = await gh('GET', 'actions/runs?head_sha=' + encodeURIComponent(sha) + '&per_page=5');
        var run = (j.workflow_runs || [])[0];
        if (!run) { if (tries > 8) { done('err', 'Your changes are saved on GitHub, but NO website rebuild started, so the live site will not change. Open Tools > Setup check to see why (usually: the build file is missing or Pages is not set to GitHub Actions).'); return; } }
        else if (run.status === 'completed') {
          if (run.conclusion === 'success') done('ok', 'Saved and live: the website has been rebuilt with your changes.');
          else {
            var box = el('span', { text: 'Your changes are saved, but the website rebuild failed (' + run.conclusion + '). ' });
            if (/^https:\/\/github\.com\//.test(run.html_url || '')) box.appendChild(el('a', { href: run.html_url, target: '_blank', rel: 'noopener', text: 'Open the build log' }));
            if (id === buildWatch) note('err', box, true);
          }
          return;
        } else done('info', 'Saved. The website is rebuilding… (' + run.status.replace('_', ' ') + ')');
      } catch (e) { done('ok', 'Saved to GitHub. The website rebuilds automatically; changes appear in 1\u20133 minutes.'); return; }
      if (tries < 60) setTimeout(poll, 5000);
    }
    setTimeout(poll, 3500);
  }

  /* ------------------------------------------------------------ tools */
  async function renderUnused(view) {
    view.appendChild(el('h1', { text: 'Unused files' }));
    view.appendChild(el('p', { class: 'muted', text: 'Photos and fonts uploaded through this panel that nothing uses any more. Deleting them keeps the repository small.' }));
    var ref = await gh('GET', 'git/ref/heads/' + refPath()), cm = await gh('GET', 'git/commits/' + ref.object.sha);
    var tree = await gh('GET', 'git/trees/' + cm.tree.sha + '?recursive=1');
    await loadAll();
    var refs = {}; Object.keys(S.files).forEach(function (p) { gather(S.files[p].data, refs); });
    Object.keys(S.pending).forEach(function (p) { refs[p] = true; });
    var unused = (tree.tree || []).filter(function (t) { return t.type === 'blob' && /^assets\/(images|fonts)\/uploads\//.test(t.path) && isAssetPath(t.path) && !refs[t.path]; });
    if (!unused.length) { view.appendChild(el('div', { class: 'msg ok', text: 'No unused files. Every uploaded photo and font is in use.' })); return; }
    var checks = [], list = el('div');
    unused.forEach(function (f) {
      var isF = isFontPath(f.path), cb = el('input', { type: 'checkbox' }), im = isF ? el('span', { class: 'upv fontbox', text: 'Aa' }) : el('img', { class: 'upv', alt: '' }); checks.push([cb, f]);
      if (!isF) repoImage(f.path).then(function (u) { im.src = u; }).catch(function () { /* ignore */ });
      list.appendChild(el('label', { class: 'urow' }, [cb, im, el('span', { class: 'uinfo' }, [el('b', { text: f.path.split('/').pop() }), el('small', { text: f.path + (f.size ? ' \u00b7 ' + Math.round(f.size / 1024) + ' KB' : '') })])]));
    });
    var all = el('button', { type: 'button', class: 'btn ghost small', text: 'Select all', onclick: function () { checks.forEach(function (c) { c[0].checked = true; }); } });
    var del = el('button', { type: 'button', class: 'btn danger', text: 'Delete selected from GitHub', onclick: async function () {
      var sel = checks.filter(function (c) { return c[0].checked; }).map(function (c) { return { path: c[1].path, remove: true }; });
      if (!sel.length) { alert('Tick the photos to delete first.'); return; }
      if (!confirm('Delete ' + sel.length + ' photo(s) from GitHub? Older versions can still be restored from the repository history.')) return;
      del.disabled = true; note('info', 'Deleting…');
      try { await commitChanges(sel, 'Control panel: remove ' + sel.length + ' unused photo(s)'); sel.forEach(function (s) { delete blobCache[s.path]; }); await renderSection('unused', true); note('ok', 'Deleted ' + sel.length + ' photo(s).'); }
      catch (e) { note('err', e.message); del.disabled = false; }
    } });
    view.appendChild(el('div', { class: 'addrow' }, [all, ' ', del])); view.appendChild(list);
  }

  function renderPreview(view) {
    view.appendChild(el('h1', { text: 'Live preview' }));
    view.appendChild(el('p', { class: 'muted', text: 'This shows the published website (not unsaved changes). After you save, wait for the rebuild message, then press Refresh.' }));
    var stage = el('div', { class: 'pvstage' }), frame = el('iframe', { title: 'Website preview', src: '../index.html' });
    var sel = el('select', { 'aria-label': 'Page' }, SCHEMA.PAGES.map(function (p) { return el('option', { value: p[0], text: p[1] }); }));
    sel.style.width = 'auto';
    sel.addEventListener('change', function () { frame.src = '../' + sel.value; });
    var d1 = el('button', { type: 'button', class: 'pill on2', text: 'Desktop' }), d2 = el('button', { type: 'button', class: 'pill', text: 'Phone' });
    d1.addEventListener('click', function () { stage.classList.remove('mob'); d1.className = 'pill on2'; d2.className = 'pill'; });
    d2.addEventListener('click', function () { stage.classList.add('mob'); d2.className = 'pill on2'; d1.className = 'pill'; });
    view.appendChild(el('div', { class: 'pvbar' }, [sel, d1, d2, el('button', { type: 'button', class: 'tb', text: '\u21BB Refresh', onclick: function () { frame.src = '../' + sel.value + '?t=' + Date.now(); } }), el('a', { class: 'tb', href: SITE_URL, target: '_blank', rel: 'noopener', text: 'Open site \u2197' })]));
    stage.appendChild(frame); view.appendChild(stage);
  }

  async function ghTry(path, rawUrl) {
    try {
      var r = await fetch(rawUrl || (repoBase() + '/' + path + (path.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now()), { headers: headers(), cache: 'no-store' });
      var j = {}; try { j = await r.json(); } catch (e) { j = {}; }
      return { ok: r.ok, status: r.status, json: j };
    } catch (e) { return { ok: false, status: 0, json: {} }; }
  }
  async function renderHealth(view) {
    view.appendChild(el('h1', { text: 'Setup check' }));
    view.appendChild(el('p', { class: 'muted', text: 'Saved changes only appear on the website after GitHub rebuilds it. This checks the parts that make that happen.' }));
    var rows = [], safe = /^[A-Za-z0-9._-]+$/.test(CFG.owner) && /^[A-Za-z0-9._-]+$/.test(CFG.repo);
    var base = safe ? 'https://github.com/' + CFG.owner + '/' + CFG.repo : '';
    function add(st, title, detail, linkText, href) { rows.push({ st: st, title: title, detail: detail, linkText: linkText, href: href }); }

    var repo = await ghTry('', repoBase());
    if (!repo.ok) throw new Error(friendly(repo.status, repo.json, CFG.owner + '/' + CFG.repo));
    var def = repo.json.default_branch || 'main';
    add(def === CFG.branch ? 'ok' : 'todo', 'The panel edits the main branch', def === CFG.branch ? 'Branch "' + CFG.branch + '" is the default branch.' : 'The panel saves to "' + CFG.branch + '" but the default branch is "' + def + '". The website only publishes from the default branch. Log out and log in with branch "' + def + '".');

    var wf = await ghTry(contentsPath('.github/workflows/deploy.yml'));
    if (wf.ok) {
      var wtxt = ''; try { wtxt = b64dec(wf.json.content || ''); } catch (e) { wtxt = ''; }
      var m = /branches:\s*\[([^\]]*)\]/.exec(wtxt), listed = m ? m[1].split(',').map(function (x) { return x.replace(/["'\s]/g, ''); }) : [];
      if (m && listed.indexOf(CFG.branch) < 0) add('todo', 'The build file listens to the right branch', 'The build file only runs for: ' + listed.join(', ') + ', but you save to "' + CFG.branch + '". Edit .github/workflows/deploy.yml so "branches" includes "' + CFG.branch + '".', 'Open the file', base ? base + '/blob/' + encodeURIComponent(CFG.branch) + '/.github/workflows/deploy.yml' : '');
      else add('ok', 'The build file exists', '.github/workflows/deploy.yml is in the repository.');
    } else if (wf.status === 404) {
      add('todo', 'The build file is missing', 'There is no .github/workflows/deploy.yml, so nothing rebuilds the website after you save. The folder name starts with a dot, so many upload tools skip it. In GitHub use "Add file > Create new file", type the name .github/workflows/deploy.yml and paste the contents from the zip.', 'Add the file on GitHub', base ? base + '/new/' + encodeURIComponent(CFG.branch) + '?filename=.github/workflows/deploy.yml' : '');
    } else add('unk', 'The build file', 'Could not check it (status ' + wf.status + ').');

    var pg2 = await ghTry('pages'), site = '';
    if (pg2.ok) {
      site = pg2.json.html_url || '';
      var viaActions = pg2.json.build_type === 'workflow';
      add(viaActions ? 'ok' : 'todo', 'Pages publishes from GitHub Actions', viaActions ? 'Publishing source is "GitHub Actions".' : 'Pages is set to "Deploy from a branch". Change it to "GitHub Actions", otherwise the rebuilt website is never published.', viaActions ? '' : 'Open Pages settings', viaActions || !base ? '' : base + '/settings/pages');
    } else if (pg2.status === 404) add('todo', 'GitHub Pages is turned on', 'GitHub Pages is not enabled for this repository (or the token cannot see it). Turn it on and choose "GitHub Actions" as the source.', 'Open Pages settings', base ? base + '/settings/pages' : '');
    else add('unk', 'GitHub Pages source', 'This token cannot read Pages settings. Check by hand: Settings > Pages > Source must be "GitHub Actions". (Optional: give the token "Pages: Read".)', 'Open Pages settings', base ? base + '/settings/pages' : '');

    var runs = await ghTry('actions/runs?per_page=3');
    if (runs.ok) {
      var list = runs.json.workflow_runs || [];
      if (!list.length) add('todo', 'A website build has run', 'No build has ever run in this repository. Either the build file is missing, GitHub Actions is turned off (Settings > Actions > General), or you have not saved since adding it.', 'Open Actions', base ? base + '/actions' : '');
      else {
        var r0 = list[0], when = r0.updated_at ? new Date(r0.updated_at).toLocaleString() : '';
        if (r0.status !== 'completed') add('unk', 'Latest build', 'A build is running right now (' + String(r0.status).replace('_', ' ') + '). Wait a minute and run this check again.');
        else if (r0.conclusion === 'success') add('ok', 'Latest build succeeded', 'Last successful build: ' + when + '.');
        else add('todo', 'Latest build failed', 'The last build ended with "' + r0.conclusion + '" (' + when + '). Open the log to see the red step.', 'Open the build log', /^https:\/\/github\.com\//.test(r0.html_url || '') ? r0.html_url : '');
      }
    } else add('unk', 'Latest build', 'This token cannot read build status (give it "Actions: Read-only"). Check by hand in the Actions tab.', 'Open Actions', base ? base + '/actions' : '');

    var bad = rows.filter(function (r) { return r.st === 'todo'; }).length;
    view.appendChild(el('div', { class: 'msg ' + (bad ? 'err' : 'ok'), text: bad ? bad + ' thing(s) to fix before changes can appear on the website.' : 'Everything that can be checked from here looks right.' }));
    var wrap = el('div');
    rows.forEach(function (r) {
      var right = [el('span', { class: 'tag ' + (r.st === 'ok' ? 'ok' : r.st === 'todo' ? 'todo' : 'unk'), text: r.st === 'ok' ? 'DONE' : r.st === 'todo' ? 'TO DO' : 'CHECK' })];
      if (r.href) right.push(el('a', { class: 'tb', href: r.href, target: '_blank', rel: 'noopener', text: r.linkText + ' \u2197' }));
      wrap.appendChild(el('div', { class: 'crow' }, [el('div', {}, [el('b', { text: r.title }), el('small', { text: r.detail })]), el('span', { class: 'rbtns' }, right)]));
    });
    view.appendChild(wrap);
    var tips = [];
    if (site) tips.push('Your website address right now: ' + site);
    tips.push('If you are looking at weddingberriesbd.com: that address shows this website only after the custom domain is connected (Settings > Pages > Custom domain, plus the DNS records at your domain provider). Until then it may still show the old site, and only the address above shows your changes.');
    tips.push('After a rebuild finishes, refresh the page with Ctrl+Shift+R (or open it in a private window) so the browser does not show an old copy.');
    view.appendChild(el('div', { class: 'box' }, [el('b', { text: 'Also check' })].concat(tips.map(function (t) { return el('p', { class: 'muted', style: 'margin:6px 0 0', text: t }); }))));
    view.appendChild(el('div', { class: 'addrow' }, [el('button', { type: 'button', class: 'btn ghost small', text: '\u21BB Run the check again', onclick: function () { renderSection('health'); } })]));
  }

  function formReady() {
    var f = (S.files['content/form.json'] || {}).data || {};
    if (f.enabled === false) return true;
    var m = f.method || 'script', cd = (S.files['content/site.json'] || { data: {} }).data.contact || {};
    if (m === 'script') return /^https:\/\/script\.google\.com\/(macros|a\/macros\/[A-Za-z0-9.-]+)\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(f.scriptUrl || '').trim());
    if (m === 'whatsapp') return !!String(cd.whatsapp || cd.phone || '').replace(/[^0-9]/g, '') && !isPlaceholder(cd.phone || cd.whatsapp);
    return /@/.test(cd.email || '') && !isPlaceholder(cd.email);
  }
  async function renderChecklist(view) {
    view.appendChild(el('h1', { text: 'Launch checklist' }));
    view.appendChild(el('p', { class: 'muted', text: 'Text still written in [square brackets] is placeholder content. Replace it before the website goes public.' }));
    await loadAll();
    var total = 0, rows = [];
    SECTIONS.forEach(function (s) {
      if (s.group === 'Design') return;
      var f = S.files['content/' + s.file]; if (!f) return;
      var d = s.kind === 'object' ? f.data[s.sub] : f.data;
      var n = countPlaceholders(d); total += n; rows.push([s, n]);
    });
    var cd = S.files['content/site.json'].data.contact || {}, pj = S.files['content/projects.json'].data, lg = S.files['content/pages.json'].data.legal || {}, so = S.files['content/site.json'].data.social || {};
    var checks = [
      ['Email address is filled in', cd.email && !isPlaceholder(cd.email), 'contactinfo'], ['Phone number is filled in', cd.phone && !isPlaceholder(cd.phone), 'contactinfo'],
      ['The contact form can deliver messages', formReady(), 'contactform'],
      ['At least one project is marked Featured', pj.some(function (p) { return p.featured; }), 'projects'], ['Privacy policy text is added', (lg.privacy || []).length > 0, 'legal'],
      ['Terms text is added', (lg.terms || []).length > 0, 'legal'], ['At least one social link is added', Object.keys(so).some(function (k) { return so[k]; }), 'social']
    ];
    view.appendChild(el('div', { class: 'msg ' + (total ? 'info' : 'ok'), text: total ? total + ' placeholder text(s) left to replace.' : 'No placeholder text left.' }));
    var wrap = el('div');
    checks.forEach(function (c) { wrap.appendChild(el('div', { class: 'crow' }, [el('div', {}, [el('b', { text: c[0] })]), el('span', { class: 'rbtns' }, [el('span', { class: 'tag ' + (c[1] ? 'ok' : 'todo'), text: c[1] ? 'DONE' : 'TO DO' }), c[1] ? null : el('button', { type: 'button', class: 'tb', text: 'Open', onclick: function () { go(c[2]); } })])])); });
    rows.forEach(function (r) { wrap.appendChild(el('div', { class: 'crow' }, [el('div', {}, [el('b', { text: r[0].title }), el('small', { text: r[0].group })]), el('span', { class: 'rbtns' }, [el('span', { class: 'tag ' + (r[1] ? 'todo' : 'ok'), text: r[1] ? r[1] + ' PLACEHOLDER' + (r[1] > 1 ? 'S' : '') : 'DONE' }), r[1] ? el('button', { type: 'button', class: 'tb', text: 'Open', onclick: function () { go(r[0].id); } }) : null])])); });
    view.appendChild(wrap);
  }

  /* ------------------------------------------------------------ views */
  var SITE_URL = 'https://weddingberriesbd.com';
  var TOOLS = [['health', 'Setup check'], ['checklist', 'Launch checklist'], ['preview', 'Live preview'], ['unused', 'Unused files']];
  function sectionTitle(id) { if (id === 'dash') return 'Dashboard'; var sc = secById(id); if (sc) return sc.title; for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i][0] === id) return TOOLS[i][1]; return ''; }
  function drawerEl() { return document.getElementById('drawer'); }
  function drawerOpen() { var d = drawerEl(); return !!(d && d.classList.contains('open')); }
  function openDrawer() {
    var d = drawerEl(); if (!d) return;
    d.classList.add('open'); document.getElementById('scrim').hidden = false; document.getElementById('burger').setAttribute('aria-expanded', 'true'); document.body.classList.add('noscroll');
    var cur = d.querySelector('[aria-current="page"]') || d.querySelector('.item'); if (cur) { cur.focus(); cur.scrollIntoView({ block: 'nearest' }); }
  }
  function closeDrawer(returnFocus) {
    var d = drawerEl(); if (!d) return;
    d.classList.remove('open'); var sc = document.getElementById('scrim'); if (sc) sc.hidden = true;
    var bg = document.getElementById('burger'); if (bg) { bg.setAttribute('aria-expanded', 'false'); if (returnFocus) bg.focus(); }
    document.body.classList.remove('noscroll');
  }
  document.addEventListener('keydown', function (e) {
    if (!drawerOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(true); return; }
    if (e.key === 'Tab') {                               // keep keyboard focus inside the open menu
      var f = Array.prototype.slice.call(drawerEl().querySelectorAll('button, a[href]')).filter(function (x) { return !x.disabled; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  function shell() {
    document.body.classList.remove('noscroll');
    app.textContent = '';
    var groups = [], seen = {};
    SECTIONS.forEach(function (s) { if (!seen[s.group]) { seen[s.group] = 1; groups.push(s.group); } });
    function item(id, text) { return el('button', { type: 'button', class: 'item', 'aria-current': S.section === id ? 'page' : null, text: text, onclick: function () { go(id); } }); }
    var navEl = el('nav', { class: 'dnav', 'aria-label': 'Control panel sections' }, [item('dash', 'Dashboard')]);
    groups.forEach(function (g) {
      navEl.appendChild(el('div', { class: 'dgroup', text: g }));
      SECTIONS.filter(function (s) { return s.group === g; }).forEach(function (s) { navEl.appendChild(item(s.id, s.title)); });
    });
    navEl.appendChild(el('div', { class: 'dgroup', text: 'Tools' }));
    TOOLS.forEach(function (t) { navEl.appendChild(item(t[0], t[1])); });
    var drawer = el('aside', { id: 'drawer', class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menu' }, [
      el('div', { class: 'dhead' }, [el('div', { class: 'brand' }, ['Wedding ', el('span', { text: 'Berries' })]), el('button', { type: 'button', class: 'dclose', 'aria-label': 'Close menu', text: '\u2715', onclick: function () { closeDrawer(true); } })]),
      navEl,
      el('div', { class: 'dfoot' }, [el('a', { class: 'tb', href: SITE_URL, target: '_blank', rel: 'noopener', text: 'View site \u2197' }), el('button', { type: 'button', class: 'tb', text: 'Reload from GitHub', onclick: reloadAll }), el('button', { type: 'button', class: 'tb', text: 'Log out', onclick: logout })])
    ]);
    var scrim = el('div', { id: 'scrim', class: 'scrim', hidden: true, onclick: function () { closeDrawer(true); } });
    var burger = el('button', { id: 'burger', class: 'burger', type: 'button', 'aria-label': 'Open menu', 'aria-expanded': 'false', 'aria-controls': 'drawer', onclick: function () { drawerOpen() ? closeDrawer(true) : openDrawer(); } }, [el('span', { class: 'burger__bars' })]);
    var top = el('div', { class: 'top' }, [el('div', { class: 'toprow' }, [
      el('div', { class: 'topleft' }, [burger, el('div', { class: 'brand' }, ['Wedding ', el('span', { text: 'Berries Control' })]), el('span', { class: 'crumb', id: 'crumb', text: sectionTitle(S.section) })]),
      el('div', { class: 'toolbtns' }, [el('a', { class: 'tb', href: SITE_URL, target: '_blank', rel: 'noopener', text: 'View site \u2197' })])
    ])]);
    main = el('main', { class: 'wrap' }, [el('div', { id: 'flash' }), el('div', { id: 'view' })]);
    var bar = el('div', { class: 'savebar' }, [el('span', { class: 'st', id: 'st', text: 'No unsaved changes' }), el('button', { class: 'btn', id: 'savebtn', text: 'Save to GitHub', disabled: true, onclick: saveAll })]);
    app.appendChild(top); app.appendChild(main); app.appendChild(bar); app.appendChild(scrim); app.appendChild(drawer);
  }
  function go(id) { S.section = id; shell(); renderSection(id); }

  async function renderSection(id, keepFlash) {
    var view = document.getElementById('view'); if (!view) { shell(); view = document.getElementById('view'); }
    if (!keepFlash) note('', '');
    view.textContent = '';
    try {
      if (id === 'dash') {
        view.appendChild(el('h1', { text: 'Dashboard' }));
        view.appendChild(el('p', { class: 'muted', text: 'Pick what you want to change, edit it, then press "Save to GitHub". The website rebuilds by itself and your changes go live in 1\u20133 minutes.' }));
        var groups = [], seen = {};
        SECTIONS.forEach(function (s) { if (!seen[s.group]) { seen[s.group] = 1; groups.push(s.group); } });
        groups.forEach(function (g) {
          view.appendChild(el('div', { class: 'gtitle', text: g }));
          var cards = el('div', { class: 'cards' });
          SECTIONS.filter(function (s) { return s.group === g; }).forEach(function (s) { cards.appendChild(el('button', { class: 'card', onclick: function () { go(s.id); } }, [el('b', { text: s.title }), el('span', { text: s.intro })])); });
          view.appendChild(cards);
        });
        view.appendChild(el('div', { class: 'gtitle', text: 'Tools' }));
        var tools = el('div', { class: 'cards' });
        [['health', 'Setup check', 'Find out why saved changes do not appear on the website (build file, Pages setting, last build).'], ['checklist', 'Launch checklist', 'See which placeholder texts and settings still need real content.'], ['preview', 'Live preview', 'Look at the published website on desktop and phone size.'], ['unused', 'Unused files', 'Find uploaded photos and fonts nothing uses any more and delete them.']].forEach(function (t) { tools.appendChild(el('button', { class: 'card', onclick: function () { go(t[0]); } }, [el('b', { text: t[1] }), el('span', { text: t[2] })])); });
        view.appendChild(tools);
        view.appendChild(el('div', { class: 'box', style: 'margin-top:18px' }, [el('b', { text: 'Tips' }), el('p', { class: 'muted', style: 'margin:6px 0 0', text: 'A blank line in a long text starts a new paragraph. Photos are resized automatically before upload. Every save is one GitHub commit, so older versions can always be restored from the repository history.' })]));
        refreshBar(); return;
      }
      if (id === 'health') { await renderHealth(view); refreshBar(); return; }
      if (id === 'unused') { await renderUnused(view); refreshBar(); return; }
      if (id === 'preview') { renderPreview(view); refreshBar(); return; }
      if (id === 'checklist') { await renderChecklist(view); refreshBar(); return; }
      var sec = secById(id);
      view.appendChild(el('h1', { text: sec.title })); view.appendChild(el('p', { class: 'muted', text: sec.intro }));
      view.appendChild(el('div', { style: 'margin:-6px 0 14px' }, [el('button', { type: 'button', id: 'discardbtn', class: 'tb', text: '\u21BA Discard unsaved changes', disabled: !S.dirty['content/' + sec.file], onclick: function () {
        if (!confirm('Discard ALL unsaved changes in this section (and other sections that share the same data file) and reload it from GitHub?')) return;
        var path = 'content/' + sec.file; delete S.files[path]; S.dirty[path] = false; renderSection(id);
      } })]));
      var f = await loadFile(sec.file);
      if (S.section !== id) return;
      var ctx = { file: sec.file, dir: sec.dir, tk: sec.tk };
      ctx.onInput = function () { (ctx.painters || []).forEach(function (p) { p(); }); };
      if (sec.kind === 'list') {
        if (!Array.isArray(f.data)) f.data = [];
        view.appendChild(listEditor(f.data, sec, ctx, false));
      } else {
        var target = sec.kind === 'root' ? f.data : (f.data[sec.sub] && typeof f.data[sec.sub] === 'object' ? f.data[sec.sub] : (f.data[sec.sub] = {}));
        if (sec.id === 'design') migrateFonts(target);
        ctx.root = target;
        var rb = el('div', { class: 'rbody' });
        sec.fields.forEach(function (fd) { rb.appendChild(field(fd, target, ctx)); });
        view.appendChild(el('div', { class: 'row-card' }, [rb]));
      }
    } catch (e) { view.appendChild(el('div', { class: 'msg err', text: e.message })); }
    refreshBar();
  }

  /* ------------------------------------------------------------ login */
  function saveCfg(remember) { var s = JSON.stringify(CFG); try { localStorage.removeItem(CFG_KEY); sessionStorage.removeItem(CFG_KEY); (remember ? localStorage : sessionStorage).setItem(CFG_KEY, s); } catch (e) { /* ignore */ } }
  function readCfg() { try { var s = sessionStorage.getItem(CFG_KEY) || localStorage.getItem(CFG_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function resetState() { S.files = {}; S.pending = {}; S.preview = {}; S.dirty = {}; blobCache = {}; buildWatch++; }
  function logout() {
    if (dirtyCount() && !confirm('You have unsaved changes. Log out anyway?')) return;
    try { localStorage.removeItem(CFG_KEY); sessionStorage.removeItem(CFG_KEY); } catch (e) { /* ignore */ }
    resetState(); CFG = null; showLogin();
  }
  async function reloadAll() {
    if (dirtyCount() && !confirm('Discard unsaved changes and reload from GitHub?')) return;
    resetState(); go(S.section);
  }
  function guessRepo() {
    var h = location.hostname, parts = location.pathname.split('/').filter(Boolean);
    if (/\.github\.io$/.test(h)) { var o = h.split('.')[0]; return { owner: o, repo: parts.length > 1 && parts[0] !== 'admin' ? parts[0] : h }; }
    return {};
  }
  function showLogin(msg) {
    var prev = readCfg() || guessRepo();
    var inp = {
      owner: el('input', { type: 'text', value: prev.owner || '', placeholder: 'e.g. weddingberries', autocapitalize: 'off', autocomplete: 'off', id: 'f-owner' }),
      repo: el('input', { type: 'text', value: prev.repo || '', placeholder: 'e.g. wedding-berries-website', autocapitalize: 'off', autocomplete: 'off', id: 'f-repo' }),
      branch: el('input', { type: 'text', value: prev.branch || 'main', autocapitalize: 'off', autocomplete: 'off', id: 'f-branch' }),
      token: el('input', { type: 'password', value: '', placeholder: 'github_pat_\u2026', autocomplete: 'off', id: 'f-token' })
    };
    var show = el('button', { type: 'button', class: 'tb', text: 'Show', onclick: function () { var on = inp.token.type === 'password'; inp.token.type = on ? 'text' : 'password'; show.textContent = on ? 'Hide' : 'Show'; } });
    var rem = el('input', { type: 'checkbox' }); try { rem.checked = !!localStorage.getItem(CFG_KEY); } catch (e) { /* ignore */ }
    var out = el('div'); if (msg) out.appendChild(el('div', { class: 'msg err', text: msg }));
    var btn = el('button', { class: 'btn', type: 'submit', text: 'Connect' });
    var form = el('form', {}, [
      el('div', { class: 'fld' }, [el('label', { class: 'l', for: 'f-owner', text: 'GitHub username (owner)' }), inp.owner]),
      el('div', { class: 'fld' }, [el('label', { class: 'l', for: 'f-repo', text: 'Repository name' }), inp.repo]),
      el('div', { class: 'fld' }, [el('label', { class: 'l', for: 'f-branch', text: 'Branch' }), inp.branch]),
      el('div', { class: 'fld' }, [el('label', { class: 'l', for: 'f-token', text: 'Access token (fine-grained, this repository only)' }), el('div', { class: 'passrow' }, [inp.token, show])]),
      el('label', { class: 'chk', style: 'margin-bottom:12px' }, [rem, 'Remember on this device (only on your own computer or phone)']), btn]);
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); btn.disabled = true; btn.textContent = 'Connecting\u2026'; out.textContent = '';
      CFG = { owner: inp.owner.value.trim(), repo: inp.repo.value.trim(), branch: inp.branch.value.trim() || 'main', token: inp.token.value.trim() || (prev.token || '') };
      try {
        if (!CFG.owner || !CFG.repo || !CFG.token) throw new Error('Please fill in the username, repository and token.');
        var r = await fetch(repoBase(), { headers: headers(), cache: 'no-store' });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(friendly(r.status, j, CFG.owner + '/' + CFG.repo));
        if (j.permissions && j.permissions.push === false) throw new Error('This token can read the repository but cannot write. Give it "Contents: Read and write".');
        await gh('GET', 'git/ref/heads/' + refPath());
        saveCfg(rem.checked); resetState(); S.section = 'dash'; go('dash');
      } catch (er) { out.textContent = ''; out.appendChild(el('div', { class: 'msg err', text: er.message })); btn.disabled = false; btn.textContent = 'Connect'; CFG = null; }
    });
    var help = el('details', { class: 'help' }, [el('summary', { text: 'How do I get an access token?' }), el('ol', {}, [
      el('li', { text: 'On GitHub open Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.' }),
      el('li', {}, ['Under "Repository access" choose ', el('b', { text: 'Only select repositories' }), ' and pick this website\u2019s repository.']),
      el('li', {}, ['Under "Repository permissions" set ', el('code', { text: 'Contents' }), ' to Read and write. (Optional: set ', el('code', { text: 'Actions' }), ' to Read-only so the panel can tell you when the rebuild finishes.)']),
      el('li', { text: 'Choose an expiry date, create the token and copy it (it starts with github_pat_). Paste it above.' })])]);
    app.textContent = '';
    app.appendChild(el('div', { class: 'login' }, [el('div', { class: 'mark', text: 'wb' }), el('h1', {}, ['Wedding ', el('span', { text: 'Berries' })]), el('p', { class: 'muted', text: 'Control Panel. Connect to your GitHub repository to edit the website.' }), out, form, help,
      el('p', { class: 'muted', style: 'margin-top:16px;font-size:13px', text: 'Your token stays in this browser only. It is never saved in the website files, and it is only ever sent to api.github.com.' })]));
  }

  CFG = readCfg();
  if (CFG && CFG.owner && CFG.repo && CFG.token) { S.section = 'dash'; go('dash'); } else { CFG = null; showLogin(); }
})();
