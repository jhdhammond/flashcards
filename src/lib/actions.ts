import { id, type TransactionChunk } from '@instantdb/react'
import { clozeOrds } from './cloze'
import { db, type CardRow, type Note } from './db'
import { newSrsFields, scheduler, toFsrs, fromFsrs, type Grade } from './srs'

// All writes go through db.transact, which applies locally first and queues
// for the server — so every action here works offline.

export function createDeck(ownerId: string, name: string) {
  const deckId = id()
  db.transact(db.tx.decks[deckId].update({ ownerId, name, createdAt: Date.now() }))
  return deckId
}

export function renameDeck(deckId: string, name: string) {
  db.transact(db.tx.decks[deckId].update({ name }))
}

export function deleteDeck(deckId: string) {
  // notes cascade from the deck, cards from notes, reviews from cards
  db.transact(db.tx.decks[deckId].delete())
}

export type NoteInput = { kind: 'basic' | 'cloze'; front: string; back: string }

export function ordsFor(input: NoteInput): number[] {
  return input.kind === 'basic' ? [0] : clozeOrds(input.front)
}

/** Create or update a note, then add/remove its cards to match its ords. */
export function saveNote(
  ownerId: string,
  deckId: string,
  input: NoteInput,
  existing?: Note & { cards: CardRow[] },
) {
  const noteId = existing?.id ?? id()
  const now = Date.now()
  const txs: TransactionChunk<any, any>[] = [
    db.tx.notes[noteId]
      .update({
        ownerId,
        kind: input.kind,
        front: input.front,
        back: input.back,
        createdAt: existing?.createdAt ?? now,
      })
      .link({ deck: deckId }),
  ]

  const wanted = new Set(ordsFor(input))
  const have = existing?.cards ?? []
  // Switching basic <-> cloze resets the cards since ords change meaning.
  const kindChanged = existing && existing.kind !== input.kind
  for (const c of have) {
    if (kindChanged || !wanted.has(c.ord)) txs.push(db.tx.cards[c.id].delete())
  }
  const kept = new Set(kindChanged ? [] : have.map((c) => c.ord))
  for (const ord of wanted) {
    if (kept.has(ord)) continue
    txs.push(
      db.tx.cards[id()]
        .update({ ownerId, ord, ...newSrsFields(now) })
        .link({ note: noteId, deck: deckId }),
    )
  }
  db.transact(txs)
  return noteId
}

export function deleteNote(noteId: string) {
  db.transact(db.tx.notes[noteId].delete())
}

/** Grade a card with FSRS and log the review. */
export function answerCard(ownerId: string, card: CardRow, grade: Grade) {
  const now = new Date()
  const { card: next, log } = scheduler.next(toFsrs(card), now, grade)
  db.transact([
    db.tx.cards[card.id].update(fromFsrs(next)),
    db.tx.reviews[id()]
      .update({ ownerId, rating: grade, state: log.state, reviewedAt: now.getTime() })
      .link({ card: card.id }),
  ])
}

/** Preview the next due time for each grade (for the button labels). */
export function previewIntervals(card: CardRow, now = new Date()) {
  const preview = scheduler.repeat(toFsrs(card), now)
  return (grade: Grade) => preview[grade].card.due.getTime() - now.getTime()
}
