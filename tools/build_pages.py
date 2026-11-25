#!/usr/bin/env python3
"""Generates the static public pages from shared layout + per-page content.

Keeps header/footer/scripts identical on every page while shipping real HTML
(titles, meta, content) in the initial source for SEO.
Usage:  python3 tools/build_pages.py
Content marked "[ ... ]" is PLACEHOLDER and must be replaced via the Admin panel (later phases).
"""
import html
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "Wedding Berries"
DOMAIN = "https://weddingberriesbd.com"

NAV = [("about.html", "About"), ("services.html", "Services"), ("portfolio.html", "Portfolio"), ("team.html", "Team")]
FOOT = [("testimonials.html", "Testimonials"), ("faq.html", "FAQ"), ("privacy-policy.html", "Privacy"), ("terms.html", "Terms")]

# placeholder image sizes (file number -> (w, h)); see tools/make_placeholders.py
IMG = {1: (800, 1000), 2: (1200, 800), 3: (1000, 1000), 4: (800, 1000), 5: (1200, 800), 6: (800, 1000), 7: (1000, 1000), 8: (1200, 800), 9: (800, 1000)}

HEAD_SCRIPT = """<script>(function(){var r=document.documentElement,m=false;try{m=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}if(!m){r.classList.add("js-anim");if(r.hasAttribute("data-preload")){try{if(!sessionStorage.getItem("wb_seen")){r.classList.add("wb-preload");sessionStorage.setItem("wb_seen","1")}}catch(e){}}}setTimeout(function(){if(!window.WB||!window.WB.engineOn){r.classList.remove("js-anim","wb-preload")}},4500)})();</script>"""

PRELOADER = """<div class="preloader" aria-hidden="true">
  <svg class="preloader__mark" viewBox="0 0 120 120"><circle class="preloader__ring" cx="60" cy="60" r="50"/><text class="preloader__text" x="60" y="73" text-anchor="middle">wb</text></svg>
  <span class="preloader__name">Wedding Berries</span>
</div>"""


def e(s):
    return html.escape(s, quote=True)


def note(text):
    return f'<p class="placeholder-note"><strong>Placeholder.</strong> {e(text)}</p>'


def img(n, alt="Placeholder wedding photograph", lazy=True):
    w, h = IMG[n]
    return f'<img src="assets/images/placeholder-{n:02d}.svg" alt="{e(alt)}" width="{w}" height="{h}"' + (' loading="lazy"' if lazy else "") + ">"


def header(current, prefix):
    items = "".join(
        f'<li><a class="nav__link" href="{prefix}{href}"' + (' aria-current="page"' if href == current else "") + f">{label}</a></li>"
        for href, label in NAV
    )
    cta_cur = ' aria-current="page"' if current == "contact.html" else ""
    return f'''<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="{prefix}index.html" aria-label="Wedding Berries, home">
      <span class="brand__mark" aria-hidden="true">wb</span>
      <span class="brand__name">Wedding Berries</span>
    </a>
    <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span class="nav-toggle__bars"></span></button>
    <nav class="nav" id="site-nav" data-nav aria-label="Main">
      <ul class="nav__list">{items}<li><a class="btn btn--sm" href="{prefix}contact.html"{cta_cur} data-magnetic>Enquire</a></li></ul>
    </nav>
  </div>
</header>'''


def footer(prefix):
    links = "".join(f'<li><a href="{prefix}{h}">{l}</a></li>' for h, l in FOOT)
    return f'''<footer class="site-footer">
  <div class="container">
    <div class="site-footer__row">
      <a class="brand" href="{prefix}index.html"><span class="brand__mark" aria-hidden="true">wb</span><span class="brand__name">Wedding Berries</span></a>
      <ul class="site-footer__links">{links}</ul>
    </div>
    <p class="site-footer__copy">&copy; <span data-year>2026</span> Wedding Berries. All rights reserved.</p>
  </div>
</footer>'''


def page(file, title, desc, body, *, prefix="", noindex=False, preload=False, features=()):
    full_title = SITE if file == "index.html" else f"{title} | {SITE}"
    robots = '<meta name="robots" content="noindex">\n' if noindex else ""
    url = f'{DOMAIN}/{"" if file == "index.html" else file}'
    css = "".join(f'<link rel="stylesheet" href="{prefix}assets/css/{n}.css">\n' for n in ("tokens", "base", "components", "animations", "features"))
    core = ["animations/core", "core/main", "animations/engine", "animations/petals", "animations/preloader", "animations/interactions"]
    scripts = "".join(f'<script src="{prefix}assets/js/{n}.js" defer></script>\n' for n in core + [f"features/{f}" for f in features])
    return f'''<!DOCTYPE html>
<html lang="en"{" data-preload" if preload else ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(full_title)}</title>
<meta name="description" content="{e(desc)}">
{robots}<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{SITE}">
<meta property="og:title" content="{e(full_title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta name="theme-color" content="#FBF7F2">
{HEAD_SCRIPT}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500&display=swap">
{css}</head>
<body>
{PRELOADER if preload else ""}
{header(file, prefix)}
<main id="main">
{body}
</main>
{footer(prefix)}
<script src="{prefix}config/site-config.js" defer></script>
{scripts}</body>
</html>
'''


def head(eyebrow, h2, lead="", center=False):
    cls = "section-head" + (" section-head--center" if center else "")
    lead_html = f'<p class="lead" data-anim="fade-up" data-delay="0.25">{e(lead)}</p>' if lead else ""
    return f'<div class="{cls}"><span class="eyebrow" data-anim="fade-up">{e(eyebrow)}</span><h2 data-anim="words">{e(h2)}</h2>{lead_html}</div>'


def page_hero(eyebrow, h1, lead=""):
    lead_html = f'<p class="lead" data-anim="fade-up" data-delay="0.55">{e(lead)}</p>' if lead else ""
    return f'''<section class="page-hero"><div class="container">
  <span class="eyebrow" data-anim="fade-up">{e(eyebrow)}</span>
  <h1 data-anim="words" data-delay="0.1">{e(h1)}</h1>
  {lead_html}
</div></section>'''


def cta(heading="Let\u2019s plan your day", lead="[Short invitation to get in touch.]"):
    return f'''<section class="section section--dark cta" data-petals><div class="container container--narrow">
  <span class="eyebrow" data-anim="fade-up">Begin here</span>
  <h2 data-anim="words">{e(heading)}</h2>
  <p class="lead" data-anim="fade-up" data-delay="0.25">{e(lead)}</p>
  <div class="btn-row" data-anim="fade-up" data-delay="0.4"><a class="btn" href="contact.html" data-magnetic data-burst>Enquire now</a><a class="btn btn--ghost" href="portfolio.html" data-magnetic>View our work</a></div>
</div></section>'''


def numbered(items):
    li = "".join(
        f'<li class="numbered__item"><span class="numbered__num">{i:02d}</span><h3 class="numbered__title">{e(t)}</h3><p>{e(p)}</p></li>'
        for i, (t, p) in enumerate(items, 1)
    )
    return f'<ol class="numbered" data-stagger="0.12">{li}</ol>'


def project_cards(n, link="portfolio-details.html"):
    order = [1, 4, 6, 9, 3, 7]
    return "".join(
        f'''<a class="card" href="{link}" data-cursor="View"><div class="card__media" data-tilt>{img(order[i % len(order)])}</div>
<div class="card__meta"><span class="card__kicker">[Venue or city]</span><h3 class="card__title">[Couple names]</h3></div></a>'''
        for i in range(n)
    )


def parallax_media(n):
    return f'<div class="split__media" data-anim="clip-up" role="img" aria-label="Image placeholder"><div class="parallax-wrap" data-parallax="0.07">{img(n)}</div></div>'


PAGES = {}

# ---------------- Home ----------------
PAGES["index.html"] = dict(
    title="Wedding Berries",
    desc="Wedding Berries creates unforgettable wedding experiences. Your story, our art.",
    preload=True,
    features=("countdown",),
    body=f'''<section class="hero" data-petals>
  <div class="hero__glow hero__glow--a"></div><div class="hero__glow hero__glow--b"></div>
  <div class="hero__overlay"></div>
  <div class="container"><div class="hero__inner" data-hero-scroll>
    <span class="eyebrow" data-anim="fade-up" data-delay="0.1">Your story, our art</span>
    <h1 data-anim="words" data-delay="0.2">Every Love Story Deserves a Beautiful Beginning</h1>
    <p class="lead" data-anim="fade-up" data-delay="0.9">Creating unforgettable wedding experiences.</p>
    <div class="btn-row" data-anim="fade-up" data-delay="1.1"><a class="btn" href="portfolio.html" data-magnetic>Explore our work</a><a class="btn btn--ghost" href="contact.html" data-magnetic>Enquire</a></div>
  </div></div>
  <span class="hero__scroll" aria-hidden="true">Scroll</span>
</section>
<div class="marquee" aria-hidden="true"><div class="marquee__track">
  {"".join('<span class="marquee__item">Your story, our art</span><span class="marquee__item">Wedding Berries</span>' for _ in range(6))}
</div></div>
<section class="section"><div class="container">
  <div class="stats" data-stagger="0.12">
    <div><div class="stat__value" data-count="250" data-suffix="+">250+</div><div class="stat__label">[Stat label]</div></div>
    <div><div class="stat__value" data-count="12">12</div><div class="stat__label">[Stat label]</div></div>
    <div><div class="stat__value" data-count="1200" data-suffix="+">1,200+</div><div class="stat__label">[Stat label]</div></div>
    <div><div class="stat__value" data-count="8" data-suffix=" yrs">8 yrs</div><div class="stat__label">[Stat label]</div></div>
  </div>
  {note("These numbers are SAMPLE values to demonstrate the count-up animation. Replace them and the labels with the real figures.")}
</div></section>
<section class="section section--alt"><div class="container">
  {head("What we do", "[Services headline]", "[One sentence introducing the services.]")}
  {numbered([("[Service one]", "[Short description of this service.]"), ("[Service two]", "[Short description of this service.]"), ("[Service three]", "[Short description of this service.]")])}
  <div class="btn-row"><a class="text-link" href="services.html">All services</a></div>
</div></section>
<section class="section"><div class="container">
  {head("Selected work", "[Portfolio headline]")}
  <div class="grid grid--3" data-stagger="0.15">{project_cards(3)}</div>
  <div class="btn-row"><a class="text-link" href="portfolio.html">View all projects</a></div>
</div></section>
<section class="section section--alt"><div class="container">
  <div class="split">
    {parallax_media(5)}
    <div class="stack"><span class="eyebrow" data-anim="fade-up">About us</span><h2 data-anim="words">[About headline]</h2><p class="lead" data-anim="fade-up" data-delay="0.25">[Two or three sentences about Wedding Berries.]</p><a class="text-link" href="about.html" data-anim="fade-up" data-delay="0.4">Our story</a></div>
  </div>
</div></section>
<section class="section countdown" data-countdown><div class="container container--narrow">
  <span class="eyebrow" data-anim="fade-up">Your big day</span>
  <h2 data-anim="words">How many days until \u201cI do\u201d?</h2>
  <label class="countdown__label" for="wb-date">Choose your wedding date</label>
  <input class="countdown__input" id="wb-date" type="date">
  <p class="countdown__sentence" aria-live="polite"></p>
  <div class="countdown__grid" aria-hidden="true">
    <div class="countdown__cell"><span class="countdown__num" data-cd="d">0</span><span class="countdown__unit">Days</span></div>
    <div class="countdown__cell"><span class="countdown__num" data-cd="h">00</span><span class="countdown__unit">Hours</span></div>
    <div class="countdown__cell"><span class="countdown__num" data-cd="m">00</span><span class="countdown__unit">Minutes</span></div>
    <div class="countdown__cell"><span class="countdown__num" data-cd="s">00</span><span class="countdown__unit">Seconds</span></div>
  </div>
  <div class="btn-row" style="justify-content:center"><a class="btn btn--ghost" href="contact.html" data-magnetic>Enquire about your date</a></div>
</div></section>
<section class="section section--alt"><div class="container container--narrow" style="text-align:center">
  <span class="eyebrow" data-anim="fade-up">Kind words</span>
  <p class="quote" data-anim="fade-up" data-delay="0.15">&ldquo;[Client testimonial goes here.]&rdquo;</p>
  <p class="quote-by" data-anim="fade-up" data-delay="0.3">[Couple names]</p>
</div></section>
{cta()}''',
)

# ---------------- About ----------------
PAGES["about.html"] = dict(
    title="About", desc="The story and principles behind Wedding Berries.",
    body=page_hero("About us", "Our story", "[Short introduction to Wedding Berries.]") + f'''
<section class="section"><div class="container"><div class="split">
  {parallax_media(6)}
  <div class="stack"><span class="eyebrow" data-anim="fade-up">Who we are</span><h2 data-anim="words">[Story headline]</h2><p data-anim="fade-up" data-delay="0.2">[Founding story paragraph.]</p><p data-anim="fade-up" data-delay="0.3">[Second paragraph.]</p>{note("About copy is supplied by the owner.")}</div>
</div></div></section>
<section class="section section--alt"><div class="container">
  {head("What we stand for", "Our principles")}
  {numbered([("[Principle one]", "[Explanation.]"), ("[Principle two]", "[Explanation.]"), ("[Principle three]", "[Explanation.]")])}
</div></section>
<section class="section"><div class="container">
  {head("Our journey", "Moments that shaped us")}
  <div class="timeline" data-timeline><div class="timeline__line" aria-hidden="true"><span></span></div>
  <ol style="list-style:none">
    {"".join(f'<li class="timeline__item" data-anim="fade-up"><span class="timeline__year">[Year]</span><h3>[Milestone {i}]</h3><p>[Short description of this moment.]</p></li>' for i in range(1, 5))}
  </ol></div>
  {note("Timeline milestones are supplied by the owner.")}
</div></section>
{cta()}''',
)

# ---------------- Services ----------------
PAGES["services.html"] = dict(
    title="Services", desc="Wedding services offered by Wedding Berries.",
    body=page_hero("What we do", "Our services", "[Short introduction.]") + f'''
<section class="section"><div class="container">
  {numbered([("[Service one]", "[Description.]"), ("[Service two]", "[Description.]"), ("[Service three]", "[Description.]"), ("[Service four]", "[Description.]")])}
  <div class="btn-row"><a class="text-link" href="service-details.html">See a service in detail</a></div>
  {note("Service names and descriptions are managed from the Admin panel once it is built.")}
</div></section>
<section class="section section--alt"><div class="container">
  {head("How we work", "Our process")}
  {numbered([("[Step one]", "[Description.]"), ("[Step two]", "[Description.]"), ("[Step three]", "[Description.]")])}
</div></section>
{cta()}''',
)

PAGES["service-details.html"] = dict(
    title="Service details", desc="Details of a Wedding Berries service.",
    body=page_hero("Service", "[Service name]", "[One-line summary.]") + f'''
<section class="section"><div class="container"><div class="split">
  <div class="stack"><h2 data-anim="words">[What is included]</h2><p data-anim="fade-up" data-delay="0.2">[Detailed description.]</p>{note("Template page. One generated page per service in a later phase.")}</div>
  {parallax_media(8)}
</div></div></section>
{cta()}''',
)

# ---------------- Portfolio ----------------
def gallery_items(order):
    cats = ["a", "b", "c"]
    return "".join(
        f'<a class="masonry__item" href="assets/images/placeholder-{n:02d}.svg" data-lightbox data-cat="{cats[i % 3]}" data-caption="[Couple names]">{img(n)}</a>'
        for i, n in enumerate(order)
    )

PAGES["portfolio.html"] = dict(
    title="Portfolio", desc="A selection of weddings created by Wedding Berries.",
    features=("gallery",),
    body=page_hero("Selected work", "Portfolio", "[Short introduction.]") + f'''
<section class="section"><div class="container">
  <div class="chips" role="group" aria-label="Filter projects">
    <button class="chip" type="button" data-filter="all" aria-pressed="true">All</button>
    <button class="chip" type="button" data-filter="a" aria-pressed="false">[Category A]</button>
    <button class="chip" type="button" data-filter="b" aria-pressed="false">[Category B]</button>
    <button class="chip" type="button" data-filter="c" aria-pressed="false">[Category C]</button>
  </div>
  <div class="masonry" data-gallery data-stagger="0.06">{gallery_items([1, 2, 4, 3, 5, 6, 7, 8, 9])}</div>
  {note("Placeholder images. Categories, captions and photographs are managed from the Admin panel later. Click any image to open the lightbox (arrow keys and swipe work).")}
</div></section>
{cta()}''',
)

PAGES["portfolio-details.html"] = dict(
    title="Project", desc="A Wedding Berries wedding project.",
    features=("gallery",),
    body=page_hero("Project", "[Couple names]", "[Venue, city, date.]") + f'''
<section class="section"><div class="container">
  <div class="masonry" data-gallery data-stagger="0.08">{gallery_items([2, 1, 5, 4, 8, 6])}</div>
  <div class="container--narrow" style="margin-inline:auto;margin-top:3rem"><p data-anim="fade-up">[Project story.]</p>{note("Template page. One generated page per project in a later phase.")}</div>
</div></section>
{cta()}''',
)

# ---------------- Team ----------------
PAGES["team.html"] = dict(
    title="Team", desc="Meet the people behind Wedding Berries.",
    body=page_hero("The people", "Our team", "[Short introduction.]") + f'''
<section class="section"><div class="container">
  <div class="grid grid--3" data-stagger="0.15">
    {"".join('<div><div class="avatar-ph"></div><h3>[Name]</h3><p class="card__kicker">[Role]</p><p>[Short bio.]</p></div>' for _ in range(3))}
  </div>
  {note("Team members, photos and bios are supplied by the owner.")}
</div></section>
{cta()}''',
)

# ---------------- Testimonials ----------------
PAGES["testimonials.html"] = dict(
    title="Testimonials", desc="Kind words from Wedding Berries couples.",
    body=page_hero("Kind words", "Testimonials") + f'''
<section class="section"><div class="container container--narrow">
  {"".join('<div data-anim="fade-up" style="padding-block:2rem;border-bottom:1px solid var(--color-border)"><p class="quote">&ldquo;[Client testimonial.]&rdquo;</p><p class="quote-by">[Couple names]</p></div>' for _ in range(3))}
  {note("Real testimonials with the couple\u2019s permission are required.")}
</div></section>
{cta()}''',
)

# ---------------- Contact ----------------
PAGES["contact.html"] = dict(
    title="Contact", desc="Enquire about your wedding with Wedding Berries.",
    body=page_hero("Get in touch", "Let\u2019s talk", "[Short invitation to enquire.]") + f'''
<section class="section"><div class="container"><div class="split" style="align-items:start">
  <div class="stack" data-anim="fade-up"><h2>Reach us directly</h2><p>Email: [email address]</p><p>Phone / WhatsApp: [number]</p><p>Studio: [address]</p><p>Response time: [e.g. within 24 hours]</p></div>
  <div class="stack" data-anim="fade-up" data-delay="0.15"><h2>Send an enquiry</h2>{note("The enquiry form is not built yet, so no non-working form is shown. It needs a working backend (planned: Cloudflare Worker + email). Until then, use the contact details on the left.")}</div>
</div></div></section>''',
)

# ---------------- FAQ ----------------
PAGES["faq.html"] = dict(
    title="FAQ", desc="Frequently asked questions about Wedding Berries.",
    body=page_hero("Questions", "Frequently asked questions") + f'''
<section class="section"><div class="container container--narrow">
  <div class="faq" data-stagger="0.08">
    {"".join('<details><summary>[Question ' + str(i) + ']</summary><div><p>[Answer.]</p></div></details>' for i in range(1, 5))}
  </div>
  {note("Questions and answers are supplied by the owner.")}
</div></section>
{cta()}''',
)

# ---------------- Legal ----------------
PAGES["privacy-policy.html"] = dict(
    title="Privacy policy", desc="How Wedding Berries handles personal information.",
    body=page_hero("Legal", "Privacy policy") + f'''
<section class="section"><div class="container container--narrow stack">{note("Privacy policy text must be written or approved by the business owner or a legal adviser. It is intentionally not generated here.")}</div></section>''',
)
PAGES["terms.html"] = dict(
    title="Terms", desc="Terms of use for the Wedding Berries website.",
    body=page_hero("Legal", "Terms") + f'''
<section class="section"><div class="container container--narrow stack">{note("Terms text must be written or approved by the business owner or a legal adviser. It is intentionally not generated here.")}</div></section>''',
)

# ---------------- 404 ----------------
PAGES["404.html"] = dict(
    title="Page not found", desc="This page could not be found.", noindex=True, prefix="/",
    body='''<section class="section"><div class="container container--narrow" style="text-align:center">
  <span class="eyebrow">Error 404</span><h1>This page has wandered off</h1>
  <p class="lead" style="margin-inline:auto">The page you are looking for does not exist or has moved.</p>
  <div class="btn-row" style="justify-content:center"><a class="btn" href="/index.html">Back to home</a></div>
</div></section>''',
)


def main():
    for file, cfg in PAGES.items():
        out = page(file, cfg["title"], cfg["desc"], cfg["body"], prefix=cfg.get("prefix", ""), noindex=cfg.get("noindex", False),
                   preload=cfg.get("preload", False), features=cfg.get("features", ()))
        (ROOT / file).write_text(out, encoding="utf-8")
        print("wrote", file)


if __name__ == "__main__":
    main()
