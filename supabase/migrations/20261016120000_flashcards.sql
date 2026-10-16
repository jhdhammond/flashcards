-- Flashcards: Anki-style model synced from a local-first client.
--
--   decks ─< notes ─< cards ─< reviews
--
-- Sync contract (see src/lib/sync.ts):
--   * ids are client-generated uuids, so rows can be created offline.
--   * updated_at (ms) is written by the client; the newest write wins.
--   * server_updated_at is stamped here and is the cursor clients pull from.
--   * deletes are soft (deleted = true) so they sync like any other change.
-- There are no foreign keys between these tables on purpose: rows arrive in
-- whatever order devices push them, and a parent may be deleted while another
-- device is offline adding children to it.

create table public.decks (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.notes (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  deck_id uuid not null,
  kind text not null check (kind in ('basic', 'cloze')),
  front text not null, -- basic: question. cloze: text with {{c1::...}}
  back text not null, -- basic: answer. cloze: optional extra info
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.cards (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  deck_id uuid not null,
  note_id uuid not null,
  ord int not null, -- 0 for basic, N for cloze cN
  -- FSRS state (mirrors ts-fsrs Card)
  due bigint not null,
  stability double precision not null,
  difficulty double precision not null,
  scheduled_days double precision not null,
  learning_steps int not null,
  reps int not null,
  lapses int not null,
  state int not null,
  last_review bigint,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- Append-only review log, kept so FSRS parameters can be optimised later.
create table public.reviews (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  deck_id uuid not null,
  card_id uuid not null,
  rating int not null,
  state int not null, -- card state before this review
  reviewed_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- Stamp the pull cursor, and drop writes older than what's stored so a device
-- coming back online can't clobber newer edits made elsewhere.
create function public.flashcards_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['decks', 'notes', 'cards', 'reviews'] loop
    execute format(
      'create trigger stamp before insert or update on public.%I
         for each row execute function public.flashcards_stamp()', t);
    execute format(
      'create index %I on public.%I (owner_id, server_updated_at)',
      t || '_pull_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Realtime just nudges clients to pull; RLS limits each user to their rows.
alter publication supabase_realtime add table
  public.decks, public.notes, public.cards, public.reviews;
