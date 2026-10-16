import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const THEME_KEY = 'flashcards:theme'

function readTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // storage blocked: fall through to system
  }
  return 'system'
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readTheme)
  useEffect(() => {
    const root = document.documentElement
    if (pref === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', pref)
    try {
      localStorage.setItem(THEME_KEY, pref)
    } catch {
      // ignore
    }
  }, [pref])
  const cycle = () =>
    setPref((p) => (p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system'))
  return { pref, cycle }
}

/** Minimal hash router: #/, #/deck/:id, #/review/:id */
export type Route =
  | { name: 'home' }
  | { name: 'deck'; deckId: string }
  | { name: 'review'; deckId: string }

function parse(hash: string): Route {
  const [, kind, deckId] = hash.replace(/^#/, '').split('/')
  if (kind === 'deck' && deckId) return { name: 'deck', deckId }
  if (kind === 'review' && deckId) return { name: 'review', deckId }
  return { name: 'home' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const on = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const href = {
  home: () => '#/',
  deck: (id: string) => `#/deck/${id}`,
  review: (id: string) => `#/review/${id}`,
}

/** Re-render on an interval so "due now" stays fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
