import Dexie, { type EntityTable } from 'dexie'

// The whole deck collection lives on the device in IndexedDB (one database per
// user), so the app works fully offline. src/lib/sync.ts mirrors it to Postgres.

/** Fields every synced row carries. `dirty` is local-only: 1 = not pushed yet. */
type Synced = { id: string; updatedAt: number; deleted: boolean; dirty: 0 | 1 }

export type Deck = Synced & { name: string; createdAt: number }

export type Note = Synced & {
  deckId: string
  kind: 'basic' | 'cloze'
  front: string // basic: question. cloze: text with {{c1::...}}
  back: string // basic: answer. cloze: optional extra info
  createdAt: number
}

export type CardRow = Synced & {
  deckId: string
  noteId: string
  ord: number // 0 for basic, N for cloze cN
  // FSRS state (mirrors ts-fsrs Card)
  due: number
  stability: number
  difficulty: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: number
  lastReview?: number | null
}

export type Review = Synced & {
  deckId: string
  cardId: string
  rating: number
  state: number // card state before this review
  reviewedAt: number
}

export const TABLES = ['decks', 'notes', 'cards', 'reviews'] as const
export type TableName = (typeof TABLES)[number]

/** Columns sent to the server, in camelCase (sync.ts maps to snake_case). */
export const COLUMNS: Record<TableName, string[]> = {
  decks: ['id', 'name', 'createdAt', 'updatedAt', 'deleted'],
  notes: ['id', 'deckId', 'kind', 'front', 'back', 'createdAt', 'updatedAt', 'deleted'],
  cards: [
    'id', 'deckId', 'noteId', 'ord', 'due', 'stability', 'difficulty', 'scheduledDays',
    'learningSteps', 'reps', 'lapses', 'state', 'lastReview', 'updatedAt', 'deleted',
  ],
  reviews: ['id', 'deckId', 'cardId', 'rating', 'state', 'reviewedAt', 'updatedAt', 'deleted'],
}

export class LocalDB extends Dexie {
  decks!: EntityTable<Deck, 'id'>
  notes!: EntityTable<Note, 'id'>
  cards!: EntityTable<CardRow, 'id'>
  reviews!: EntityTable<Review, 'id'>
  meta!: EntityTable<{ key: string; value: string }, 'key'>

  constructor(userId: string) {
    super(`flashcards-${userId}`)
    this.version(1).stores({
      decks: 'id, dirty',
      notes: 'id, deckId, dirty',
      cards: 'id, deckId, noteId, dirty',
      reviews: 'id, deckId, reviewedAt, dirty',
      meta: 'key',
    })
  }
}

/** Stamp a local write: newest updatedAt wins on the server, dirty queues the push. */
export const stamp = () => ({ updatedAt: Date.now(), dirty: 1 as const })

/** randomUUID needs a secure context; fall back so plain-http LAN testing works. */
export function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
