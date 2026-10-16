import { db } from './db'
import { startOfDay, State } from './srs'

/** How many new cards were introduced today, per deck (for the daily cap). */
export function useNewSeenToday(userId: string, now: number): Map<string, number> {
  const { data } = db.useQuery({
    reviews: {
      $: { where: { ownerId: userId, reviewedAt: { $gte: startOfDay(now) } } },
      card: { deck: {} },
    },
  })
  const counts = new Map<string, number>()
  for (const r of data?.reviews ?? []) {
    const deckId = r.card?.deck?.id
    if (r.state !== State.New || !deckId) continue
    counts.set(deckId, (counts.get(deckId) ?? 0) + 1)
  }
  return counts
}
