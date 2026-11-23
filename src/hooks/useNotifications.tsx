import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { useAuth } from '@/context/AuthContext'

type Notif = Tables<'notifications'>

type NotifState = {
  items: Notif[]
  unread: number
  loading: boolean
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  reload: () => Promise<void>
}
const Ctx = createContext<NotifState | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const active = !!user && !!profile?.active && profile.role !== 'sin_asignar'
  const userId = user?.id

  const reload = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    setItems(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!active || !userId) {
      setItems([])
      setLoading(false)
      return
    }
    void reload()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setItems((l) => [payload.new as Notif, ...l.filter((n) => n.id !== (payload.new as Notif).id)]),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setItems((l) => l.map((n) => (n.id === (payload.new as Notif).id ? (payload.new as Notif) : n))),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [active, userId, reload])

  const value = useMemo<NotifState>(
    () => ({
      items,
      unread: items.filter((n) => !n.read_at).length,
      loading,
      reload,
      markRead: async (id) => {
        const now = new Date().toISOString()
        setItems((l) => l.map((n) => (n.id === id ? { ...n, read_at: now } : n)))
        await supabase.from('notifications').update({ read_at: now }).eq('id', id)
      },
      markAllRead: async () => {
        if (!userId) return
        const now = new Date().toISOString()
        setItems((l) => l.map((n) => (n.read_at ? n : { ...n, read_at: now })))
        await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null)
      },
    }),
    [items, loading, reload, userId],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNotifications() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useNotifications fuera de NotificationsProvider')
  return c
}
