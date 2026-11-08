# Learneth public demo

A standalone static website with an interactive, scripted example of the Learneth learning document. It is not a live AI tutor or the full Learneth/SilverBullet application.

Public site: https://valorance.net/learneth/

## Privacy and cost

No backend, authentication, analytics, cookies, storage, model calls, external assets, or API keys. Text entered in the demo stays in the current browser document and disappears on reset/reload. Feedback is a fixed teaching note, not automated assessment. Do not put private application data or credentials in this repository.

## Run and test

Run `npm test` for static checks. Run `npm run dev` and open http://127.0.0.1:4173. For optional browser checks, install Playwright and Chromium in your development environment, then run `SITE_URL=http://127.0.0.1:4173 node tests/browser-check.cjs`. An existing installation may be selected using PLAYWRIGHT_MODULE and PLAYWRIGHT_BROWSERS_PATH.

## Deployment

The information site lives at https://valorance.net/learneth/ and the interactive demo at https://valorance.net/learneth/demo/. This repository is the source of truth. Publish its web assets into the existing valorance-website repository under learneth/; do not add a CNAME here or change the root website CNAME. DNS maps hostnames, not URL paths: no Cloudflare DNS changes are needed for this deployment. The current GitHub Pages site serves the paths using its existing domain and HTTPS. No private instance or home-network port is exposed.

Run `python3 tools/export_site.py /path/to/valorance-checkout/learneth` to export only public runtime assets and license notices, then review and commit that directory in the destination repository. Tests and development files are not published to the website. The export refuses to overwrite an existing destination to avoid silently deleting files.

## License

PolyForm Noncommercial 1.0.0: source-available, not OSI open source. See LICENSE, NOTICE, and LICENSING.md for scope, alternatives, and upstream exclusions. This license applies to this website/demo, not the private application.
