# flashcards

A tiny, pixel-flavoured spaced-repetition app. Installable as a PWA, syncs across
devices, keeps working offline, supports many users.

- **Anki-style review** — FSRS scheduling via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)
  (the algorithm modern Anki uses), Again / Hard / Good / Easy with interval
  previews, learning steps (1m, 10m), new/learning/review counts and a 20 new
  cards/day cap per deck.
- **Basic and cloze notes** — `{{c1::answer}}` or `{{c1::answer::hint}}`; one card
  per cloze number. Select text and hit ⌘⇧C (Ctrl+Shift+C) to wrap it.
- **Local-first sync** — [InstantDB](https://instantdb.com) keeps a local
  IndexedDB copy, applies writes optimistically and queues them while offline.
- **Accounts** — email magic-code sign-in (or guest). Permissions restrict every
  row to its owner.
- **Light / dark / auto** theme.

## Stack

Vite + React + TypeScript · InstantDB · ts-fsrs · vite-plugin-pwa

## Run it

```bash
npm install
cp .env.example .env   # then fill in VITE_INSTANT_APP_ID
npm run dev
```

### The Instant app

This repo was bootstrapped with a **temporary** Instant app, which deletes itself
roughly 24 hours after creation. To keep it, claim it into your Instant account:

```bash
npx instant-cli@latest login
npx instant-cli@latest claim
```

Or create your own app: `npx instant-cli@latest init`, put its ID in `.env`, then
push the schema and permissions:

```bash
npx instant-cli@latest push all
```

Schema lives in [`src/instant.schema.ts`](src/instant.schema.ts), permissions in
[`src/instant.perms.ts`](src/instant.perms.ts).

## Deploy

Any static host works. On Vercel: import the repo, set `VITE_INSTANT_APP_ID` in
the project's environment variables, deploy. HTTPS is required for the service
worker, so test the PWA install from the deployed URL (or `npm run build && npm run preview`).

On iOS, open the site in Safari → Share → **Add to Home Screen**.

## Data model

```
decks ─< notes ─< cards ─< reviews
```

- **note**: `kind` (`basic` | `cloze`), `front`, `back`
- **card**: `ord` (0 for basic, N for cloze cN) + FSRS state (`due`, `stability`,
  `difficulty`, `state`, `reps`, `lapses`, …)
- **review**: rating + timestamp, kept so FSRS parameters can be optimised later

Editing a cloze note adds cards for new cloze numbers and removes cards whose
number disappeared; existing cards keep their history.
