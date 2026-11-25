# Wedding Berries website

Static website for GitHub Pages (domain: weddingberriesbd.com) with an all-in-one **Control Panel** at `/admin/`.

## How it works

```
content/*.json     all text, photos paths and design settings (edited by the Control Panel)
tools/build_site.py  builds the static pages from content/*.json
admin/             the Control Panel (login + editors, one commit per save)
assets/            CSS, JS, images
.github/workflows/deploy.yml   rebuilds and publishes the site after every commit
```

1. You edit in the Control Panel and press **Save to GitHub** (one commit: text + photos together).
2. GitHub Actions runs `build_site.py` and publishes the result (1 to 3 minutes).
3. The panel shows "Saved and live" when the rebuild finishes.

## One-time setup

1. Create a **public** GitHub repository and upload everything in this folder (not the `dist` folder).
2. Repository **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. Open the **Actions** tab once and run "Build and deploy" (or just make a first change). Your site appears at `https://<username>.github.io/<repo>/`.
4. Create a fine-grained **access token**: GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens. Repository access: only this repository. Permissions: **Contents: Read and write** (optional: Actions: Read-only to see build status).
5. Open `/admin/` on your site, enter username, repository, branch (`main`) and the token.
6. Custom domain: Settings > Pages > Custom domain. Do this only when you are ready for weddingberriesbd.com to switch to this site (it replaces whatever the domain serves now).

## Control Panel

See `docs/control-panel.md`. Sections: Page text, Content (services, projects, team, testimonials, FAQ), Site (contact, social, tracking), Design (colours, fonts, effects), and tools (launch checklist, live preview, unused photos).

## Security notes

- The token is stored only in your browser (session by default; "Remember on this device" uses local storage). Use a fine-grained token limited to this repository, set an expiry, and log out on shared devices.
- The admin page runs under a strict Content-Security-Policy (no inline scripts; it may only talk to api.github.com).
- This is a direct browser-to-GitHub flow, which is simple but weaker than the secure broker described in the master brief (Phase 05: GitHub App + Cloudflare Worker, no token in the browser). The panel is written so that part can be swapped later.
- Anyone who has the token can change the site. Never put the token in any file in this repository.

## Local build and preview

```
python3 tools/build_site.py --out dist     # builds the site into dist/
python3 -m http.server 8000 --directory dist
```
Text in `[square brackets]` is placeholder content; the build lists what is still unfilled.

## Effects and animation

See the data attributes table in `docs/animation.md`.
