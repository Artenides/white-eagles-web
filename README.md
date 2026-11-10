# White Eagles — Guild Roster

A static, single-page guild roster site. No backend, no database, no login — the page is visible to anyone with the link.

## How it works

The page (`index.html`) loads `data/roster.json` and renders it as a sortable, searchable table of characters, class, level, guild rank, and raid attunement status.

## Updating the roster

1. Export your roster from your WoW addon as JSON.
2. Replace the contents of `data/roster.json` with that export.
3. Re-upload/deploy the site (or just overwrite the file if it's already hosted).

The page reads whichever of these shapes is present, so most addon exports should work without edits:

- `{ "characters": [ ... ] }`
- `{ "rosterExport": { "characters": [ ... ] } }`
- a bare `[ ... ]` array of characters

Each character entry is read flexibly:

- name: `character` or `name` or `fullName`
- class: `class`
- level: `level`
- guild rank: `guildRank` or `rank` (and `guildRankIndex` for sort order)
- raids: `raids` as either an object keyed by raid name (`{ "Karazhan": { "ready": true, "missing": [...] } }`) or an array of `{ name, unlocked, missing }`

See `data/roster-export-example.json` for a real example from the addon this was built against.

## Guild info

The guild name, realm, and faction shown in the header are set in `js/app.js` under the `CONFIG` object at the top of the file — edit those three values if anything changes.

## Local preview

Do not open `index.html` by double-clicking it. Browsers block the page's roster fetch when it's loaded from a `file://` path (no error is shown — the table just stays empty), even though the exact same page works fine once it's on a real web server.

A zero-dependency preview server is included:

```bash
node serve.js
```

Then open the URL it prints (`http://localhost:8080`). Any other static file server (`npx serve .`, etc.) works the same way. Once the site is uploaded to real hosting (GitHub Pages, Netlify, shared hosting, ...) and served over `http://`/`https://`, this is not an issue — only opening the raw file locally is affected.

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that deploys the site automatically on every push to `main`.

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Push to `main` (or run the workflow manually from the **Actions** tab) — the site will deploy to `https://<your-username>.github.io/<repo-name>/`.

No build step is needed since this is a plain static site; the workflow just uploads the repo as-is. The `.nojekyll` file stops GitHub Pages from running its default Jekyll processing, which isn't needed here and can occasionally interfere with plain static files.

## What was removed

This site used to run on a PHP/MySQL backend with login, admin, and raid sign-up pages. That has been stripped out for now in favor of this simple static roster page. If authentication, raid sign-ups, or an admin panel are needed again later, that functionality would need to be rebuilt.
