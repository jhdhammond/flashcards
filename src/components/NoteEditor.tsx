import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ordsFor, saveNote, type NoteInput } from '../lib/actions'
import { nextOrd } from '../lib/cloze'
import type { NoteWithCards } from '../lib/queries'
import { useStore } from '../lib/store'

type Props = {
  deckId: string
  existing?: NoteWithCards
  onDone: () => void
}

export function NoteEditor({ deckId, existing, onDone }: Props) {
  const store = useStore()
  const [kind, setKind] = useState<NoteInput['kind']>(existing?.kind ?? 'basic')
  const [front, setFront] = useState(existing?.front ?? '')
  const [back, setBack] = useState(existing?.back ?? '')
  const frontRef = useRef<HTMLTextAreaElement>(null)

  const input: NoteInput = { kind, front, back }
  const cardCount = front.trim() ? ordsFor(input).length : 0
  const valid = kind === 'basic' ? front.trim() && back.trim() : cardCount > 0

  /** Wrap the selection in {{cN::…}}; Alt/Option reuses the last number like Anki. */
  function cloze(sameOrd = false) {
    const el = frontRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const n = Math.max(1, nextOrd(front) - (sameOrd ? 1 : 0))
    const picked = front.slice(s, e)
    const wrapped = `{{c${n}::${picked}}}`
    const text = front.slice(0, s) + wrapped + front.slice(e)
    setFront(text)
    requestAnimationFrame(() => {
      el.focus()
      // Put the caret inside the braces when nothing was selected.
      const caret = picked ? s + wrapped.length : s + wrapped.length - 2
      el.setSelectionRange(caret, caret)
    })
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      cloze(e.altKey)
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
  }

  function submit(e: FormEvent | KeyboardEvent) {
    e.preventDefault()
    if (!valid) return
    void saveNote(store, deckId, input, existing)
    if (existing) onDone()
    else {
      setFront('')
      setBack('')
      frontRef.current?.focus()
    }
  }

  return (
    <form className="panel editor" onSubmit={submit}>
      <div className="editor-head">
        <div className="seg" role="tablist">
          {(['basic', 'cloze'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={kind === k ? 'on' : ''}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <span className="muted small">{existing ? 'editing note' : 'new note'}</span>
      </div>

      <label className="field">
        <span className="label">{kind === 'basic' ? 'Front' : 'Text'}</span>
        <textarea
          ref={frontRef}
          className="input"
          rows={kind === 'cloze' ? 4 : 2}
          value={front}
          onChange={(e) => setFront(e.target.value)}
          onKeyDown={onKey}
          placeholder={
            kind === 'basic'
              ? 'What is the capital of Poland?'
              : 'The capital of {{c1::Poland}} is {{c2::Warsaw::city}}.'
          }
        />
      </label>
      {kind === 'cloze' && (
        <div className="row tight">
          <button type="button" className="btn small" onClick={() => cloze()}>
            [ … ] cloze
          </button>
          <span className="muted small">
            select text, then tap — or ⌘⇧C · {cardCount} card{cardCount === 1 ? '' : 's'}
          </span>
        </div>
      )}

      <label className="field">
        <span className="label">{kind === 'basic' ? 'Back' : 'Extra (optional)'}</span>
        <textarea
          className="input"
          rows={2}
          value={back}
          onChange={(e) => setBack(e.target.value)}
          onKeyDown={onKey}
          placeholder={kind === 'basic' ? 'Warsaw' : 'Shown after the answer'}
        />
      </label>

      <div className="row tight">
        <button className="btn primary" disabled={!valid}>
          {existing ? 'Save' : 'Add'}
        </button>
        {existing && (
          <button type="button" className="btn ghost" onClick={onDone}>
            cancel
          </button>
        )}
      </div>
    </form>
  )
}
