# flashcards

A tiny, pixel-flavoured spaced-repetition app. Installable as a PWA, syncs across
devices, keeps working offline, supports many users.

- **Anki-style review**: FSRS scheduling via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)
  (the algorithm modern Anki uses), Again / Hard / Good / Easy with interval
  previews, learning steps (1m, 10m), new/learning/review counts and a 20 new
  cards/day cap per deck.
- **Basic and cloze notes**: `{{c1::answer}}` or `{{c1::answer::hint}}`, one card
  per cloze number. Select text and hit ⌘⇧C (Ctrl+Shift+C) to wrap it.
- **Local-first**: your whole collection lives on the device in IndexedDB
  ([Dexie](https://dexie.org)). Every read and write is local, so it works with
  no signal at all; changes sync to Postgres when the connection is back.
- **Accounts**: email code sign-in (or guest) via Supabase Auth. Row-level
  security restricts every row to its owner.
- **Light / dark / auto** theme.

## Stack

Vite + React + TypeScript · Dexie (IndexedDB) · Supabase (Postgres, Auth,
Realtime) · ts-fsrs · vite-plugin-pwa

No sync vendor: the sync engine is ~200 lines in [`src/lib/sync.ts`](src/lib/sync.ts),
and the data is plain Postgres tables you own.

## How sync works

```
 device (IndexedDB)                         Supabase (Postgres)
 ──────────────────                         ───────────────────
 write → row.dirty = 1, updatedAt = now ──push──▶ upsert; trigger drops it
                                                  if stored updatedAt is newer
 apply if newer than local ◀──pull── rows with server_updated_at > cursor
                            ◀─realtime─ "something changed" → pull now
```

- IDs are client-generated UUIDs, so rows can be created offline.
- Conflicts: last write wins per row (by `updatedAt`).
- Deletes are soft (`deleted = true`) so they sync like any other edit.
- Sync runs after each local write, on reconnect, when the app comes to the
  foreground, on a Realtime event, and every 60s.

## Run it locally

Needs Docker for the local Supabase stack.

```bash
npm install
supabase start            # local Postgres + Auth + Realtime on ports 553xx
supabase status           # copy API URL + publishable key into .env
cp .env.example .env
npm run dev
```

Sign-in emails land in the local mail catcher at http://127.0.0.1:55324.

## Hosted Supabase project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Push the schema:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
3. In the dashboard:
   - **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins** (for guest mode).
   - **Authentication → Emails → Magic Link**: put `{{ .Token }}` in the body so
     the email contains a 6-digit code (see [`supabase/templates/magic_link.html`](supabase/templates/magic_link.html)).
   - **Authentication → URL Configuration**: set the Site URL to your deployed URL.
4. Put the project URL and publishable key in `.env` (and in your host's env vars).

Free-plan projects pause after about a week with no activity. Your cards stay
on your devices and the app keeps working; resume the project from the
dashboard to sync again.

## Deploy

Any static host works. On Vercel: import the repo, set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`, deploy. HTTPS is required for the service
worker, so test the PWA install from the deployed URL.

On iOS, open the site in Safari → Share → **Add to Home Screen**.

## Data model

```
decks ─< notes ─< cards ─< reviews
```

Schema, triggers and RLS: [`supabase/migrations/`](supabase/migrations/).

- **note**: `kind` (`basic` | `cloze`), `front`, `back`
- **card**: `ord` (0 for basic, N for cloze cN) + FSRS state (`due`, `stability`,
  `difficulty`, `state`, `reps`, `lapses`, …)
- **review**: rating + timestamp, kept so FSRS parameters can be optimised later

Editing a cloze note adds cards for new cloze numbers and removes cards whose
number disappeared; existing cards keep their history.
