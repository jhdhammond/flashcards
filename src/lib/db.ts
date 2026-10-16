import { init, type InstaQLEntity } from '@instantdb/react'
import schema, { type AppSchema } from '../instant.schema'

const appId = import.meta.env.VITE_INSTANT_APP_ID
if (!appId) throw new Error('Missing VITE_INSTANT_APP_ID — see README')

export const db = init({ appId, schema, useDateObjects: false })

export type Deck = InstaQLEntity<AppSchema, 'decks'>
export type Note = InstaQLEntity<AppSchema, 'notes'>
export type CardRow = InstaQLEntity<AppSchema, 'cards'>
export type Review = InstaQLEntity<AppSchema, 'reviews'>
