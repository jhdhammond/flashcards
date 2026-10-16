import { signOut, useAuth, type AuthUser } from './lib/auth'
import { href, useRoute, useTheme } from './lib/hooks'
import { StoreProvider, useSyncStatus } from './lib/store'
import { Login } from './components/Login'
import { DeckList } from './components/DeckList'
import { DeckView } from './components/DeckView'
import { Review } from './components/Review'

export default function App() {
  const user = useAuth()
  const theme = useTheme()

  const header = (
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
        {user && <SignOut user={user} />}
      </div>
    </header>
  )

  return (
    <div className="shell">
      {user ? (
        <StoreProvider userId={user.id}>
          {header}
          <main className="page">
            <Routes />
          </main>
        </StoreProvider>
      ) : (
        <>
          {header}
          <main className="page">
            {user === undefined ? <p className="muted blink">loading…</p> : <Login />}
          </main>
        </>
      )}
    </div>
  )
}

function Routes() {
  const route = useRoute()
  if (route.name === 'deck') return <DeckView deckId={route.deckId} />
  if (route.name === 'review') return <Review deckId={route.deckId} />
  return <DeckList />
}

function SignOut({ user }: { user: AuthUser }) {
  function go() {
    if (user.isGuest && !confirm('Guest decks can’t be recovered after signing out. Sign out?')) return
    void signOut()
  }
  return (
    <button className="btn ghost small" onClick={go} title={user.email ?? 'guest'}>
      sign out
    </button>
  )
}

const PIP_LABEL = {
  idle: 'synced',
  syncing: 'syncing',
  offline: 'offline',
  'signed-out': 'sign in to sync',
  error: 'sync error',
} as const

function SyncPip() {
  const { state, pending, error } = useSyncStatus()
  const on = state === 'idle' || state === 'syncing'
  const label = pending && state !== 'syncing' ? `${pending} unsynced` : PIP_LABEL[state]
  return (
    <span className={`pip ${on ? 'on' : 'off'}`} title={error ?? `sync: ${state}`}>
      <span className="hide-sm">{label}</span>
    </span>
  )
}
