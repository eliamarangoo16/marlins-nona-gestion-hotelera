import { supabase } from '@/lib/supabase'
import { useQuery } from './useQuery'
import type { Enums } from '@/types/database'

export type StaffUser = { id: string; full_name: string | null; email: string; building_ids: string[] }

/** Usuarios activos con un rol dado y sus edificios (las asignaciones solo las ven admins). */
export function useStaff(role: Enums<'app_role'>, enabled = true) {
  const { data } = useQuery(async () => {
    const [p, a] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('role', role).eq('active', true).order('full_name'),
      supabase.from('building_assignments').select('user_id, building_id'),
    ])
    return (p.data ?? []).map<StaffUser>((u) => ({ ...u, building_ids: (a.data ?? []).filter((x) => x.user_id === u.id).map((x) => x.building_id) }))
  }, [role], enabled)
  return data ?? []
}
