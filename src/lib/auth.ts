import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AuthUser = { id: string; email?: string; isGuest: boolean }

// The last signed-in user is cached so the app opens straight onto local data,
// even offline with an access token that can't be refreshed yet. Only an
// explicit sign-out (or Supabase revoking the session) clears it.
const KEY = 'flashcards:user'

function readCached(): AuthUser | null {
  try {
    const v = localStorage.getItem(KEY)
    return v ? (JSON.parse(v) as AuthUser) : null
  } catch {
    return null
  }
}

function writeCached(u: AuthUser | null) {
  try {
    if (u) localStorage.setItem(KEY, JSON.stringify(u))
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked: we'll just need the network on next launch
  }
}

const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  email: u.email,
  isGuest: !!u.is_anonymous,
})

/** undefined while we don't know yet, null when signed out. */
export function useAuth(): AuthUser | null | undefined {
  const [user, setUser] = useState<AuthUser | null | undefined>(() => readCached() ?? undefined)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const u = toAuthUser(session.user)
        writeCached(u)
        setUser(u)
      } else if (event === 'SIGNED_OUT') {
        writeCached(null)
        setUser(null)
      } else {
        setUser((prev) => prev ?? null)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return user
}

export async function signOut() {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } finally {
    writeCached(null)
    location.reload()
  }
}
