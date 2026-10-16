import type { InstantRules } from '@instantdb/react'

// Each user can only see and touch their own rows.
const owned = {
  allow: {
    view: 'isOwner',
    create: 'isOwner',
    update: 'isOwner && newData.ownerId == auth.id',
    delete: 'isOwner',
  },
  bind: ['isOwner', 'auth.id != null && auth.id == data.ownerId'],
}

const rules = {
  attrs: { allow: { create: 'false' } },
  decks: owned,
  notes: owned,
  cards: owned,
  reviews: owned,
} satisfies InstantRules

export default rules
