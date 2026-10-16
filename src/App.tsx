import { db } from './lib/db'
import { href, useRoute, useTheme } from './lib/hooks'
import { Login } from './components/Login'
import { DeckList } from './components/DeckList'
import { DeckView } from './components/DeckView'
import { Review } from './components/Review'

export default function App() {
  const { isLoading, user, error } = db.useAuth()
  const theme = useTheme()

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href={href.home()}>
          <span className="brand-mark" aria-hidden>▚</span> flashcards
        </a>
        <div className="topbar-actions">
          {user && <SyncPip />}
          <button className="btn ghost small" onClick={theme.cycle} title="Toggle theme">
            {theme.pref === 'system' ? '◐' : theme.pref === 'light' ? '☀' : '☾'}
            <span className="hide-sm">{theme.pref === 'system' ? 'auto' : theme.pref}</span>
          </button>
          {user && (
            <button className="btn ghost small" onClick={() => db.auth.signOut()}>
              sign out
            </button>
          )}
        </div>
      </header>
      <main className="page">
        {isLoading ? (
          <p className="muted blink">loading…</p>
        ) : error ? (
          <p className="error">{error.message}</p>
        ) : user ? (
          <Routes userId={user.id} />
        ) : (
          <Login />
        )}
      </main>
    </div>
  )
}

function Routes({ userId }: { userId: string }) {
  const route = useRoute()
  if (route.name === 'deck') return <DeckView userId={userId} deckId={route.deckId} />
  if (route.name === 'review') return <Review userId={userId} deckId={route.deckId} />
  return <DeckList userId={userId} />
}

function SyncPip() {
  const status = db.useConnectionStatus()
  const online = status === 'authenticated' || status === 'opened'
  return (
    <span className={`pip ${online ? 'on' : 'off'}`} title={`sync: ${status}`}>
      <span className="hide-sm">{online ? 'synced' : 'offline'}</span>
    </span>
  )
}
