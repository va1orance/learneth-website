# Learneth public website

A static information site with a scripted learning document on the homepage and a separate live BYO-key tutor at https://valorance.net/learneth/demo/. This is a learning-flow demo, not the full Learneth/SilverBullet application.

## Demo workflow

The welcome dialog offers live AI onboarding or the fullscreen scripted example (`../?example=fullscreen#preview`). It supports keyboard focus containment, Escape, an X close control, and reopening; dismissing it leaves usable onboarding.

Type a topic or read a local UTF-8 `.txt`, `.md`, or `.markdown` file (64 KiB maximum, 12,000 characters maximum). The upload replaces the material textarea for review; no file bytes are uploaded separately. Unsupported formats, including PDF, are rejected without replacing existing material. Export PDFs to text first. There is no third-party runtime parser.

Choose material-only tutoring, material plus model knowledge, or custom teaching instructions, and a familiarity level. These choices become tutor system-policy instructions. Study material and learner replies are explicitly untrusted content, not privileged instructions. This is a prompt-level boundary, not a guarantee that a model cannot be manipulated or make mistakes.

## Privacy and cost

The homepage example is scripted and makes no model calls. The live demo accepts a configurable cross-origin **HTTPS OpenAI-compatible API base URL**, chat model ID, and API key. OpenRouter is the default, not the only provider. Base URLs cannot contain credentials, queries, or fragments. Endpoints must support browser CORS; incompatible providers fail rather than being proxied. The website has no Learneth API backend, analytics, external fonts, or third-party runtime scripts.

The endpoint is displayed before explicit consent. Changing it clears consent. Requests go directly to that endpoint; keys are sent only in the Authorization header, never in JSON, URLs, transcripts or unrelated requests. Key duplication checks cover material, teaching instructions, familiarity, endpoint, chat model, optional image model and subsequent answer/image prompts. Raw provider errors are not rendered. Use a disposable low-limit key and revoke it with your provider afterward.

Keys, material and conversation remain in page memory only: this website does not write session state to cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, databases or URLs. Reload, leaving, back/forward restoration and End & clear reset state and cancel in-flight requests. Memory clearing is best effort, not cryptographic erasure. Browser extensions, developer tools, password managers and compromised devices are outside this guarantee. Hosting infrastructure may retain ordinary page-access logs.

Each chat turn sends the current conversation to the selected endpoint and downstream provider. Their retention policies apply; website-side no-storage is not provider-side zero retention. Requests to OpenRouter additionally set `provider.data_collection=deny` and `allow_fallbacks=false`. Other endpoints do not receive these OpenRouter-specific settings or a retention guarantee.

## Optional images and limits

Leave the optional image model empty to disable image generation entirely. Configuring one never starts an image request by itself. The session's image action requires a prompt and separate explicit consent, displays the image endpoint, and uses the **same key and base URL** at `/images/generations`. It requests one 1024×1024 image with `response_format=b64_json`. Compatible OpenAI-style endpoints may support this; many providers/model routes (including OpenRouter routes) do not. No fallback endpoint or separate key is silently substituted.

Only bounded base64 PNG, JPEG or WebP results are accepted. Remote image URLs and SVG are not loaded. Images are decoded locally, dimension checked (at most 4096×4096), displayed via local blob URLs, and revoked on clear. Generated illustrations may be inaccurate. Image JSON responses are capped at 8 MiB; chat JSON at 128 KiB; image prompts at 1,000 characters; answers at 4,000 characters. Chats request at most 1,200 output tokens. A combined 20-request session cap includes images and failed calls. Requests time out after 60 seconds and can be stopped. There are **no automatic retries**. Stop cannot undo provider work or charges already incurred. These limits are not a spending guarantee.

Other defenses include CSP allowing HTTPS API connections but no third-party scripts/frames, no-referrer policy, omitted fetch credentials, `cache: no-store`, rejected redirects, text-only tutor rendering, and key redaction in chat output. Keep private notes, production keys and configuration out of this repository.

## Run and test

Run `npm test` for dependency-free static/export checks. Run `npm run dev` and open http://127.0.0.1:4173/. Browser tests accept `SITE_URL` (including a path prefix) and `PLAYWRIGHT_MODULE` for an existing Playwright installation:

```sh
SITE_URL=http://127.0.0.1:4173/ node tests/browser-check.cjs
SITE_URL=http://127.0.0.1:4173/ node tests/live-features.cjs
SITE_URL=http://127.0.0.1:4173/ node tests/live-security.cjs
```

Browser tests intercept provider requests with explicit synthetic fixtures; **no paid calls are made**. They check UI, request payloads, security behavior and safe mocked image display, not live model quality, real provider compatibility, authenticated routing, billing or retention. Screenshot artifacts are ignored by Git. The exporter copies the complete `assets/` and `demo/` directories, so no new runtime asset list is needed.

## Deployment

This repository is the source of truth. Publish its exported runtime under `learneth/` in `va1orance/valorance-website`, preserving unrelated files and the root CNAME. DNS maps hostnames, not paths: no Cloudflare DNS change is needed. No private instance or home-network port is exposed.

Run `python3 tools/export_site.py NEW_DESTINATION` to export public assets and license notices. The exporter refuses existing destinations. Review and commit only exported runtime in the destination repository. Tests and development files are not served publicly.

## License

GNU AGPL-3.0-only: open source, including commercial use, with network copyleft. See LICENSE, NOTICE and LICENSING.md for scope and upstream exclusions. This applies to the website/demo, not the private application.
