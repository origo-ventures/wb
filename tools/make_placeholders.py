#!/usr/bin/env python3
"""Generates soft botanical placeholder images (SVG, no text) so layouts, gallery and lightbox can be built before real photos exist.
Replace with real photographs via the Admin panel later."""
import math, pathlib, random

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "images"
OUT.mkdir(parents=True, exist_ok=True)

PALETTES = [
    ("#F3DDD8", "#C98E96", "#7A1F3D"),
    ("#F6E7DA", "#D9B48F", "#8E4B57"),
    ("#EBD5D8", "#B76E79", "#5A1530"),
    ("#F8EEE4", "#E3C3B5", "#B76E79"),
    ("#E9D3CF", "#C9A27A", "#7A1F3D"),
    ("#F1E0E2", "#9E5666", "#3A1424"),
]
SIZES = [(800, 1000), (1200, 800), (1000, 1000), (800, 1000), (1200, 800), (800, 1000), (1000, 1000), (1200, 800), (800, 1000)]

def sprig(rnd, w, h, color, op):
    x0 = rnd.uniform(0.15, 0.85) * w
    pts = [(x0, h * 1.05), (x0 + rnd.uniform(-0.25, 0.25) * w, h * 0.65), (x0 + rnd.uniform(-0.2, 0.2) * w, h * 0.35)]
    d = f"M{pts[0][0]:.0f},{pts[0][1]:.0f} Q{pts[1][0]:.0f},{pts[1][1]:.0f} {pts[2][0]:.0f},{pts[2][1]:.0f}"
    s = f'<path d="{d}" fill="none" stroke="{color}" stroke-opacity="{op}" stroke-width="3" stroke-linecap="round"/>'
    for i in range(7):
        t = (i + 1) / 8
        x = (1 - t) ** 2 * pts[0][0] + 2 * (1 - t) * t * pts[1][0] + t * t * pts[2][0]
        y = (1 - t) ** 2 * pts[0][1] + 2 * (1 - t) * t * pts[1][1] + t * t * pts[2][1]
        side = 1 if i % 2 else -1
        ang = side * rnd.uniform(25, 55)
        s += f'<ellipse cx="{x + side * 18:.0f}" cy="{y:.0f}" rx="26" ry="9" transform="rotate({ang:.0f} {x:.0f} {y:.0f})" fill="{color}" fill-opacity="{op * 0.8}"/>'
    return s

def bloom(rnd, w, h, color, op):
    cx, cy, r = rnd.uniform(0.25, 0.75) * w, rnd.uniform(0.25, 0.6) * h, rnd.uniform(70, 130)
    s = ""
    for k in range(8):
        a = k * 45
        s += f'<ellipse cx="{cx:.0f}" cy="{cy - r * 0.55:.0f}" rx="{r * 0.34:.0f}" ry="{r * 0.6:.0f}" transform="rotate({a} {cx:.0f} {cy:.0f})" fill="{color}" fill-opacity="{op}"/>'
    s += f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r * 0.18:.0f}" fill="#FBF7F2" fill-opacity="0.8"/>'
    return s

for n, (w, h) in enumerate(SIZES, 1):
    rnd = random.Random(n * 17)
    a, b, c = PALETTES[(n - 1) % len(PALETTES)]
    body = f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>' \
           f'<radialGradient id="v" cx="0.5" cy="0.4" r="0.8"><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="{c}" stop-opacity="0.28"/></radialGradient></defs>'
    body += f'<rect width="{w}" height="{h}" fill="url(#g)"/>'
    for _ in range(9):
        body += f'<circle cx="{rnd.uniform(0, w):.0f}" cy="{rnd.uniform(0, h):.0f}" r="{rnd.uniform(18, 70):.0f}" fill="#fff" fill-opacity="{rnd.uniform(0.05, 0.16):.2f}"/>'
    for _ in range(2):
        body += sprig(rnd, w, h, c, 0.35)
    body += bloom(rnd, w, h, c, 0.28)
    body += f'<rect width="{w}" height="{h}" fill="url(#v)"/>'
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="Placeholder image">{body}</svg>'
    (OUT / f"placeholder-{n:02d}.svg").write_text(svg, encoding="utf-8")
    print("placeholder", n, w, h)
