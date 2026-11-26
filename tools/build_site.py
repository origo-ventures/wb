#!/usr/bin/env python3
"""Wedding Berries site generator.

Reads  content/*.json  (edited by the Control Panel)  and writes the static site to an output folder.
Run locally:   python3 tools/build_site.py --out dist
On GitHub:     .github/workflows/deploy.yml runs this after every content commit, then publishes `dist`.

Text in [square brackets] is placeholder content; the build prints a list of what is still unfilled.
"""
import argparse, colorsys, html, json, pathlib, re, shutil, sys, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOMAIN = "https://weddingberriesbd.com"

# ---------------------------------------------------------------- helpers
def load(name, default):
    p = ROOT / "content" / name
    if not p.exists():
        return default
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as ex:
        sys.exit(f"ERROR: content/{name} is not valid JSON: {ex}")

def e(s):
    return html.escape("" if s is None else str(s), quote=True)

def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", str(s or "").lower()).strip("-")
    return (s or "item")[:50]

def unique_slugs(items, key):
    seen, out = {}, []
    for it in items:
        base = slugify(it.get(key)); s = base; n = 2
        while s in seen:
            s = f"{base}-{n}"; n += 1
        seen[s] = 1; out.append(s)
    return out

IMG_OK = re.compile(r"^assets/images/[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp|svg)$")
def img_ok(p):
    return isinstance(p, str) and bool(IMG_OK.match(p)) and ".." not in p

PH_SIZES = {1: (800, 1000), 2: (1200, 800), 3: (1000, 1000), 4: (800, 1000), 5: (1200, 800), 6: (800, 1000), 7: (1000, 1000), 8: (1200, 800), 9: (800, 1000)}
def img(path, alt="", lazy=True, cls=""):
    if not img_ok(path):
        return ""
    m = re.match(r"assets/images/placeholder-(\d+)\.svg$", path)
    size = ""
    if m and int(m.group(1)) in PH_SIZES:
        w, h = PH_SIZES[int(m.group(1))]
        size = f' width="{w}" height="{h}"'
    alt = alt or ("Placeholder image" if m else "")
    return f'<img src="{e(path)}" alt="{e(alt)}"{size}' + (' loading="lazy"' if lazy else "") + (f' class="{cls}"' if cls else "") + ">"

LINK_OK = re.compile(r"^(https?://[^\s\"'<>]+|mailto:[^\s\"'<>]+|tel:[+0-9() -]+|#[\w-]*|[A-Za-z0-9_./-]+\.html(#[\w-]*)?|/[A-Za-z0-9_./-]*)$")
def link(v, fallback="#"):
    v = (v or "").strip()
    return v if LINK_OK.match(v) else fallback

def real(v):
    """True when a value is filled in (not empty and not a [placeholder])."""
    v = (v or "").strip()
    return bool(v) and not (v.startswith("[") and v.endswith("]"))

def paras(v):
    if isinstance(v, str):
        v = [p for p in re.split(r"\n\s*\n", v) if p.strip()]
    return [p for p in (v or []) if str(p).strip()]

def ptags(items, cls=""):
    return "".join(f'<p{(" class=" + chr(34) + cls + chr(34)) if cls else ""}>{e(p)}</p>' for p in paras(items))

# ---------------------------------------------------------------- data
SITE = load("site.json", {})
PAGES = load("pages.json", {})
SERVICES = load("services.json", [])
PROJECTS = load("projects.json", [])
TEAM = load("team.json", [])
TESTI = load("testimonials.json", [])
FAQ = load("faq.json", [])
DESIGN = load("design.json", {})

BRAND = (SITE.get("brand") or {}).get("name") or "Wedding Berries"
CONTACT = SITE.get("contact") or {}
SOCIAL = SITE.get("social") or {}
NAV = PAGES.get("nav") or {}
FX = DESIGN.get("effects") or {}

def pg(name):
    return PAGES.get(name) or {}

SERVICE_SLUGS = unique_slugs(SERVICES, "title")
PROJECT_SLUGS = unique_slugs(PROJECTS, "title")

# ---------------------------------------------------------------- fonts and design tokens
def load_font_list():
    p = ROOT / "admin" / "fonts.js"
    if not p.exists():
        return []
    m = re.search(r"window\.WB_FONTS\s*=\s*(\[.*\])\s*;", p.read_text(encoding="utf-8"), re.S)
    return json.loads(m.group(1)) if m else []

FONT_BY_NAME = {f["n"]: f for f in load_font_list()}
FALLBACK = {
    "serif": 'Georgia, "Times New Roman", serif',
    "sans": 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    "script": 'cursive, Georgia, serif',
    "display": 'Georgia, "Times New Roman", serif',
    "bangla": 'system-ui, "Noto Sans Bengali", sans-serif',
}
FONT_RE = re.compile(r"^assets/fonts/[A-Za-z0-9_./-]+\.(woff2|woff|ttf|otf)$")
FONT_FMT = {"woff2": "woff2", "woff": "woff", "ttf": "truetype", "otf": "opentype"}
LEGACY_FONTS = {"classic": ("Cormorant Garamond", "Jost"), "romantic": ("Playfair Display", "Lato"), "modern": ("DM Serif Display", "Inter")}
SCALES = {"small": 0.9, "normal": 1, "large": 1.15}
LOGO_H = {"small": 34, "medium": 46, "large": 60}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

def font_config():
    f = DESIGN.get("fonts")
    if isinstance(f, str):
        d, b = LEGACY_FONTS.get(f, LEGACY_FONTS["classic"])
        f = {"display": {"source": "google", "google": d}, "body": {"source": "google", "google": b}}
    return f if isinstance(f, dict) else {}

def pick_weight(avail, prefs):
    for w in prefs:
        if w in avail:
            return w
    return avail[0] if avail else prefs[0]

def resolve_font(cfg, role, default):
    cfg = cfg if isinstance(cfg, dict) else {}
    custom = cfg.get("custom") or ""
    if cfg.get("source") == "custom" and FONT_RE.match(custom) and ".." not in custom:
        kind = cfg.get("customKind") if cfg.get("customKind") in FALLBACK else ("serif" if role == "display" else "sans")
        fam = f"WB {role.title()} Custom"
        return dict(kind="custom", family=fam, stack=f'"{fam}", {FALLBACK[kind]}', path=custom, w_head="500", w_brand="600")
    name = cfg.get("google") if cfg.get("google") in FONT_BY_NAME else default
    ent = FONT_BY_NAME.get(name) or {"n": name, "c": "serif", "w": "400"}
    ws = ent["w"].split(";")
    return dict(kind="google", family=name, stack=f'"{name}", {FALLBACK.get(ent["c"], FALLBACK["serif"])}', ent=ent,
                w_head=pick_weight(ws, ["500", "400", "600", "700"]), w_brand=pick_weight(ws, ["600", "700", "500", "400"]))

def google_spec(ent):
    name = ent["n"].replace(" ", "+"); ws = ent["w"].split(";")
    if ws == ["400"]:
        return f"family={name}" + (":ital@0;1" if ent.get("i") else "")
    if ent.get("i") and "400" in ws:
        return f"family={name}:ital,wght@" + ";".join([f"0,{w}" for w in ws] + ["1,400"])
    return f"family={name}:wght@" + ";".join(ws)

def hex2rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def rgb2hex(c): return "#%02X%02X%02X" % tuple(max(0, min(255, round(x))) for x in c)
def mix(a, b, t): return rgb2hex([x + (y - x) * t for x, y in zip(hex2rgb(a), hex2rgb(b))])
def darken(h, f): return rgb2hex([x * f for x in hex2rgb(h)])
def lum(h):
    def f(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = hex2rgb(h)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)

def design_css():
    """Returns (css, google_stylesheet_href or None, [font preload paths])."""
    col = dict(berry="#7A1F3D", rose="#B76E79", gold="#C9A27A", ivory="#FBF7F2", ink="#2A1F24")
    for k, v in (DESIGN.get("colors") or {}).items():
        if k in col and isinstance(v, str) and HEX.match(v):
            col[k] = v.upper()
    if contrast(col["berry"], col["ivory"]) < 4.5:
        print(f"WARNING: brand colour on background contrast is {contrast(col['berry'], col['ivory']):.1f}:1 (below 4.5:1); buttons and links may be hard to read.")
    fc = font_config()
    disp = resolve_font(fc.get("display"), "display", "Cormorant Garamond")
    body = resolve_font(fc.get("body"), "body", "Jost")
    faces, specs, preloads = "", [], []
    for f in (disp, body):
        if f["kind"] == "google":
            sp = google_spec(f["ent"])
            if sp not in specs:
                specs.append(sp)
        elif f["path"] not in preloads:
            ext = f["path"].rsplit(".", 1)[1]
            faces += (f'@font-face{{font-family:"{f["family"]}";src:url("../{f["path"][len("assets/"):]}") format("{FONT_FMT[ext]}");'
                      f'font-weight:100 900;font-style:normal;font-display:swap}}\n')
            if ext == "woff2":
                preloads.append(f["path"])
    href = ("https://fonts.googleapis.com/css2?" + "&".join(specs) + "&display=swap") if specs else None
    scale = SCALES.get(fc.get("scale"), 1)
    logo_h = LOGO_H.get((SITE.get("brand") or {}).get("logoHeight"), 46)
    rules = ";".join([
        f"--wb-ivory:{col['ivory']}", f"--wb-cream:{mix(col['ivory'], col['gold'], 0.16)}", f"--wb-line:{mix(col['ivory'], col['ink'], 0.12)}",
        f"--wb-ink:{col['ink']}", f"--wb-muted:{mix(col['ink'], col['ivory'], 0.38)}",
        f"--wb-berry:{col['berry']}", f"--wb-berry-deep:{darken(col['berry'], 0.74)}", f"--wb-rose:{col['rose']}", f"--wb-rose-text:{darken(col['rose'], 0.77)}", f"--wb-gold:{col['gold']}",
        f"--font-display:{disp['stack']}", f"--font-body:{body['stack']}",
        f"--w-head:{disp['w_head']}", f"--w-brand:{disp['w_brand']}", f"--h-scale:{scale}", f"--logo-h:{logo_h}px",
    ])
    return faces + ":root{" + rules + "}\n", href, preloads

# ---------------------------------------------------------------- shared layout
HEAD_SCRIPT = """<script>(function(){var r=document.documentElement,m=false;try{m=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}if(!m){r.classList.add("js-anim");if(r.hasAttribute("data-preload")){try{if(!sessionStorage.getItem("wb_seen")){r.classList.add("wb-preload");sessionStorage.setItem("wb_seen","1")}}catch(e){}}}setTimeout(function(){if(!window.WB||!window.WB.engineOn){r.classList.remove("js-anim","wb-preload")}},4500)})();</script>"""

def note(text):
    return f'<p class="placeholder-note"><strong>Note.</strong> {e(text)}</p>'


def favicon(prefix):
    fav = (SITE.get("brand") or {}).get("favicon")
    if img_ok(fav):
        return f'<link rel="icon" href="{prefix}{e(fav)}">\n<link rel="apple-touch-icon" href="{prefix}{e(fav)}">\n'
    return '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Ccircle cx=%2732%27 cy=%2732%27 r=%2729%27 fill=%27none%27 stroke=%27%23B76E79%27 stroke-width=%273%27/%3E%3Ctext x=%2732%27 y=%2741%27 font-size=%2726%27 text-anchor=%27middle%27 fill=%27%23B76E79%27 font-family=%27Georgia,serif%27%3Ewb%3C/text%3E%3C/svg%3E">\n'

def font_links(prefix):
    out = ""
    if GOOGLE_HREF:
        out += f'<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="{GOOGLE_HREF}">\n'
    for fp in FONT_PRELOADS:
        out += f'<link rel="preload" href="{prefix}{e(fp)}" as="font" type="font/woff2" crossorigin>\n'
    return out

def brand_html(prefix, dark=False):
    b = SITE.get("brand") or {}
    logo, white = None, False
    if dark and img_ok(b.get("logoDark")):
        logo = b["logoDark"]
    elif img_ok(b.get("logo")):
        logo = b["logo"]; white = dark and b.get("footerWhite", True)
    show_name = b.get("showName") or not logo
    if logo:
        mark = f'<img class="brand__logo{" brand__logo--white" if white else ""}" src="{prefix}{e(logo)}" alt="{"" if show_name else e(BRAND)}" height="{LOGO_H.get(b.get("logoHeight"), 46)}">'
    else:
        mark = '<span class="brand__mark" aria-hidden="true">wb</span>'
    name = f'<span class="brand__name">{e(BRAND)}</span>' if show_name else ""
    return mark + name

def preloader_html():
    b = SITE.get("brand") or {}
    logo = b.get("logo") if img_ok(b.get("logo")) else None
    inner = ('<img class="preloader__logo" src="' + e(logo) + '" alt="">') if logo else ""
    text = "" if logo else '<text class="preloader__text" x="60" y="73" text-anchor="middle">wb</text>'
    name = f'<span class="preloader__name">{e(BRAND)}</span>' if (b.get("showName") or not logo) else ""
    return f'<div class="preloader" aria-hidden="true"><div class="preloader__stage"><svg class="preloader__mark" viewBox="0 0 120 120"><circle class="preloader__ring" cx="60" cy="60" r="50"/>{text}</svg>{inner}</div>{name}</div>'

def nav_items():
    return [("about.html", NAV.get("about") or "About"), ("services.html", NAV.get("services") or "Services"),
            ("portfolio.html", NAV.get("portfolio") or "Portfolio"), ("team.html", NAV.get("team") or "Team")]

def header(current, prefix):
    items = "".join(f'<li><a class="nav__link" href="{prefix}{h}"' + (' aria-current="page"' if h == current else "") + f">{e(l)}</a></li>" for h, l in nav_items())
    cur = ' aria-current="page"' if current == "contact.html" else ""
    return f'''<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="{prefix}index.html" aria-label="{e(BRAND)}, home">{brand_html(prefix)}</a>
    <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span class="nav-toggle__bars"></span></button>
    <nav class="nav" id="site-nav" data-nav aria-label="Main"><ul class="nav__list">{items}<li><a class="btn btn--sm" href="{prefix}contact.html"{cur} data-magnetic>{e(NAV.get("cta") or "Enquire")}</a></li></ul></nav>
  </div>
</header>'''

def footer(prefix):
    foot = [("testimonials.html", "Testimonials"), ("faq.html", "FAQ"), ("privacy-policy.html", "Privacy"), ("terms.html", "Terms")]
    links = "".join(f'<li><a href="{prefix}{h}">{l}</a></li>' for h, l in foot)
    soc = "".join(f'<li><a href="{e(link(SOCIAL[k]))}" target="_blank" rel="noopener">{lab}</a></li>' for k, lab in
                  [("facebook", "Facebook"), ("instagram", "Instagram"), ("youtube", "YouTube"), ("tiktok", "TikTok"), ("pinterest", "Pinterest")] if real(SOCIAL.get(k)))
    contact = []
    if real(CONTACT.get("email")): contact.append(f'<a href="mailto:{e(CONTACT["email"])}">{e(CONTACT["email"])}</a>')
    if real(CONTACT.get("phone")): contact.append(f'<a href="tel:{e(re.sub(r"[^0-9+]", "", CONTACT["phone"]))}">{e(CONTACT["phone"])}</a>')
    if real(CONTACT.get("address")): contact.append(e(CONTACT["address"]))
    crow = f'<p class="site-footer__contact">{" &middot; ".join(contact)}</p>' if contact else ""
    srow = f'<ul class="site-footer__links site-footer__social">{soc}</ul>' if soc else ""
    copy = (pg("footer").get("copyright") or f"{BRAND}. All rights reserved.")
    return f'''<footer class="site-footer"><div class="container">
  <div class="site-footer__row"><a class="brand" href="{prefix}index.html">{brand_html(prefix, True)}</a><ul class="site-footer__links">{links}</ul></div>
  {crow}{srow}
  <p class="site-footer__copy">&copy; <span data-year>2026</span> {e(copy)}</p>
</div></footer>'''

def whatsapp():
    if not CONTACT.get("showWhatsapp"):
        return ""
    num = re.sub(r"[^0-9]", "", CONTACT.get("whatsapp") or CONTACT.get("phone") or "")
    if not num:
        return ""
    text = urllib.parse.quote(CONTACT.get("whatsappText") or "")
    return f'<a class="wa-btn" href="https://wa.me/{num}?text={text}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3 4.1c-.2 0-.5.1-.7.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4l-.5-.3-1.8-.9c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.4-1.8-.2-.3 0-.4.1-.5l.4-.5.3-.4v-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4z"/></svg></a>'

def analytics():
    gid = (SITE.get("analyticsId") or "").strip()
    if not re.match(r"^G-[A-Z0-9]{6,14}$", gid):
        return ""
    return f'<script async src="https://www.googletagmanager.com/gtag/js?id={gid}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag("js",new Date());gtag("config","{gid}");</script>\n'

DESIGN_CSS, GOOGLE_HREF, FONT_PRELOADS = design_css()
FX_FLAGS = " ".join("no-" + k for k in ("petals", "cursor", "pageTransitions") if FX.get(k) is False).replace("pageTransitions", "transitions")

def page(file, title, desc, body, *, noindex=False, preload=False, features=(), prefix="", jsonld=None):
    full_title = BRAND if file == "index.html" else f"{title} | {BRAND}"
    url = f'{DOMAIN}/{"" if file == "index.html" else file}'
    robots = '<meta name="robots" content="noindex">\n' if noindex else ""
    css = "".join(f'<link rel="stylesheet" href="{prefix}assets/css/{n}.css">\n' for n in ("tokens", "design.generated", "base", "components", "animations", "features"))
    core = ["animations/core", "core/main", "animations/engine", "animations/petals", "animations/preloader", "animations/interactions"]
    scripts = "".join(f'<script src="{prefix}assets/js/{n}.js" defer></script>\n' for n in core + [f"features/{f}" for f in features])
    ld = f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>\n' if jsonld else ""
    preload = preload and FX.get("preloader") is not False
    attrs = (" data-preload" if preload else "") + (f' data-fx="{FX_FLAGS}"' if FX_FLAGS else "")
    return f'''<!DOCTYPE html>
<html lang="en"{attrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(full_title)}</title>
<meta name="description" content="{e(desc)}">
{robots}<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{e(BRAND)}">
<meta property="og:title" content="{e(full_title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta name="theme-color" content="{DESIGN_COLORS['ivory']}">
{HEAD_SCRIPT}
{favicon(prefix)}{font_links(prefix)}{css}{ld}{analytics()}</head>
<body>
{preloader_html() if preload else ""}
{header(file, prefix)}
<main id="main">
{body}
</main>
{footer(prefix)}
{whatsapp()}
<script src="{prefix}config/site-config.js" defer></script>
{scripts}</body>
</html>
'''

DESIGN_COLORS = dict(ivory="#FBF7F2")
_m = re.search(r"--wb-ivory:(#[0-9A-Fa-f]{6})", DESIGN_CSS)
if _m: DESIGN_COLORS["ivory"] = _m.group(1)

# ---------------------------------------------------------------- blocks
def head(eyebrow, h2, lead="", center=False):
    cls = "section-head" + (" section-head--center" if center else "")
    eb = f'<span class="eyebrow" data-anim="fade-up">{e(eyebrow)}</span>' if eyebrow else ""
    ld = f'<p class="lead" data-anim="fade-up" data-delay="0.25">{e(lead)}</p>' if lead else ""
    return f'<div class="{cls}">{eb}<h2 data-anim="words">{e(h2)}</h2>{ld}</div>'

def page_hero(eyebrow, h1, lead=""):
    eb = f'<span class="eyebrow" data-anim="fade-up">{e(eyebrow)}</span>' if eyebrow else ""
    ld = f'<p class="lead" data-anim="fade-up" data-delay="0.55">{e(lead)}</p>' if lead else ""
    return f'<section class="page-hero"><div class="container">{eb}<h1 data-anim="words" data-delay="0.1">{e(h1)}</h1>{ld}</div></section>'

def btn(b, cls="", extra=""):
    b = b or {}
    if not (b.get("text") or "").strip():
        return ""
    return f'<a class="btn {cls}" href="{e(link(b.get("link")))}" {extra}>{e(b["text"])}</a>'.replace("  ", " ")

def cta():
    c = pg("cta")
    b1 = btn(c.get("btn1"), "", "data-magnetic data-burst")
    b2 = btn(c.get("btn2"), "btn--ghost", "data-magnetic")
    row = f'<div class="btn-row" data-anim="fade-up" data-delay="0.4">{b1}{b2}</div>' if (b1 or b2) else ""
    petals = "" if FX.get("petals") is False else " data-petals"
    txt = f'<p class="lead" data-anim="fade-up" data-delay="0.25">{e(c.get("text"))}</p>' if c.get("text") else ""
    return f'''<section class="section section--dark cta"{petals}><div class="container container--narrow">
  <span class="eyebrow" data-anim="fade-up">{e(c.get("eyebrow") or "Begin here")}</span><h2 data-anim="words">{e(c.get("title") or "")}</h2>{txt}{row}
</div></section>'''

def numbered(items, links=None):
    li = ""
    for i, it in enumerate(items, 1):
        t = e(it.get("title"))
        if links and links[i - 1]:
            t = f'<a href="{links[i - 1]}" class="numbered__link">{t}</a>'
        li += f'<li class="numbered__item"><span class="numbered__num">{i:02d}</span><h3 class="numbered__title">{t}</h3><p>{e(it.get("text") or it.get("summary"))}</p></li>'
    return f'<ol class="numbered" data-stagger="0.12">{li}</ol>' if li else ""

def media(path, aria="Image"):
    if not img_ok(path):
        return f'<div class="split__media" data-anim="clip-up" role="img" aria-label="{e(aria)}"></div>'
    return f'<div class="split__media" data-anim="clip-up"><div class="parallax-wrap" data-parallax="0.07">{img(path)}</div></div>'

def project_card(i):
    p = PROJECTS[i]; slug = PROJECT_SLUGS[i]
    cat = slugify(p.get("category")) if p.get("category") else ""
    media_html = img(p.get("cover") or (p.get("images") or [""])[0])
    return (f'<a class="card" href="project-{slug}.html" data-cursor="View" data-cat="{cat}"><div class="card__media" data-tilt>{media_html}</div>'
            f'<div class="card__meta"><span class="card__kicker">{e(p.get("venue") or p.get("category"))}</span><h3 class="card__title">{e(p.get("title"))}</h3></div></a>')

def gallery_item(path, caption, cat=""):
    if not img_ok(path):
        return ""
    return f'<a class="masonry__item" href="{e(path)}" data-lightbox data-cat="{cat}" data-caption="{e(caption)}">{img(path, caption)}</a>'

OUT_PAGES = {}   # filename -> html

def add(file, title, desc, body, **kw):
    OUT_PAGES[file] = page(file, title, desc, body, **kw)

# ---------------------------------------------------------------- pages
def build_home():
    h = pg("home"); parts = []
    marquee = [m.get("text") for m in (h.get("marquee") or []) if (m.get("text") or "").strip()]
    petals = "" if FX.get("petals") is False else " data-petals"
    parts.append(f'''<section class="hero"{petals}>
  <div class="hero__glow hero__glow--a"></div><div class="hero__glow hero__glow--b"></div><div class="hero__overlay"></div>
  <div class="container"><div class="hero__inner" data-hero-scroll>
    <span class="eyebrow" data-anim="fade-up" data-delay="0.1">{e(h.get("eyebrow"))}</span>
    <h1 data-anim="words" data-delay="0.2">{e(h.get("title"))}</h1>
    <p class="lead" data-anim="fade-up" data-delay="0.9">{e(h.get("lead"))}</p>
    <div class="btn-row" data-anim="fade-up" data-delay="1.1">{btn(h.get("btn1"), "", "data-magnetic")}{btn(h.get("btn2"), "btn--ghost", "data-magnetic")}</div>
  </div></div>
  <span class="hero__scroll" aria-hidden="true">Scroll</span>
</section>''')
    if marquee and FX.get("marquee") is not False:
        items = "".join(f'<span class="marquee__item">{e(t)}</span>' for _ in range(6) for t in marquee)
        parts.append(f'<div class="marquee" aria-hidden="true"><div class="marquee__track">{items}</div></div>')
    if h.get("showStats", True) and h.get("stats"):
        cells = ""
        for s in h["stats"]:
            v, suf = str(s.get("value") or "").strip(), s.get("suffix") or ""
            if re.fullmatch(r"\d+(\.\d+)?", v):
                dec = len(v.split(".")[1]) if "." in v else 0
                shown = f"{float(v):,.{dec}f}{suf}"
                cells += f'<div><div class="stat__value" data-count="{v}" data-suffix="{e(suf)}"' + (f' data-decimals="{dec}"' if dec else "") + f'>{e(shown)}</div><div class="stat__label">{e(s.get("label"))}</div></div>'
            else:
                cells += f'<div><div class="stat__value">{e(v + suf)}</div><div class="stat__label">{e(s.get("label"))}</div></div>'
        parts.append(f'<section class="section"><div class="container"><div class="stats" data-stagger="0.12">{cells}</div></div></section>')
    if h.get("showServices", True) and SERVICES:
        top = SERVICES[:3]
        parts.append(f'''<section class="section section--alt"><div class="container">{head(h.get("servicesEyebrow"), h.get("servicesTitle"), h.get("servicesLead"))}
  {numbered(top, [f"service-{SERVICE_SLUGS[i]}.html" for i in range(len(top))])}
  <div class="btn-row"><a class="text-link" href="services.html">All services</a></div></div></section>''')
    if h.get("showWork", True) and PROJECTS:
        feat = [i for i, p in enumerate(PROJECTS) if p.get("featured")][:3] or list(range(min(3, len(PROJECTS))))
        parts.append(f'''<section class="section"><div class="container">{head(h.get("workEyebrow"), h.get("workTitle"))}
  <div class="grid grid--3" data-stagger="0.15">{"".join(project_card(i) for i in feat)}</div>
  <div class="btn-row"><a class="text-link" href="portfolio.html">View all projects</a></div></div></section>''')
    if h.get("showAbout", True):
        parts.append(f'''<section class="section section--alt"><div class="container"><div class="split">{media(h.get("aboutImage"))}
  <div class="stack"><span class="eyebrow" data-anim="fade-up">{e(h.get("aboutEyebrow"))}</span><h2 data-anim="words">{e(h.get("aboutTitle"))}</h2><p class="lead" data-anim="fade-up" data-delay="0.25">{e(h.get("aboutLead"))}</p><a class="text-link" href="about.html" data-anim="fade-up" data-delay="0.4">Our story</a></div></div></div></section>''')
    if h.get("showCountdown", True):
        parts.append(f'''<section class="section countdown" data-countdown><div class="container container--narrow">
  <span class="eyebrow" data-anim="fade-up">{e(h.get("countdownEyebrow"))}</span><h2 data-anim="words">{e(h.get("countdownTitle"))}</h2>
  <label class="countdown__label" for="wb-date">Choose your wedding date</label><input class="countdown__input" id="wb-date" type="date"><p class="countdown__sentence" aria-live="polite"></p>
  <div class="countdown__grid" aria-hidden="true">
    <div class="countdown__cell"><span class="countdown__num" data-cd="d">0</span><span class="countdown__unit">Days</span></div>
    <div class="countdown__cell"><span class="countdown__num" data-cd="h">00</span><span class="countdown__unit">Hours</span></div>
    <div class="countdown__cell"><span class="countdown__num" data-cd="m">00</span><span class="countdown__unit">Minutes</span></div>
    <div class="countdown__cell"><span class="countdown__num" data-cd="s">00</span><span class="countdown__unit">Seconds</span></div></div>
  <div class="btn-row" style="justify-content:center"><a class="btn btn--ghost" href="contact.html" data-magnetic>Enquire about your date</a></div></div></section>''')
    if h.get("showTestimonial", True) and TESTI:
        t = next((x for x in TESTI if x.get("featured")), TESTI[0])
        parts.append(f'''<section class="section section--alt"><div class="container container--narrow" style="text-align:center"><span class="eyebrow" data-anim="fade-up">{e(pg("testimonials").get("eyebrow") or "Kind words")}</span>
  <p class="quote" data-anim="fade-up" data-delay="0.15">&ldquo;{e(t.get("quote"))}&rdquo;</p><p class="quote-by" data-anim="fade-up" data-delay="0.3">{e(t.get("names"))}</p></div></section>''')
    parts.append(cta())
    org = {"@context": "https://schema.org", "@type": "Organization", "name": BRAND, "url": DOMAIN + "/"}
    if real(CONTACT.get("email")): org["email"] = CONTACT["email"]
    add("index.html", BRAND, (SITE.get("seo") or {}).get("description") or h.get("lead") or "", "\n".join(parts), preload=True, features=("countdown",), jsonld=org)

def build_about():
    a = pg("about")
    story = "".join(f'<p data-anim="fade-up" data-delay="{0.2 + i * 0.1:.1f}">{e(p)}</p>' for i, p in enumerate(paras(a.get("story"))))
    body = page_hero(a.get("eyebrow"), a.get("title"), a.get("lead"))
    body += f'<section class="section"><div class="container"><div class="split">{media(a.get("image"))}<div class="stack"><span class="eyebrow" data-anim="fade-up">{e(a.get("storyEyebrow"))}</span><h2 data-anim="words">{e(a.get("storyTitle"))}</h2>{story}</div></div></div></section>'
    if a.get("principles"):
        body += f'<section class="section section--alt"><div class="container">{head(a.get("principlesEyebrow"), a.get("principlesTitle"))}{numbered(a["principles"])}</div></section>'
    if a.get("showTimeline", True) and a.get("timeline"):
        li = "".join(f'<li class="timeline__item" data-anim="fade-up"><span class="timeline__year">{e(t.get("year"))}</span><h3>{e(t.get("title"))}</h3><p>{e(t.get("text"))}</p></li>' for t in a["timeline"])
        body += f'<section class="section"><div class="container">{head(a.get("timelineEyebrow"), a.get("timelineTitle"))}<div class="timeline" data-timeline><div class="timeline__line" aria-hidden="true"><span></span></div><ol style="list-style:none">{li}</ol></div></div></section>'
    add("about.html", "About", a.get("lead") or "About " + BRAND, body + cta())

def build_services():
    s = pg("services")
    body = page_hero(s.get("eyebrow"), s.get("title"), s.get("lead"))
    body += f'<section class="section"><div class="container">{numbered(SERVICES, [f"service-{x}.html" for x in SERVICE_SLUGS])}</div></section>'
    if s.get("process"):
        body += f'<section class="section section--alt"><div class="container">{head(s.get("processEyebrow"), s.get("processTitle"))}{numbered(s["process"])}</div></section>'
    add("services.html", "Services", s.get("lead") or "Our services", body + cta())
    for i, sv in enumerate(SERVICES):
        body = page_hero("Service", sv.get("title"), sv.get("summary"))
        body += f'<section class="section"><div class="container"><div class="split"><div class="stack"><h2 data-anim="words">{e(sv.get("title"))}</h2>{ptags(sv.get("description"))}<p><a class="text-link" href="services.html">All services</a></p></div>{media(sv.get("image"))}</div></div></section>'
        add(f"service-{SERVICE_SLUGS[i]}.html", sv.get("title") or "Service", sv.get("summary") or "", body + cta())

def build_portfolio():
    p = pg("portfolio")
    cats, seen = [], set()
    for pr in PROJECTS:
        c = (pr.get("category") or "").strip()
        if c and slugify(c) not in seen:
            seen.add(slugify(c)); cats.append(c)
    chips = ""
    if len(cats) > 1:
        chips = '<div class="chips" role="group" aria-label="Filter projects"><button class="chip" type="button" data-filter="all" aria-pressed="true">' + e(p.get("allLabel") or "All") + "</button>" + \
                "".join(f'<button class="chip" type="button" data-filter="{slugify(c)}" aria-pressed="false">{e(c)}</button>' for c in cats) + "</div>"
    grid = "".join(project_card(i) for i in range(len(PROJECTS)))
    body = page_hero(p.get("eyebrow"), p.get("title"), p.get("lead")) + f'<section class="section"><div class="container">{chips}<div class="grid grid--3" data-stagger="0.1">{grid}</div></div></section>' + cta()
    add("portfolio.html", "Portfolio", p.get("lead") or "Our work", body, features=("gallery",))
    for i, pr in enumerate(PROJECTS):
        imgs = [x for x in (pr.get("images") or []) if img_ok(x)] or ([pr["cover"]] if img_ok(pr.get("cover")) else [])
        items = "".join(gallery_item(x, pr.get("title") or "", "") for x in imgs)
        sub = " \u00b7 ".join(x for x in [pr.get("venue"), pr.get("date")] if x)
        story = ptags(pr.get("story"))
        body = page_hero(pr.get("category") or "Project", pr.get("title"), sub)
        body += f'<section class="section"><div class="container"><div class="masonry" data-gallery data-stagger="0.08">{items}</div>' + \
                (f'<div class="container--narrow stack" style="margin:3rem auto 0" data-anim="fade-up">{story}</div>' if story else "") + \
                '<div class="btn-row" style="margin-top:2rem"><a class="text-link" href="portfolio.html">All projects</a></div></div></section>'
        add(f"project-{PROJECT_SLUGS[i]}.html", pr.get("title") or "Project", (paras(pr.get("story")) or [pr.get("venue") or ""])[0], body + cta(), features=("gallery",))

def build_team():
    t = pg("team")
    def card(m):
        ph = img(m.get("photo"), m.get("name") or "", cls="avatar-img") if img_ok(m.get("photo")) else '<div class="avatar-ph"></div>'
        return f'<div>{ph}<h3>{e(m.get("name"))}</h3><p class="card__kicker">{e(m.get("role"))}</p><p>{e(m.get("bio"))}</p></div>'
    body = page_hero(t.get("eyebrow"), t.get("title"), t.get("lead")) + f'<section class="section"><div class="container"><div class="grid grid--3" data-stagger="0.15">{"".join(card(m) for m in TEAM)}</div></div></section>' + cta()
    add("team.html", "Team", t.get("lead") or "Our team", body)

def build_testimonials():
    t = pg("testimonials")
    rows = "".join(f'<div data-anim="fade-up" class="testi"><p class="quote">&ldquo;{e(x.get("quote"))}&rdquo;</p><p class="quote-by">{e(x.get("names"))}{(" &middot; " + e(x.get("event"))) if x.get("event") else ""}</p></div>' for x in TESTI)
    body = page_hero(t.get("eyebrow"), t.get("title"), t.get("lead")) + f'<section class="section"><div class="container container--narrow">{rows}</div></section>' + cta()
    add("testimonials.html", "Testimonials", "Kind words from " + BRAND + " couples.", body)

def build_contact():
    c = pg("contact"); lines = []
    def row(label, value, href=""):
        if not real(value): return ""
        v = f'<a href="{e(href)}">{e(value)}</a>' if href else e(value)
        return f'<p><span class="contact-label">{label}</span>{v}</p>'
    lines.append(row("Email", CONTACT.get("email"), "mailto:" + (CONTACT.get("email") or "")))
    lines.append(row("Phone / WhatsApp", CONTACT.get("phone"), "tel:" + re.sub(r"[^0-9+]", "", CONTACT.get("phone") or "")))
    lines.append(row("Studio", CONTACT.get("address"), link(CONTACT.get("mapLink"), "")))
    lines.append(row("Response time", c.get("responseTime")))
    mp = ""
    if real(CONTACT.get("mapQuery")):
        mp = f'<div class="map" data-anim="fade-up"><iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q={urllib.parse.quote(CONTACT["mapQuery"])}&amp;output=embed"></iframe></div>'
    body = page_hero(c.get("eyebrow"), c.get("title"), c.get("lead"))
    body += f'''<section class="section"><div class="container"><div class="split" style="align-items:start">
  <div class="stack" data-anim="fade-up"><h2>{e(c.get("directTitle"))}</h2>{"".join(lines)}</div>
  <div class="stack" data-anim="fade-up" data-delay="0.15"><h2>{e(c.get("formTitle"))}</h2><p>{e(c.get("formNote"))}</p></div></div>{mp}</div></section>'''
    add("contact.html", "Contact", c.get("lead") or "Contact " + BRAND, body)

def build_faq():
    f = pg("faq")
    items = "".join(f'<details><summary>{e(x.get("q"))}</summary><div><p>{e(x.get("a"))}</p></div></details>' for x in FAQ)
    ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": x.get("q"), "acceptedAnswer": {"@type": "Answer", "text": x.get("a")}} for x in FAQ if real(x.get("q"))]}
    body = page_hero(f.get("eyebrow"), f.get("title"), f.get("lead")) + f'<section class="section"><div class="container container--narrow"><div class="faq" data-stagger="0.08">{items}</div></div></section>' + cta()
    add("faq.html", "FAQ", "Frequently asked questions about " + BRAND + ".", body, jsonld=ld if ld["mainEntity"] else None)

def build_legal():
    leg = pg("legal")
    for file, key, title in (("privacy-policy.html", "privacy", "Privacy policy"), ("terms.html", "terms", "Terms")):
        text = ptags(leg.get(key))
        body = page_hero("Legal", title) + f'<section class="section"><div class="container container--narrow stack">' + (text or note(f"The {title.lower()} text has not been added yet. Add it in the Control Panel under Page text.")) + "</div></section>"
        add(file, title, f"{title} of {BRAND}.", body)

def build_404():
    body = '''<section class="section"><div class="container container--narrow" style="text-align:center"><span class="eyebrow">Error 404</span><h1>This page has wandered off</h1>
<p class="lead" style="margin-inline:auto">The page you are looking for does not exist or has moved.</p><div class="btn-row" style="justify-content:center"><a class="btn" href="/index.html">Back to home</a></div></div></section>'''
    OUT_PAGES["404.html"] = page("404.html", "Page not found", "This page could not be found.", body, noindex=True, prefix="/")

# ---------------------------------------------------------------- placeholders report
def placeholders():
    found = {}
    def walk(v, where):
        if isinstance(v, dict):
            for k, x in v.items(): walk(x, where)
        elif isinstance(v, list):
            for x in v: walk(x, where)
        elif isinstance(v, str) and v.strip().startswith("[") and v.strip().endswith("]"):
            found[where] = found.get(where, 0) + 1
    for name in ("site", "pages", "services", "projects", "team", "testimonials", "faq"):
        walk(load(name + ".json", {}), name)
    return found

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", default="dist"); a = ap.parse_args()
    out = (ROOT / a.out).resolve()
    if out == ROOT or ROOT in out.parents and out.name in ("assets", "content", "tools", "admin"):
        sys.exit("Refusing to write into a source folder.")
    shutil.rmtree(out, ignore_errors=True); out.mkdir(parents=True)
    build_home(); build_about(); build_services(); build_portfolio(); build_team(); build_testimonials(); build_contact(); build_faq(); build_legal(); build_404()
    for fn, html_ in OUT_PAGES.items():
        (out / fn).write_text(html_, encoding="utf-8")
    for d in ("assets", "config", "admin"):
        if (ROOT / d).exists(): shutil.copytree(ROOT / d, out / d)
    (out / "assets" / "css" / "design.generated.css").write_text("/* Generated from content/design.json. Do not edit. */\n" + DESIGN_CSS, encoding="utf-8")
    urls = [f for f in OUT_PAGES if f != "404.html"]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>{DOMAIN}/{'' if f == 'index.html' else f}</loc></url>\n" for f in urls) + "</urlset>\n"
    (out / "sitemap.xml").write_text(sm, encoding="utf-8")
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: {DOMAIN}/sitemap.xml\n", encoding="utf-8")
    (out / ".nojekyll").write_text("", encoding="utf-8")
    ph = placeholders()
    print(f"Built {len(OUT_PAGES)} pages into {out.relative_to(ROOT) if ROOT in out.parents else out}")
    if ph: print("Placeholders still to fill:", ", ".join(f"{k}: {v}" for k, v in sorted(ph.items())))

if __name__ == "__main__":
    main()
