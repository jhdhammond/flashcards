import { useEffect, useMemo, useState } from 'react'
import { answerCard, previewIntervals } from '../lib/actions'
import { db, type CardRow, type Note } from '../lib/db'
import { href, useNow } from '../lib/hooks'
import { useNewSeenToday } from '../lib/queries'
import {
  dueCounts,
  formatInterval,
  GRADES,
  LEARN_AHEAD_MS,
  NEW_PER_DAY,
  State,
  type Grade,
} from '../lib/srs'
import { CardFace } from './CardFace'
import { Counts } from './Counts'

type QCard = CardRow & { note?: Note }

/** Anki-ish queue: due learning → due reviews → new (daily cap) → learn-ahead. */
function buildQueue(cards: QCard[], newLeft: number, now: number): QCard[] {
  const byDue = (a: QCard, b: QCard) => a.due - b.due
  const learning = cards.filter((c) => c.state === State.Learning || c.state === State.Relearning)
  const learnNow = learning.filter((c) => c.due <= now).sort(byDue)
  const reviews = cards.filter((c) => c.state === State.Review && c.due <= now).sort(byDue)
  const fresh = cards
    .filter((c) => c.state === State.New)
    .sort((a, b) => (a.note?.createdAt ?? 0) - (b.note?.createdAt ?? 0) || a.ord - b.ord)
    .slice(0, Math.max(0, newLeft))
  const queue = [...learnNow, ...reviews, ...fresh]
  if (queue.length) return queue
  return learning.filter((c) => c.due <= now + LEARN_AHEAD_MS).sort(byDue)
}

export function Review({ userId, deckId }: { userId: string; deckId: string }) {
  const now = useNow(5_000)
  const { isLoading, data } = db.useQuery({
    decks: { $: { where: { id: deckId } }, cards: { note: {} } },
  })
  const newSeen = useNewSeenToday(userId, now)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)

  const deck = data?.decks[0]
  const cards = useMemo(() => (deck?.cards ?? []) as QCard[], [deck])
  const seen = newSeen.get(deckId) ?? 0
  const queue = useMemo(() => buildQueue(cards, NEW_PER_DAY - seen, now), [cards, seen, now])

  // Keep showing the same card until it's answered, even as live data updates.
  const current = queue.find((c) => c.id === currentId) ?? queue[0]
  if (current && current.id !== currentId) setCurrentId(current.id) // adjust during render
  const revealed = !!current && revealedId === current.id
  const reveal = () => current && setRevealedId(current.id)

  const intervals = useMemo(
    () => (current && revealed ? previewIntervals(current) : null),
    [current, revealed],
  )

  function grade(g: Grade) {
    if (!current) return
    answerCard(userId, current, g)
    setCurrentId(null)
    setRevealedId(null)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current || e.metaKey || e.ctrlKey) return
      // Don't let a focused button also receive the space/enter.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        reveal()
      } else if (revealed) {
        const g = GRADES.find((x) => x.key === e.key || (e.key === ' ' && x.key === '3'))
        if (g) {
          e.preventDefault()
          grade(g.grade)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (isLoading) return <p className="muted blink">loading…</p>
  if (!deck) return <p className="muted">Deck not found.</p>

  const counts = dueCounts(cards, seen, now)
  const nextLearn = cards
    .filter((c) => c.state === State.Learning || c.state === State.Relearning)
    .reduce<number | null>((m, c) => (m === null || c.due < m ? c.due : m), null)

  return (
    <section className="review">
      <div className="review-head">
        <a className="back" href={href.deck(deckId)}>
          ← {deck.name}
        </a>
        <Counts {...counts} />
      </div>

      {!current || !current.note ? (
        <div className="panel done">
          <h2 className="display">All done ✦</h2>
          <p className="muted">
            {nextLearn
              ? `Next learning card in ${formatInterval(nextLearn - now)}.`
              : "You've finished this deck for now."}
          </p>
          <a className="btn" href={href.deck(deckId)}>
            Back to deck
          </a>
        </div>
      ) : (
        <>
          <CardFace note={current.note} ord={current.ord} revealed={revealed} />
          <div className="answer-bar">
            {!revealed ? (
              <button className="btn primary wide" onClick={() => reveal()}>
                Show answer <kbd>space</kbd>
              </button>
            ) : (
              <div className="grades">
                {GRADES.map(({ grade: g, label, key }) => (
                  <button key={g} className={`btn grade g${g}`} onClick={() => grade(g)}>
                    <span className="grade-ivl">{intervals && formatInterval(intervals(g))}</span>
                    <span>{label}</span>
                    <kbd>{key}</kbd>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
