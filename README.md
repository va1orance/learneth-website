# Learneth website

Local-only website foundation, separate from the SilverBullet plug. No remote is configured and nothing is publicly deployed.

## Preview

Run `npm run dev` (or `python3 -m http.server 4173 --bind 127.0.0.1`) in this directory, then visit http://127.0.0.1:4173.

## Structure

- `index.html`: product introduction, interactive scripted lesson preview, getting started, and limitations.
- `assets/styles.css`: responsive layout and design tokens.
- `assets/site.js`: accessible lesson-preview interaction. No model calls.
- `tests/check_site.py`: dependency-free structure and local-reference checks.

Run `npm test` to check the site. No build step, package install, tracking, external fonts, credentials, or backend required. Static files can be hosted later under a subpath as well as a domain root.

## Scope

This is a draft product site, not the tutor itself. The preview is explicitly scripted. Install directions describe the existing plug build; there is no public download or public app link yet. PDF import is not advertised as shipped. Handwriting remains experimental/future work. No license has been selected.
