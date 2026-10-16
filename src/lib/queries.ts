import { useLiveQuery } from 'dexie-react-hooks'
import type { CardRow, Note } from './db'
import { startOfDay, State } from './srs'
import { useStore } from './store'

// Live queries over IndexedDB: they re-run whenever the tables they read change,
// whether from a local write or a sync pull. `undefined` means still loading.

const live = <T extends { deleted: boolean }>(rows: T[]) => rows.filter((r) => !r.deleted)

/** How many new cards were introduced today, per deck (for the daily cap). */
export function useNewSeenToday(now: number): Map<string, number> {
  const { db } = useStore()
  const day = startOfDay(now)
  return (
    useLiveQuery(async () => {
      const counts = new Map<string, number>()
      const reviews = await db.reviews.where('reviewedAt').aboveOrEqual(day).toArray()
      for (const r of reviews) {
        if (r.state !== State.New) continue
        counts.set(r.deckId, (counts.get(r.deckId) ?? 0) + 1)
      }
      return counts
    }, [db, day]) ?? new Map()
  )
}

export function useDeckList() {
  const { db } = useStore()
  return useLiveQuery(async () => {
    const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()])
    const byDeck = new Map<string, CardRow[]>()
    for (const c of live(cards)) {
      const list = byDeck.get(c.deckId) ?? []
      list.push(c)
      byDeck.set(c.deckId, list)
    }
    return live(decks)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((d) => ({ ...d, cards: byDeck.get(d.id) ?? [] }))
  }, [db])
}

export type NoteWithCards = Note & { cards: CardRow[] }

/** A deck with its notes (newest first) and each note's cards; null if missing. */
export function useDeck(deckId: string) {
  const { db } = useStore()
  return useLiveQuery(async () => {
    const deck = await db.decks.get(deckId)
    if (!deck || deck.deleted) return null
    const [notes, cards] = await Promise.all([
      db.notes.where('deckId').equals(deckId).toArray(),
      db.cards.where('deckId').equals(deckId).toArray(),
    ])
    const byNote = new Map<string, CardRow[]>()
    for (const c of live(cards)) byNote.set(c.noteId, [...(byNote.get(c.noteId) ?? []), c])
    const withCards: NoteWithCards[] = live(notes)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((n) => ({ ...n, cards: byNote.get(n.id) ?? [] }))
    return { deck, notes: withCards, cards: withCards.flatMap((n) => n.cards) }
  }, [db, deckId])
}
