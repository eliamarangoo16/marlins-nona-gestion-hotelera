import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, LayoutList, Columns3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBuildings } from '@/context/BuildingContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { useUnitOptions } from '@/hooks/useOptions'
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, PageLoader, Select } from '@/components/ui'
import { TICKET_PRIORITY, TICKET_STATUS, toOptions } from '@/lib/labels'
import { fmtDate } from '@/lib/dates'
import type { TicketFull } from '@/types/models'
import type { Enums } from '@/types/database'
import { TicketFormModal } from './TicketForm'

export const TICKET_SELECT = '*, units(name), buildings(name), assignee:profiles!maintenance_tickets_assigned_to_fkey(full_name), reporter:profiles!maintenance_tickets_reported_by_fkey(full_name)'
const prioOrder: Record<string, number> = { urgente: 0, alta: 1, media: 2, baja: 3 }

function TicketRow({ t, showBuilding }: { t: TicketFull; showBuilding: boolean }) {
  return (
    <Link to={`/mantenimiento/${t.id}`} className="block rounded-lg px-4 py-3 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-brand">{t.title}</div>
          <div className="text-xs text-slate-500">
            {showBuilding && `${t.buildings?.name} · `}{t.units?.name ?? 'General'} · {t.assignee?.full_name ?? 'Sin asignar'}{t.due_date && ` · vence ${fmtDate(t.due_date)}`}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={TICKET_PRIORITY[t.priority].tone}>{TICKET_PRIORITY[t.priority].label}</Badge>
          <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
        </div>
      </div>
    </Link>
  )
}

export default function Maintenance() {
  const { scopeIds, buildings } = useBuildings()
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const unitOptions = useUnitOptions()
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [unit, setUnit] = useState('')
  const [mine, setMine] = useState(role === 'mantenimiento')
  const [view, setView] = useState<'lista' | 'tablero'>('lista')
  const [open, setOpen] = useState(false)

  const { data, loading, error, reload } = useQuery(async () => {
    if (scopeIds.length === 0) return [] as TicketFull[]
    let q = supabase.from('maintenance_tickets').select(TICKET_SELECT).in('building_id', scopeIds).order('created_at', { ascending: false }).limit(500)
    if (status) q = q.eq('status', status as Enums<'ticket_status'>)
    if (priority) q = q.eq('priority', priority as Enums<'ticket_priority'>)
    if (unit) q = q.eq('unit_id', unit)
    if (mine && user) q = q.eq('assigned_to', user.id)
    return unwrap(await q) as unknown as TicketFull[]
  }, [scopeIds.join(','), status, priority, unit, mine, user?.id])

  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority]), [data])
  const showB = buildings.length > 1

  return (
    <>
      <PageHeader
        title="Mantenimiento"
        actions={
          <>
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              <button aria-label="Lista" onClick={() => setView('lista')} className={`p-2 ${view === 'lista' ? 'bg-brand text-white' : 'bg-white text-slate-600'}`}><LayoutList className="h-4 w-4" /></button>
              <button aria-label="Tablero" onClick={() => setView('tablero')} className={`p-2 ${view === 'tablero' ? 'bg-brand text-white' : 'bg-white text-slate-600'}`}><Columns3 className="h-4 w-4" /></button>
            </div>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Nuevo ticket</Button>
          </>
        }
      />
      <Card className="mb-4 p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select placeholder="Todos los estados" options={toOptions(TICKET_STATUS)} value={status} onChange={(e) => setStatus(e.target.value)} />
          <Select placeholder="Toda prioridad" options={toOptions(TICKET_PRIORITY)} value={priority} onChange={(e) => setPriority(e.target.value)} />
          <Select placeholder="Todos los deptos" options={unitOptions} value={unit} onChange={(e) => setUnit(e.target.value)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Solo asignados a mí</label>
        </div>
      </Card>
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data ? <PageLoader /> : rows.length === 0 ? (
        <Card><EmptyState title="Sin tickets" description="No hay tickets con estos filtros." /></Card>
      ) : view === 'lista' ? (
        <Card className="divide-y divide-slate-100 p-1">{rows.map((t) => <TicketRow key={t.id} t={t} showBuilding={showB} />)}</Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(Object.keys(TICKET_STATUS) as Enums<'ticket_status'>[]).map((s) => {
            const col = rows.filter((t) => t.status === s)
            return (
              <div key={s} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1"><Badge tone={TICKET_STATUS[s].tone}>{TICKET_STATUS[s].label}</Badge><span className="text-xs text-slate-500">{col.length}</span></div>
                <div className="space-y-2">
                  {col.map((t) => <Card key={t.id}><TicketRow t={t} showBuilding={showB} /></Card>)}
                  {col.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">Vacío</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <TicketFormModal open={open} onClose={() => setOpen(false)} onSaved={(id) => navigate(`/mantenimiento/${id}`)} />
    </>
  )
}
