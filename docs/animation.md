# Animation and effects

Declare effects with data attributes (the generator already writes them):

| Attribute | Effect |
|---|---|
| `data-anim="fade-up / fade-down / fade-left / fade-right / zoom-in"` | Scroll reveal |
| `data-anim="words"` | Masked word-by-word headline reveal |
| `data-anim="clip-up"` | Image curtain reveal |
| `data-delay="0.3"` / `data-stagger="0.12"` | Delay, or stagger a parent's children |
| `data-count="250" data-suffix="+"` | Count-up number |
| `data-parallax="0.07"` | Scroll parallax (put on an inner wrapper, not the reveal element) |
| `data-petals` | Falling rose petals (canvas) inside this container |
| `data-magnetic` / `data-tilt` / `data-burst` | Magnetic button / 3D tilt card / petal burst on click |
| `data-cursor="View"` | Label shown inside the custom cursor |
| `data-timeline` | Scroll-drawn timeline |

Built in: preloader (first visit per session, home page only), scroll progress bar, header that hides on scroll down, marquee that speeds up with scrolling, page fade transitions, wedding countdown, filterable project grid, lightbox gallery.

Effects can be switched off in the Control Panel (Design > Effects). With JavaScript off or `prefers-reduced-motion`, everything is simply visible and nothing moves; a failsafe timer removes hidden states if the scripts fail to load.

The master brief names GSAP + ScrollTrigger. This engine is dependency-free with a declarative API so GSAP can replace it later without touching page markup.
