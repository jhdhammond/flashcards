/** Anki's blue / red / green trio: new · learning · review. */
export function Counts({
  fresh,
  learning,
  review,
}: {
  fresh: number
  learning: number
  review: number
}) {
  return (
    <span className="counts" title="new · learning · review">
      <span className="c-new">{fresh}</span>
      <span className="c-learn">{learning}</span>
      <span className="c-review">{review}</span>
    </span>
  )
}
