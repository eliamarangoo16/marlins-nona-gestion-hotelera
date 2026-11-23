import { useMemo } from 'react'
import { useBuildings } from '@/context/BuildingContext'
import type { Option } from '@/components/ui'

/** Opciones de departamento dentro del alcance del selector de edificio. */
export function useUnitOptions(opts: { onlyActive?: boolean; allBuildings?: boolean } = {}): Option[] {
  const { units, scopedUnits, buildings } = useBuildings()
  return useMemo(() => {
    const base = opts.allBuildings ? units : scopedUnits
    return base
      .filter((u) => (opts.onlyActive ? u.active : true))
      .map((u) => ({
        value: u.id,
        label: buildings.length > 1 ? `${buildings.find((b) => b.id === u.building_id)?.name ?? ''} · ${u.name}` : u.name,
      }))
  }, [units, scopedUnits, buildings, opts.onlyActive, opts.allBuildings])
}

export function useBuildingOptions(): Option[] {
  const { buildings } = useBuildings()
  return useMemo(() => buildings.filter((b) => b.active).map((b) => ({ value: b.id, label: b.name })), [buildings])
}
