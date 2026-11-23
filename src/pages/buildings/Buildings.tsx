import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, Pencil, ChevronRight } from 'lucide-react'
import { useBuildings } from '@/context/BuildingContext'
import { useAuth } from '@/context/AuthContext'
import { Badge, Button, Card, EmptyState, PageHeader, PageLoader } from '@/components/ui'
import { BuildingFormModal } from './BuildingFormModal'
import type { Building } from '@/types/models'

export default function Buildings() {
  const { buildings, units, loading, refresh } = useBuildings()
  const { can } = useAuth()
  const [editing, setEditing] = useState<Building | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <PageHeader
        title="Edificios"
        subtitle="Edificios y departamentos que administras"
        actions={can('edificios.crear') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setOpen(true) }}>Nuevo edificio</Button>}
      />
      {loading ? (
        <PageLoader />
      ) : buildings.length === 0 ? (
        <Card><EmptyState title="Aún no hay edificios" description="Crea el primer edificio para empezar a agregar departamentos." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buildings.map((b) => {
            const us = units.filter((u) => u.building_id === b.id)
            return (
              <Card key={b.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-sand" />
                    <h3 className="font-semibold text-brand">{b.name}</h3>
                  </div>
                  {!b.active && <Badge tone="gray">Inactivo</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-500">{[b.address, b.city, b.state].filter(Boolean).join(', ') || 'Sin dirección'}</p>
                <p className="mt-2 text-sm text-slate-700">{us.length} departamento{us.length === 1 ? '' : 's'} · {us.filter((u) => u.active).length} activos</p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <button className="flex items-center gap-1 text-sm text-slate-600 hover:text-brand" onClick={() => { setEditing(b); setOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <Link to={`/edificios/${b.id}`} className="flex items-center gap-0.5 text-sm font-medium text-brand-500 hover:underline">
                    Ver detalle <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <BuildingFormModal open={open} building={editing} onClose={() => setOpen(false)} onSaved={() => void refresh()} />
    </>
  )
}
