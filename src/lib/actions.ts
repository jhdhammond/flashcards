import { clozeOrds } from './cloze'
import { stamp, uuid, type CardRow, type Note } from './db'
import { newSrsFields, scheduler, toFsrs, fromFsrs, type Grade } from './srs'
import type { Store } from './store'

// Every write lands in IndexedDB first (so it works offline), marked dirty,
// then pokes the sync engine to push it when it can.

export async function createDeck({ db, sync }: Store, name: string) {
  const id = uuid()
  await db.decks.add({ id, name, createdAt: Date.now(), deleted: false, ...stamp() })
  sync.schedule()
  return id
}

export async function renameDeck({ db, sync }: Store, deckId: string, name: string) {
  await db.decks.update(deckId, { name, ...stamp() })
  sync.schedule()
}

export async function deleteDeck({ db, sync }: Store, deckId: string) {
  // Soft-delete the deck and everything in it so the deletes sync too.
  const gone = { deleted: true, ...stamp() }
  await db.transaction('rw', db.decks, db.notes, db.cards, async () => {
    await db.decks.update(deckId, gone)
    await db.notes.where('deckId').equals(deckId).modify(gone)
    await db.cards.where('deckId').equals(deckId).modify(gone)
  })
  sync.schedule()
}

export type NoteInput = { kind: 'basic' | 'cloze'; front: string; back: string }

export function ordsFor(input: NoteInput): number[] {
  return input.kind === 'basic' ? [0] : clozeOrds(input.front)
}

/** Create or update a note, then add/remove its cards to match its ords. */
export async function saveNote(
  { db, sync }: Store,
  deckId: string,
  input: NoteInput,
  existing?: Note & { cards: CardRow[] },
) {
  const noteId = existing?.id ?? uuid()
  const now = Date.now()
  const wanted = new Set(ordsFor(input))
  const have = existing?.cards ?? []
  // Switching basic <-> cloze resets the cards since ords change meaning.
  const kindChanged = existing && existing.kind !== input.kind
  const kept = new Set(kindChanged ? [] : have.map((c) => c.ord))

  await db.transaction('rw', db.notes, db.cards, async () => {
    await db.notes.put({
      id: noteId,
      deckId,
      kind: input.kind,
      front: input.front,
      back: input.back,
      createdAt: existing?.createdAt ?? now,
      deleted: false,
      ...stamp(),
    })
    for (const c of have) {
      if (kindChanged || !wanted.has(c.ord)) {
        await db.cards.update(c.id, { deleted: true, ...stamp() })
      }
    }
    for (const ord of wanted) {
      if (kept.has(ord)) continue
      await db.cards.add({
        id: uuid(),
        deckId,
        noteId,
        ord,
        ...newSrsFields(now),
        deleted: false,
        ...stamp(),
      })
    }
  })
  sync.schedule()
  return noteId
}

export async function deleteNote({ db, sync }: Store, noteId: string) {
  const gone = { deleted: true, ...stamp() }
  await db.transaction('rw', db.notes, db.cards, async () => {
    await db.notes.update(noteId, gone)
    await db.cards.where('noteId').equals(noteId).modify(gone)
  })
  sync.schedule()
}

/** Grade a card with FSRS and log the review. */
export async function answerCard({ db, sync }: Store, card: CardRow, grade: Grade) {
  const now = new Date()
  const { card: next, log } = scheduler.next(toFsrs(card), now, grade)
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.update(card.id, { ...fromFsrs(next), ...stamp() })
    await db.reviews.add({
      id: uuid(),
      deckId: card.deckId,
      cardId: card.id,
      rating: grade,
      state: log.state,
      reviewedAt: now.getTime(),
      deleted: false,
      ...stamp(),
    })
  })
  sync.schedule()
}

/** Preview the next due time for each grade (for the button labels). */
export function previewIntervals(card: CardRow, now = new Date()) {
  const preview = scheduler.repeat(toFsrs(card), now)
  return (grade: Grade) => preview[grade].card.due.getTime() - now.getTime()
}
