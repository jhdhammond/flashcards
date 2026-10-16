// Anki cloze syntax: {{c1::answer}} or {{c1::answer::hint}}
const CLOZE_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'blank'; hint?: string }
  | { kind: 'answer'; text: string }

/** The distinct cloze numbers in a note, sorted. */
export function clozeOrds(text: string): number[] {
  const ords = new Set<number>()
  for (const m of text.matchAll(CLOZE_RE)) ords.add(Number(m[1]))
  return [...ords].sort((a, b) => a - b)
}

/**
 * Split a cloze note into segments for card `ord`. The active deletion is a
 * blank (front) or highlighted answer (back); other deletions show plainly.
 */
export function renderCloze(text: string, ord: number, revealed: boolean): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of text.matchAll(CLOZE_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push({ kind: 'text', text: text.slice(last, idx) })
    const [, n, answer, hint] = m
    if (Number(n) !== ord) out.push({ kind: 'text', text: answer })
    else if (revealed) out.push({ kind: 'answer', text: answer })
    else out.push({ kind: 'blank', hint })
    last = idx + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

/** Plain-text preview with cloze markup stripped. */
export function stripCloze(text: string): string {
  return text.replace(CLOZE_RE, (_m, _n, answer) => answer)
}

/** Next unused cloze number (Anki's Ctrl+Shift+C behaviour). */
export function nextOrd(text: string): number {
  const ords = clozeOrds(text)
  return ords.length ? ords[ords.length - 1] + 1 : 1
}
