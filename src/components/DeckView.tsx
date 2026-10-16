import { useState } from 'react'
import { deleteDeck, deleteNote, renameDeck } from '../lib/actions'
import { stripCloze } from '../lib/cloze'
import { db } from '../lib/db'
import { href, useNow } from '../lib/hooks'
import { useNewSeenToday } from '../lib/queries'
import { dueCounts } from '../lib/srs'
import { Counts } from './Counts'
import { NoteEditor } from './NoteEditor'

export function DeckView({ userId, deckId }: { userId: string; deckId: string }) {
  const now = useNow()
  const { isLoading, data } = db.useQuery({
    decks: {
      $: { where: { id: deckId } },
      notes: { $: { order: { createdAt: 'desc' } }, cards: {} },
    },
  })
  const newSeen = useNewSeenToday(userId, now)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (isLoading) return <p className="muted blink">loading…</p>
  const deck = data?.decks[0]
  if (!deck) return <NotFound />

  const cards = deck.notes.flatMap((n) => n.cards)
  const counts = dueCounts(cards, newSeen.get(deck.id) ?? 0, now)
  const editing = deck.notes.find((n) => n.id === editingId)

  function rename() {
    const name = prompt('Rename deck', deck!.name)?.trim()
    if (name) renameDeck(deckId, name)
  }

  function remove() {
    if (!confirm(`Delete "${deck!.name}" and all ${cards.length} cards?`)) return
    deleteDeck(deckId)
    location.hash = href.home()
  }

  return (
    <section>
      <a className="back" href={href.home()}>
        ← decks
      </a>
      <div className="deck-head">
        <h1 className="display">{deck.name}</h1>
        <div className="row tight">
          <button className="btn ghost small" onClick={rename}>
            rename
          </button>
          <button className="btn ghost small danger" onClick={remove}>
            delete
          </button>
        </div>
      </div>

      <div className="study-bar">
        <Counts {...counts} />
        <span className="muted small">{cards.length} cards</span>
        <a className="btn primary" href={href.review(deck.id)}>
          Study now
        </a>
      </div>

      <NoteEditor
        key={editing?.id ?? 'new'}
        userId={userId}
        deckId={deckId}
        existing={editing}
        onDone={() => setEditingId(null)}
      />

      <h2 className="section-title">Notes</h2>
      {deck.notes.length === 0 ? (
        <p className="muted">No notes yet.</p>
      ) : (
        <ul className="note-list">
          {deck.notes.map((n) => (
            <li key={n.id} className={`note-row ${n.id === editingId ? 'active' : ''}`}>
              <span className="tag">{n.kind === 'cloze' ? `cloze ×${n.cards.length}` : 'basic'}</span>
              <span className="note-text">
                {n.kind === 'cloze' ? stripCloze(n.front) : n.front}
              </span>
              <span className="row tight">
                <button className="btn ghost small" onClick={() => setEditingId(n.id)}>
                  edit
                </button>
                <button
                  className="btn ghost small danger"
                  onClick={() => confirm('Delete this note?') && deleteNote(n.id)}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NotFound() {
  return (
    <section>
      <p className="muted">That deck doesn't exist (or isn't yours).</p>
      <a className="btn" href={href.home()}>
        ← decks
      </a>
    </section>
  )
}
