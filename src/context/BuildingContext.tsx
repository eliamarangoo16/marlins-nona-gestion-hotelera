import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { useAuth } from './AuthContext'
import { lsGet, lsSet } from '@/lib/storage'

type Building = Tables<'buildings'>
type Unit = Tables<'units'>

type BuildingState = {
  buildings: Building[]
  units: Unit[]
  loading: boolean
  /** 'all' o id de edificio */
  selected: string
  setSelected: (id: string) => void
  /** ids de edificios dentro del alcance del selector */
  scopeIds: string[]
  /** departamentos dentro del alcance */
  scopedUnits: Unit[]
  buildingName: (id: string | null | undefined) => string
  refresh: () => Promise<void>
}

const Ctx = createContext<BuildingState | null>(null)
const KEY = 'mn.building'

export function BuildingProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelectedState] = useState<string>(lsGet(KEY) || 'all')

  const refresh = useCallback(async () => {
    const [b, u] = await Promise.all([
      supabase.from('buildings').select('*').order('name'),
      supabase.from('units').select('*').order('name'),
    ])
    setBuildings(b.data ?? [])
    setUnits(u.data ?? [])
    setLoading(false)
  }, [])

  const usable = !!user && !!profile && profile.active && profile.role !== 'sin_asignar'
  useEffect(() => {
    if (usable) void refresh()
    else setLoading(false)
  }, [usable, refresh])

  // Si el edificio guardado ya no existe, volver a "todos"
  useEffect(() => {
    if (selected !== 'all' && buildings.length && !buildings.some((b) => b.id === selected)) {
      setSelectedState('all')
    }
  }, [buildings, selected])

  const setSelected = useCallback((id: string) => {
    setSelectedState(id)
    lsSet(KEY, id)
  }, [])

  const value = useMemo<BuildingState>(() => {
    const scopeIds = selected === 'all' ? buildings.map((b) => b.id) : [selected]
    return {
      buildings,
      units,
      loading,
      selected,
      setSelected,
      scopeIds,
      scopedUnits: units.filter((u) => scopeIds.includes(u.building_id)),
      buildingName: (id) => buildings.find((b) => b.id === id)?.name ?? '—',
      refresh,
    }
  }, [buildings, units, loading, selected, setSelected, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useBuildings() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useBuildings fuera de BuildingProvider')
  return c
}
