# Learneth Free-Model Proxy (Cloudflare Worker)

Server-side proxy that lets the homepage Kinematics example (`/example`) and the live demo's optional free mode (`/demo`) call an OpenRouter `:free` model without ever exposing an API key in Git or browser JavaScript.

## Setup (one command per block)

1. Create a dedicated OpenRouter API key with a **`$0.00` credit limit** so it can only use `:free` routes.
2. Authenticate Wrangler locally:

```sh
npx wrangler login
```

3. Store your `$0.00`-capped OpenRouter key as a Cloudflare secret (never commit it):

```sh
npx wrangler secret put OPENROUTER_FREE_KEY --config worker/wrangler.toml
```

4. Deploy the Worker:

```sh
npx wrangler deploy --config worker/wrangler.toml
```

5. Configure `data-live-example-url="https://<your-worker-url>"` (or `/example`) on `#sample-form` in `index.html` and `data-free-demo-url="https://<your-worker-url>/demo"` on `#onboarding` in `demo/index.html` (ensuring matching CSP `connect-src` origins), then export with `python3 tools/export_site.py`.

## Guardrails
- Only accepts `POST /example` (or `/`) and `POST /demo` from `ALLOWED_ORIGINS` (`403`/`404` include `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`).
- Refuses any `FREE_MODEL` that is not `openrouter/free` or ending in `:free`.
- Stream-bounds incoming request bodies (`2,048` bytes on `/example`; `57,344` bytes on `/demo`, returning `400` on unreadable request streams) and upstream JSON responses (`131,072` bytes) before `JSON.parse`, rejects upstream redirects (`redirect: 'manual'`), and redacts `OPENROUTER_FREE_KEY` before slicing output.
- **`POST /example`**: hardcodes the circular-track Kinematics acceleration system prompt, caps input at `600` chars, requests `420` `max_tokens`, caps output at `1,200` chars, and enforces `5` requests / 10 min per IP.
- **`POST /demo`**: enforces the Learneth Socratic system prompt (stripping control characters and framing custom `goal` preferences as untrusted data), requires `user` turn 0 (pinned up to `16,000` chars so dense JSON-escaped 12k study material + `starting_point` is never truncated or evicted) plus up to `12` recent follow-up turns (6 `assistant`/`user` pairs, preserving strict role alternation across `> 13` turns, `4,000` chars each; `MAX_DEMO_TURNS = 13`), requests `700` `max_tokens`, caps output at `4,000` chars, and enforces `12` requests / 10 min per IP.
- Emits `Retry-After` on all `429` responses and prunes expired/overflow rate-limit entries in `ipHits` (`MAX_RATE_LIMIT_KEYS = 5000`).
- On `index.html`, if the Worker is offline or rate-limited (`429`), `assets/site.js` updates `#sample-mode-note` (static `.textContent` notice on `429`) and falls back cleanly to the scripted preview.
