import type { RealtimeChannel } from '@supabase/supabase-js'
import { COLUMNS, TABLES, type LocalDB, type TableName } from './db'
import { supabase } from './supabase'

// Sync between the device's IndexedDB and Postgres. The contract is in
// supabase/migrations/*_flashcards.sql; in short:
//   push: upsert every dirty row; the server keeps whichever updatedAt is newer.
//   pull: fetch rows whose server_updated_at is past our cursor, keep the newer.
// Realtime events, coming back online and a timer just schedule another run.

export type SyncState = 'idle' | 'syncing' | 'offline' | 'signed-out' | 'error'
export type SyncStatus = { state: SyncState; pending: number; error?: string }

const PAGE = 1000
const PUSH_BATCH = 500
/** Re-read a little behind the cursor in case a slow commit landed out of order. */
const OVERLAP_MS = 10_000

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const camel = (k: string) => k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())

type Row = Record<string, unknown> & { id: string; updatedAt: number }

function toServer(t: TableName, r: Row) {
  return Object.fromEntries(COLUMNS[t].map((k) => [snake(k), r[k] ?? null]))
}

function fromServer(r: Record<string, unknown>): Row {
  const out: Record<string, unknown> = { dirty: 0 }
  for (const [k, v] of Object.entries(r)) {
    if (k !== 'owner_id' && k !== 'server_updated_at') out[camel(k)] = v
  }
  return out as Row
}

export class Sync {
  status: SyncStatus = { state: 'idle', pending: 0 }
  private listeners = new Set<() => void>()
  private timer?: ReturnType<typeof setTimeout>
  private running = false
  private again = false
  private cleanup: (() => void)[] = []

  private db: LocalDB
  private userId: string

  constructor(db: LocalDB, userId: string) {
    this.db = db
    this.userId = userId
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(next: Partial<SyncStatus>) {
    this.status = { ...this.status, ...next }
    for (const fn of this.listeners) fn()
  }

  start() {
    const now = () => this.schedule(0)
    const onVisible = () => document.visibilityState === 'visible' && now()
    window.addEventListener('online', now)
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(now, 60_000)

    let channel: RealtimeChannel = supabase.channel(`sync-${this.userId}-${Date.now()}`)
    for (const table of TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `owner_id=eq.${this.userId}` },
        () => this.schedule(250),
      )
    }
    channel.subscribe()

    this.cleanup = [
      () => window.removeEventListener('online', now),
      () => document.removeEventListener('visibilitychange', onVisible),
      () => clearInterval(interval),
      () => void supabase.removeChannel(channel),
      () => clearTimeout(this.timer),
    ]
    now()
  }

  stop() {
    for (const fn of this.cleanup) fn()
    this.cleanup = []
  }

  /** Call after a local write; batches bursts of writes into one push. */
  schedule(delay = 300) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.run(), delay)
    void this.countPending()
  }

  async run() {
    if (this.running) {
      this.again = true
      return
    }
    this.running = true
    try {
      if (!navigator.onLine) return this.set({ state: 'offline' })
      const { data } = await supabase.auth.getSession()
      if (!data.session) return this.set({ state: 'signed-out' })
      this.set({ state: 'syncing', error: undefined })
      await this.push()
      await this.pull()
      this.set({ state: 'idle' })
    } catch (e) {
      // fetch() rejects with a TypeError when the network is unreachable.
      if (e instanceof TypeError || !navigator.onLine) this.set({ state: 'offline' })
      else this.set({ state: 'error', error: (e as { message?: string }).message ?? String(e) })
    } finally {
      this.running = false
      await this.countPending()
      if (this.again) {
        this.again = false
        this.schedule(0)
      }
    }
  }

  private async countPending() {
    let pending = 0
    for (const t of TABLES) pending += await this.db.table(t).where('dirty').equals(1).count()
    if (pending !== this.status.pending) this.set({ pending })
  }

  private async push() {
    for (const t of TABLES) {
      const table = this.db.table<Row, string>(t)
      for (let i = 0; i < 50; i++) {
        const rows = await table.where('dirty').equals(1).limit(PUSH_BATCH).toArray()
        if (!rows.length) break
        const { error } = await supabase
          .from(t)
          .upsert(rows.map((r) => toServer(t, r)), { onConflict: 'id' })
        if (error) throw error
        // Only clear rows that weren't edited again while the request was out.
        await this.db.transaction('rw', table, async () => {
          for (const r of rows) {
            const cur = await table.get(r.id)
            if (cur?.updatedAt === r.updatedAt) await table.update(r.id, { dirty: 0 })
          }
        })
        if (rows.length < PUSH_BATCH) break
      }
    }
  }

  private async pull() {
    for (const t of TABLES) {
      const key = `cursor:${t}`
      const saved = (await this.db.meta.get(key))?.value
      let since = saved ? new Date(new Date(saved).getTime() - OVERLAP_MS).toISOString() : null
      for (let i = 0; i < 1000; i++) {
        let q = supabase
          .from(t)
          .select('*')
          .eq('owner_id', this.userId)
          .order('server_updated_at')
          .order('id')
          .limit(PAGE)
        if (since) q = q.gt('server_updated_at', since)
        const { data, error } = await q
        if (error) throw error
        if (data.length) {
          // Keep the raw string: it has microseconds, which a JS Date would drop.
          since = data[data.length - 1].server_updated_at as string
          await this.apply(t, data, key, since)
        }
        if (data.length < PAGE) break
      }
    }
  }

  private async apply(t: TableName, data: Record<string, unknown>[], key: string, cursor: string) {
    const table = this.db.table<Row, string>(t)
    const incoming = data.map(fromServer)
    await this.db.transaction('rw', table, this.db.meta, async () => {
      const existing = await table.bulkGet(incoming.map((r) => r.id))
      // Newest write wins; a dirty local row that's newer will be pushed next.
      const newer = incoming.filter((r, i) => !existing[i] || r.updatedAt > existing[i]!.updatedAt)
      if (newer.length) await table.bulkPut(newer)
      await this.db.meta.put({ key, value: cursor })
    })
  }
}
