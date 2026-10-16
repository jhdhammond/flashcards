import { useState, type FormEvent } from 'react'
import { createDeck } from '../lib/actions'
import { href, useNow } from '../lib/hooks'
import { useDeckList, useNewSeenToday } from '../lib/queries'
import { useStore } from '../lib/store'
import { dueCounts } from '../lib/srs'
import { Counts } from './Counts'

export function DeckList() {
  const store = useStore()
  const now = useNow()
  const decks = useDeckList()
  const newSeen = useNewSeenToday(now)
  const [name, setName] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const deckId = await createDeck(store, name.trim())
    setName('')
    location.hash = href.deck(deckId)
  }

  return (
    <section>
      <h1 className="display">Decks</h1>
      {!decks ? (
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
