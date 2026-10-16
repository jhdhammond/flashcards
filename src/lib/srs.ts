import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from 'ts-fsrs'
import type { CardRow } from './db'

export { Rating, State }
export type { Grade }

// 90% target retention, Anki-like learning steps, fuzz on so cards spread out.
export const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    enable_fuzz: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  }),
)

export const NEW_PER_DAY = 20
/** Like Anki's "learn ahead limit": show learning cards due within this window. */
export const LEARN_AHEAD_MS = 20 * 60 * 1000

export type SrsFields = Pick<
  CardRow,
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'scheduledDays'
  | 'learningSteps'
  | 'reps'
  | 'lapses'
  | 'state'
  | 'lastReview'
>

export function fromFsrs(c: Card): SrsFields {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review?.getTime(),
  }
}

export function toFsrs(r: SrsFields): Card {
  const lastReview = r.lastReview ? new Date(r.lastReview) : undefined
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: 0, // derived from last_review by ts-fsrs
    scheduled_days: r.scheduledDays,
    learning_steps: r.learningSteps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state as State,
    last_review: lastReview,
  }
}

export function newSrsFields(now = Date.now()): SrsFields {
  return fromFsrs(createEmptyCard(new Date(now)))
}

export const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: Rating.Again, label: 'Again', key: '1' },
  { grade: Rating.Hard, label: 'Hard', key: '2' },
  { grade: Rating.Good, label: 'Good', key: '3' },
  { grade: Rating.Easy, label: 'Easy', key: '4' },
]

/** Human interval like Anki's button labels: "<1m", "10m", "4d", "2.3mo". */
export function formatInterval(ms: number): string {
  const m = ms / 60000
  if (m < 1) return '<1m'
  if (m < 60) return `${Math.round(m)}m`
  const h = m / 60
  if (h < 24) return `${Math.round(h)}h`
  const d = h / 24
  if (d < 30) return `${Math.round(d)}d`
  if (d < 365) return `${(d / 30).toFixed(1).replace(/\.0$/, '')}mo`
  return `${(d / 365).toFixed(1).replace(/\.0$/, '')}y`
}

export function startOfDay(now = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

type CountableCard = Pick<CardRow, 'due' | 'state'>

/** Anki-style counts: new (capped), learning, review — all due now-ish. */
export function dueCounts(
  cards: CountableCard[],
  newSeenToday: number,
  now = Date.now(),
) {
  let fresh = 0
  let learning = 0
  let review = 0
  for (const c of cards) {
    if (c.state === State.New) fresh++
    else if (c.state === State.Review) {
      if (c.due <= now) review++
    } else if (c.due <= now + LEARN_AHEAD_MS) learning++
  }
  return { fresh: Math.min(fresh, Math.max(0, NEW_PER_DAY - newSeenToday)), learning, review }
}
