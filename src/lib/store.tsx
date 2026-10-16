import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { LocalDB } from './db'
import { Sync } from './sync'

/** One user's on-device database plus the engine that syncs it. */
export type Store = { userId: string; db: LocalDB; sync: Sync }

const stores = new Map<string, Store>()

function openStore(userId: string): Store {
  let s = stores.get(userId)
  if (!s) {
    const db = new LocalDB(userId)
    s = { userId, db, sync: new Sync(db, userId) }
    stores.set(userId, s)
  }
  return s
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const store = openStore(userId)
  useEffect(() => {
    store.sync.start()
    return () => store.sync.stop()
  }, [store])
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

export function useSyncStatus() {
  const { sync } = useStore()
  return useSyncExternalStore(sync.subscribe, () => sync.status)
}
