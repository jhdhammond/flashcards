import { useState, type FormEvent } from 'react'
import { db } from '../lib/db'

export function Login() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      const msg = (e as { body?: { message?: string } }).body?.message
      setErr(msg ?? (e as Error).message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function sendCode(e: FormEvent) {
    e.preventDefault()
    run(async () => {
      await db.auth.sendMagicCode({ email })
      setSentTo(email)
    })
  }

  function verify(e: FormEvent) {
    e.preventDefault()
    run(() => db.auth.signInWithMagicCode({ email: sentTo!, code }))
  }

  return (
    <section className="login">
      <h1 className="display">
        Welcome to <span className="accent">flashcards</span>
      </h1>
      <p className="muted">Spaced repetition that syncs everywhere and works offline.</p>

      {!sentTo ? (
        <form className="row" onSubmit={sendCode}>
          <input
            className="input"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <button className="btn primary" disabled={busy}>
            Send code
          </button>
        </form>
      ) : (
        <form className="row" onSubmit={verify}>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          <button className="btn primary" disabled={busy}>
            Sign in
          </button>
        </form>
      )}
      {sentTo && (
        <p className="muted small">
          Code sent to {sentTo}.{' '}
          <button className="link" onClick={() => setSentTo(null)}>
            Use a different email
          </button>
        </p>
      )}
      <p className="muted small">
        or{' '}
        <button className="link" onClick={() => run(() => db.auth.signInAsGuest())}>
          try it as a guest
        </button>
      </p>
      {err && <p className="error">{err}</p>}
    </section>
  )
}
