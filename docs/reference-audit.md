# Reference Audit: ecube-entertainment.com

**Project:** Wedding Berries
**Phase:** 01, Reference Audit
**Audit date:** 21 November 2026
**Purpose:** Design direction and interaction quality only. No text, logo, images, brand identity or source code from the reference may be copied into Wedding Berries.

## 0. Method and limits (read first)

This audit was made by fetching the page content of every page reachable from the reference site's main navigation, as text and metadata. That has a consequence: **what is visible in the HTML text is documented as "Observed"; what needs a browser to judge is marked "Not verified".**

Not verified from text alone: exact fonts, font sizes, colour values beyond the theme colour, easing curves, animation durations, hover effects, page-transition style, cursor behaviour, mobile layout, loading sequence. These must be checked in a real browser (DevTools + screen recording on desktop, tablet and phone) before Phase 02 locks the design system. A checklist is in section 9.

Pages audited (all five main nav pages):

| Page | URL |
|---|---|
| Home | `/` |
| Services | `/services.html` |
| Work | `/work.html` |
| About | `/about.html` |
| Contact | `/contact.html` |

Also linked but not audited: `tickets.ecube-entertainment.com` (a separate sub-site, out of scope).

## 1. Site structure and URL pattern

- Flat, individual `.html` files per page, same approach the Wedding Berries brief requires for GitHub Pages.
- Only five public pages. No separate detail pages for individual projects or services (all content lives on the listing page).
- Primary navigation (same on every page): Services, Work, About, **Get in Touch** (styled as the call to action, separate from the other links).
- A second plain list of the same links (Home, Services, Work, About, Contact) exists in the markup, most likely the mobile/full-screen menu. Not verified visually.
- Footer on every page: logo + tagline, phone, email, city, social links (Facebook, Instagram, YouTube), "Capabilities" link column, "Company" link column, a "Platform" link, copyright line.

**Wedding Berries takeaway:** Keep the flat `.html` structure. The Wedding Berries sitemap is larger (13 pages incl. detail templates), so detail pages for portfolio items and services are a deliberate improvement over the reference.

## 2. Header and navigation

Observed:
- Logo (image + wordmark) on the left, links on the right, one highlighted call-to-action link.
- A thin technical-looking strip above the header on the home page reading like a broadcast timecode: `00:00:00:00 25fps • PAL HD 1080i`. This is a brand-specific detail tied to live-production culture. It is likely animated (a running counter) but this is not verified.

Not verified: sticky or hide-on-scroll behaviour, blur/background change on scroll, mobile menu animation.

**Wedding Berries takeaway:** Use a similar minimal header with one CTA ("Enquire" or similar). Do not copy the timecode strip. Wedding-appropriate alternative: a quiet date/season line or none at all.

## 3. Homepage section order

Observed order, top to bottom:

1. **Hero**: location eyebrow ("Dhaka | Bangladesh | Global"), very large uppercase headline, one supporting sentence, primary button ("View Our Work"), a "Scroll" cue, secondary link ("Start a Project").
2. **Marquee / ticker**: a repeating line of capabilities and stats separated by decorative symbols, written twice in the markup (the standard technique for a seamless infinite loop).
3. **Stats row**: four numbers (productions, countries, years, audience). In the fetched HTML they read as `0+`, `0+`, `0YRS`, `0K+`, which strongly indicates **count-up animations that run when scrolled into view**.
4. **Capabilities**: eyebrow label, large uppercase heading, short intro, then six numbered items (01 to 06), each with a title, a one-sentence description and small tag chips.
5. **Selected Work**: heading + four project cards, each with an image, year, title, client and tags, then a "View All Projects" link.
6. **Full-width image** with a small caption ("EST. 2025 · DHAKA" plus a location/event line).
7. **About teaser**: eyebrow, heading, two paragraphs, four short bullet facts, "Our Story" link.
8. **Trusted by**: client names in a row (text, not logos in the fetched content).
9. **Closing call to action**: question-style heading, one sentence, two buttons.
10. **Footer.**

Pattern: every content section opens with a **small eyebrow label** ("What We Do", "Selected Work", "About Ecube") above a **large all-caps heading**.

**Wedding Berries takeaway:** This is a strong, reusable rhythm: hero → marquee → stats → services → featured work → full-bleed image → about → trust → CTA. It maps directly onto the brief's component registry (Hero, Marquee, Statistics, Services Grid, Portfolio Grid, Full-width Image, Text + Image, Logo Showcase, Call to Action). For weddings, swap "Trusted by" for testimonials and add a gentler, more romantic content tone.

## 4. Inner page layouts

### Services (`/services.html`)
- Page header: eyebrow, huge heading, short intro, and a small item count ("09").
- **Nine service blocks**, each numbered, with: title, tag chips, a one-line "key fact" label (e.g. "Experience:", "Console:", "Hardware:"), and two short paragraphs.
- **Process section**: four numbered steps (Brief & Scope, Design & Plan, Build & Rehearse, Deliver & Debrief).
- Closing CTA.

### Work (`/work.html`)
- Page header with a count ("500").
- **Five featured projects**, each a large image plus: year, client, title, two paragraphs, tag chips and three small "stat" tiles.
- The first project is treated as the flagship (more text, more stats).
- **Corporate clients section**: five named clients, each with a short description, then an "and many more" card.
- Closing CTA.
- No filters, categories, pagination or detail pages.

### About (`/about.html`)
- Page header with a "10" (years).
- Story section with a pull-quote style line in capitals.
- **Six numbered principles.**
- Team section: three role cards with an initial/monogram in place of photos.
- **Milestones timeline**: year + description + category label.
- Location/contact block (headquarters, email, response time), then CTA.

### Contact (`/contact.html`)
- Heading + short promise of what the client gets back.
- Direct contact details (email, location, phone-on-request, response time).
- Enquiry form: name, organisation, email, phone/WhatsApp, project type (required), event date, budget range (required), free-text brief, submit button, and an inline "Received" success state.
- FAQ: six questions (lead time, travel, riders, rentals, product, differentiation). Presumably an accordion; not verified.

**Wedding Berries takeaway:**
- The numbered-block pattern (01, 02, 03) is the signature of this site and works well for wedding packages and process steps.
- The enquiry form's structure (project type, date, budget range, free-text) translates perfectly to weddings (event type, wedding date, venue, guest count, budget range).
- Pages are text-heavy and image-light in the fetched content. Wedding Berries will need far more photography and video.

## 5. Typography and hierarchy

Observed (from structure only):
- Page titles and section headings are **all caps** and very large.
- Small **eyebrow labels** precede headings.
- Numbered labels (01, 02) and monospace-style technical text appear (timecode strip, spec lines like "Console: GrandMA2").
- Tag chips for categories.

Not verified: actual typefaces, sizes, weights, letter-spacing, line heights.

**Wedding Berries takeaway (for Phase 02):** The *hierarchy* (eyebrow, big heading, short intro, numbered detail) should carry over. The *voice* should not: all-caps industrial headings suit live production but would feel cold for weddings. Plan on an elegant serif or high-contrast display face for headings and a clean sans for body, with caps reserved for eyebrows and labels.

## 6. Colour and background treatment

Observed:
- Theme colour declared as `#080808` (near-black). Open Graph image is 1200×630.
- Overall presentation is a **dark, cinematic theme** (inferred from the theme colour and content style).

Not verified: accent colours, gradients, overlays, section background alternation.

**Wedding Berries takeaway:** Do not use the black palette. Define an original palette in Phase 02 (suggested direction: warm ivory/cream base, deep berry accent, soft gold detail), while keeping the reference's *discipline*: few colours, strong contrast, generous space.

## 7. Motion and interaction

Observed (confirmed from markup/content):
- **Count-up stats** (numbers present as zeros in static HTML).
- **Infinite marquee** (duplicated text run).
- **"Scroll" cue** in the hero.
- Contact form has an **inline success state** (no page reload).

Inferred, not verified:
- Hero entrance and heading reveal on load.
- Scroll-triggered fade/slide reveals on sections and cards.
- Image reveals or parallax on the full-width image and work images.
- Hover states on project cards and links.
- Page-to-page transitions.
- Running timecode in the header strip.

**Wedding Berries takeaway:** The brief's animation list already covers all of these (Fade Up, Image Reveal, Clip Reveal, Text Reveal, Stagger Reveal, Parallax, Marquee, Counter Animation, Image Hover, Section Transition). Wedding Berries should use them more softly: slower durations, gentler easing, and `prefers-reduced-motion` respected, as the brief requires.

## 8. Portfolio and gallery behaviour

Observed:
- Home shows four cards; Work page shows five projects as large stacked entries. There is **no filter, grid gallery, lightbox or detail page** in the fetched content.

**Wedding Berries takeaway:** This is where the reference is weakest for our needs. Weddings are image-led, so Wedding Berries needs: a filterable grid (by wedding type or venue), a masonry gallery, a lightbox, and a project detail page template. These are already in the brief (`portfolio-details.html`, Masonry Gallery, Image Slider).

## 9. Browser checks still needed (before Phase 02)

Open the reference on desktop, tablet and phone and record notes or screen captures for:

- [ ] Fonts used (DevTools → Computed → font-family) and the type scale
- [ ] Full colour palette incl. accents and hover colours
- [ ] Header behaviour on scroll; mobile menu open/close animation
- [ ] Hero load sequence and exact motion timing
- [ ] Scroll-reveal style on each section type
- [ ] Hover effects on buttons, cards, images, links
- [ ] Cursor behaviour (custom cursor or default)
- [ ] Page transitions between pages
- [ ] Marquee speed and direction
- [ ] Counter animation duration and easing
- [ ] FAQ accordion behaviour
- [ ] Form validation and success state behaviour
- [ ] Layout at 1440, 1024, 768 and 390 px widths
- [ ] Loading screen or preloader, if any

## 10. Summary of what to take and what to leave

**Take (as design direction):**
- Eyebrow + large heading + short intro rhythm
- Numbered-block pattern for services and process
- Hero → marquee → stats → services → work → full-bleed image → about → CTA homepage flow
- Enquiry form with project type, date and budget range
- Inline form success state
- Clear, repeated call to action ("Start a Project" equivalent)
- Flat `.html` architecture

**Change for Wedding Berries:**
- Warm, romantic tone and palette instead of dark and industrial
- Heading typography that is elegant, not all-caps industrial
- Image-first portfolio with filters, masonry gallery, lightbox and detail pages
- Testimonials and a real team page with photographs
- Wedding-specific form fields (wedding date, venue, guest count)

**Do not copy:** all text, the timecode strip, logos, images, brand name, source code or the "Trusted by" client list.

## 11. Next step

Phase 02, Brand and Design System: define the Wedding Berries identity, palette, typography, spacing, components and responsive rules.

Required from the project owner before Phase 05 (not needed for Phase 02):
1. Repository public or private, GitHub owner/repo name, and who has access.
2. Authorised administrator GitHub account(s).
3. Custom domain, if already available.
