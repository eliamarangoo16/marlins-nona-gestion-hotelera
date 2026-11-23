import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { can, type Permiso, type Role } from '@/lib/permissions'
import { disablePush } from '@/lib/push'

type Profile = Tables<'profiles'>

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: Role | null
  assignedBuildingIds: string[]
  loading: boolean
  recovery: boolean
  can: (p: Permiso) => boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  sendReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refreshProfile: () => Promise<void>
  clearRecovery: () => void
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assigned, setAssigned] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const hasProfile = useRef(false)
  hasProfile.current = !!profile

  const loadProfile = useCallback(async (userId: string) => {
    const [p, a] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('building_assignments').select('building_id').eq('user_id', userId),
    ])
    setProfile(p.data ?? null)
    setAssigned((a.data ?? []).map((r) => r.building_id))
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      if (mounted) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setAssigned([])
      } else if (s && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        // diferido para no bloquear el callback de auth; solo se muestra cargando si aún no hay perfil
        if (!hasProfile.current) setLoading(true)
        setTimeout(() => void loadProfile(s.user.id).finally(() => setLoading(false)), 0)
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthState>(() => {
    const role = profile?.role ?? null
    return {
      session,
      user: session?.user ?? null,
      profile,
      role,
      assignedBuildingIds: assigned,
      loading,
      recovery,
      can: (p) => can(profile?.active ? role : null, p),
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      signUp: async (email, password, fullName) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        })
        if (error) throw error
        return { needsConfirmation: !data.session }
      },
      signOut: async () => {
        try {
          await disablePush()
        } catch {
          /* sin suscripción o sin soporte: continuar */
        }
        await supabase.auth.signOut()
      },
      sendReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}cambiar-contrasena`,
        })
        if (error) throw error
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
      },
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id)
      },
      clearRecovery: () => setRecovery(false),
    }
  }, [session, profile, assigned, loading, recovery, loadProfile])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fuera de AuthProvider')
  return c
}
