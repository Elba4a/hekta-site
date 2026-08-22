# hekta.money

The marketing site for [Hekta](https://apps.apple.com/app/id6778138657) — an AI money
and net worth tracker. Static: no build step, no framework, no CDN, no third-party
dependency. Served by GitHub Pages at `hekta.money`.

**This repository is a deploy target, not the source of truth.** The page is authored
in the private app repo under `web/landing/`, and `tokens.css` is generated there from
the app's own design tokens so the phone on the page cannot drift from the real UI.
Edit it there, then copy the files here and push.

`og.html` is the source for `og.png` (the social card) and is not linked from the site.
