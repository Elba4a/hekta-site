# hekta.money

The marketing site for [Hekta](https://apps.apple.com/app/id6778138657): money that logs
itself, in Arabic and English. Static: no build step, no framework, no CDN, no third-party
dependency. Served by GitHub Pages at `hekta.money` (`/` English, `/ar/` Arabic).

**This repository is a deploy target, not the source of truth.** The page is authored in
the private app repo under `web/landing/`, and that repo's `landing-deploy.yml` workflow
mirrors it here on every change (`rsync --delete`, keeping `CNAME`, `.nojekyll` and this
README). Do not edit files here by hand: the next deploy overwrites them.

`og.html` / `og-ar.html` are the sources for `og.png` / `og-ar.png` (the social cards) and
are not linked from the site.
