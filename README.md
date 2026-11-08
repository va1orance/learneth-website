# Learneth public website

A static information site with an embedded scripted learning document on the homepage, and a separate live BYO-key tutor at https://valorance.net/learneth/demo/. This is a small learning-flow demo, not the full Learneth/SilverBullet application.

## Privacy and cost

The homepage example is scripted and makes no model calls. The live demo supports OpenRouter, using direct browser requests to the fixed HTTPS chat-completions endpoint. There is no Learneth backend, API proxy, analytics, third-party script or external font. The website does not write keys, material, goals or transcripts to cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, URLs or a database. State lives in page memory, and is cleared on reload, navigation, back/forward restoration, or End & clear. Memory clearing is best effort, not cryptographic erasure; browsers, extensions, developer tools and password managers are outside this guarantee. Hosting infrastructure can keep normal page-access logs.

Before the first request, users provide material, choose their starting point and model, enter their own key, and explicitly consent to sending text and incurring provider charges. Use a disposable, low-credit-limit OpenRouter key. Revoke it when finished. Each turn sends the entire current session to OpenRouter and its downstream model provider. Their retention policies apply: website-side no-storage does not mean provider-side zero retention. Requests specify provider.data_collection=deny and allow_fallbacks=false; incompatible routes fail rather than relax those settings. The demo does not enable tools, uploads, HTML/Markdown rendering, arbitrary endpoints, background calls or automatic retries.

Security controls include a restrictive demo CSP, no-referrer policy, omitted request credentials, no-store fetch, blocked redirects, textContent rendering, key redaction, bounded inputs and response size, a 60-second request timeout, cancellation, 1,200 output tokens per call, and a 20-call session limit. These are not a guaranteed monetary cap. Keep all private notes, production keys and application configuration out of this repository.

## Run and test

Run `npm test` for static/export checks. Run `npm run dev` and open http://127.0.0.1:4173/. For browser checks, use `SITE_URL=http://127.0.0.1:4173/ node tests/browser-check.cjs`. An existing Playwright installation can be selected with PLAYWRIGHT_MODULE and PLAYWRIGHT_BROWSERS_PATH. Browser tests intercept all model calls with explicit fixtures; they do not validate live model quality, authenticated provider routing, billing or retention. The current default model ID was checked against the public OpenRouter model catalog, not with a paid inference call.

## Deployment

This repository is the source of truth. Publish its exported runtime under learneth/ in va1orance/valorance-website, preserving all unrelated files and the root CNAME. DNS maps hostnames, not paths: no Cloudflare DNS change is needed. No private instance or home-network port is exposed.

Run `python3 tools/export_site.py NEW_DESTINATION` to export public assets and license notices. The exporter refuses existing destinations. Review and commit only the exported runtime in the destination repository. Tests and development files are not served publicly.

## License

GNU AGPL-3.0-only: open source, including commercial use, with network copyleft. See LICENSE, NOTICE and LICENSING.md for scope and upstream exclusions. This applies to the website/demo, not the private application.
