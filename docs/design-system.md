# Wedding Berries Design System (Phase 02)

Direction: **soft, romantic, editorial.** Taken from the *structure* of the reference (eyebrow label, large heading, numbered blocks, marquee, stats, full-bleed imagery) but with an original warm identity instead of the reference's dark industrial look. All values live in `assets/css/tokens.css`.

## Colour

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--wb-ivory` | `#FBF7F2` | Page background | n/a |
| `--wb-cream` | `#F3EBE1` | Alternate sections | n/a |
| `--wb-ink` | `#2A1F24` | Text, dark sections | 14.9:1 on ivory |
| `--wb-muted` | `#6F6168` | Secondary text | 5.5:1 on ivory |
| `--wb-berry` | `#7A1F3D` | Primary brand, buttons, links | 9.4:1 on ivory |
| `--wb-berry-deep` | `#5A1530` | Hover / pressed | n/a |
| `--wb-rose` | `#B76E79` | Decoration, large text only | 3.6:1 (not for body text) |
| `--wb-rose-text` | `#8E4B57` | Rose-gold at text size | 6.0:1 on ivory |
| `--wb-gold` | `#C9A27A` | Detail on dark backgrounds only | 6.8:1 on ink |

The rose-gold family was chosen to sit alongside the brand's rose-gold monogram; replace values here if the final brand colours differ.

## Typography

- Headings: **Cormorant Garamond** (500/600, italic for quotes). Fallback: Georgia.
- Body and labels: **Jost** (400/500). Fallback: system sans.
- Eyebrows: small, uppercase, widely tracked, rose-gold text colour.
- Fluid sizes via `clamp()`: H1 2.6 to 6rem, H2 2 to 3.5rem, body 17px, line height 1.7.
- Fonts are loaded from Google Fonts for now. Phase 12 should self-host them for speed and privacy.

## Spacing and layout

- 8px base scale (`--space-1` to `--space-7`). Section padding is fluid, 72 to 144px.
- Container 1240px max, narrow container 760px, fluid gutters.
- Breakpoints: 640px (2 columns), 860/900px (split and numbered layouts), 960px (desktop navigation).
- Mobile first. Tested at 1440px and 390px with no horizontal overflow.

## Components (Phase 03)

Header + mobile menu, buttons (solid, ghost, small), hero, page hero, marquee, statistics, numbered list, card grid, split layout, CTA band, FAQ accordion (native `<details>`, works without JS), testimonial quote, placeholder notice, footer. Each maps to a section type in the future component registry (brief section 10).

## Accessibility rules baked in

- Skip link, one `h1` per page, visible focus ring, `aria-current` on the active nav link.
- Body-size text never uses the low-contrast rose; only `--wb-rose-text`.
- `prefers-reduced-motion` disables the marquee and transitions.
- Touch targets are at least 42px high.

## Known gaps (not yet built)

- Real logo (the header currently shows a CSS "wb" circle as a stand-in).
- Real images. All image areas are soft gradient placeholders.
- Real photographs (gallery and lightbox are ready, placeholders only).
- Portfolio filters, masonry gallery and lightbox.
