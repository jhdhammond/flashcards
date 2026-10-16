import { i } from '@instantdb/react'

// Anki-style model: a deck holds notes; each note generates one or more cards.
// A basic note makes one card, a cloze note makes one card per {{cN::...}}.
// Every row carries ownerId so permissions are a simple equality check.
const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    decks: i.entity({
      ownerId: i.string().indexed(),
      name: i.string(),
      createdAt: i.number().indexed(),
    }),
    notes: i.entity({
      ownerId: i.string().indexed(),
      kind: i.string<'basic' | 'cloze'>(),
      front: i.string(), // basic: question. cloze: text with {{c1::...}}
      back: i.string(), // basic: answer. cloze: optional extra info
      createdAt: i.number().indexed(),
    }),
    cards: i.entity({
      ownerId: i.string().indexed(),
      ord: i.number(), // 0 for basic, N for cloze cN
      // FSRS state (mirrors ts-fsrs Card)
      due: i.number().indexed(),
      stability: i.number(),
      difficulty: i.number(),
      scheduledDays: i.number(),
      learningSteps: i.number(),
      reps: i.number(),
      lapses: i.number(),
      state: i.number(),
      lastReview: i.number().optional(),
    }),
    reviews: i.entity({
      ownerId: i.string().indexed(),
      rating: i.number(),
      state: i.number(),
      reviewedAt: i.number().indexed(),
    }),
  },
  links: {
    deckNotes: {
      forward: { on: 'decks', has: 'many', label: 'notes' },
      reverse: { on: 'notes', has: 'one', label: 'deck', onDelete: 'cascade' },
    },
    noteCards: {
      forward: { on: 'notes', has: 'many', label: 'cards' },
      reverse: { on: 'cards', has: 'one', label: 'note', onDelete: 'cascade' },
    },
    deckCards: {
      forward: { on: 'decks', has: 'many', label: 'cards' },
      reverse: { on: 'cards', has: 'one', label: 'deck' },
    },
    cardReviews: {
      forward: { on: 'cards', has: 'many', label: 'reviews' },
      reverse: { on: 'reviews', has: 'one', label: 'card', onDelete: 'cascade' },
    },
  },
})

type _AppSchema = typeof _schema
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema

export type { AppSchema }
export default schema
