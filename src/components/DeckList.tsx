import { useState, type FormEvent } from 'react'
import { createDeck } from '../lib/actions'
import { db } from '../lib/db'
import { href, useNow } from '../lib/hooks'
import { useNewSeenToday } from '../lib/queries'
import { dueCounts } from '../lib/srs'
import { Counts } from './Counts'

export function DeckList({ userId }: { userId: string }) {
  const now = useNow()
  const { isLoading, data } = db.useQuery({
    decks: {
      $: { where: { ownerId: userId }, order: { createdAt: 'asc' } },
      cards: { $: { fields: ['due', 'state'] } },
    },
  })
  const newSeen = useNewSeenToday(userId, now)
  const [name, setName] = useState('')

  function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const deckId = createDeck(userId, name.trim())
    setName('')
    location.hash = href.deck(deckId)
  }

  const decks = data?.decks ?? []

  return (
    <section>
      <h1 className="display">Decks</h1>
      {isLoading ? (
        <p className="muted blink">loading…</p>
      ) : decks.length === 0 ? (
        <p className="muted">No decks yet. Make your first one below.</p>
      ) : (
        <ul className="deck-list">
          {decks.map((d) => {
            const counts = dueCounts(d.cards, newSeen.get(d.id) ?? 0, now)
            const anyDue = counts.fresh + counts.learning + counts.review > 0
            return (
              <li key={d.id} className="deck-row">
                <a className="deck-name" href={href.deck(d.id)}>
                  {d.name}
                </a>
                <Counts {...counts} />
                <a
                  className={`btn small ${anyDue ? 'primary' : ''}`}
                  href={href.review(d.id)}
                  aria-disabled={!anyDue}
                >
                  Study
                </a>
              </li>
            )
          })}
        </ul>
      )}

      <form className="row" onSubmit={add}>
        <input
          className="input"
          placeholder="New deck name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn">+ Deck</button>
      </form>
    </section>
  )
}
