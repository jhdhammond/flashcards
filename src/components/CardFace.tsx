import { renderCloze } from '../lib/cloze'
import type { Note } from '../lib/db'

export function CardFace({ note, ord, revealed }: { note: Note; ord: number; revealed: boolean }) {
  if (note.kind === 'cloze') {
    return (
      <article className="card-face">
        <p className="card-text">
          {renderCloze(note.front, ord, revealed).map((s, i) =>
            s.kind === 'text' ? (
              <span key={i}>{s.text}</span>
            ) : s.kind === 'blank' ? (
              <span key={i} className="cloze-blank">
                [{s.hint ?? '…'}]
              </span>
            ) : (
              <span key={i} className="cloze-answer">
                {s.text}
              </span>
            ),
          )}
        </p>
        {revealed && note.back && (
          <>
            <hr className="rule" />
            <p className="card-extra">{note.back}</p>
          </>
        )}
      </article>
    )
  }

  return (
    <article className="card-face">
      <p className="card-text">{note.front}</p>
      {revealed && (
        <>
          <hr className="rule" />
          <p className="card-text answer">{note.back}</p>
        </>
      )}
    </article>
  )
}
