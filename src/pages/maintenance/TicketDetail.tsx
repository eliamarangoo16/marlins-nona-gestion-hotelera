import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useQuery } from '@/hooks/useQuery'
import { useStaff } from '@/hooks/useStaff'
import { Badge, Button, Card, CardHeader, ConfirmModal, EmptyState, ErrorBox, Input, PageHeader, PageLoader, Select, Textarea } from '@/components/ui'
import { TICKET_PRIORITY, TICKET_STATUS, toOptions } from '@/lib/labels'
import { fmtDate, fmtDateTime } from '@/lib/dates'
import { emptyToNull, errorMessage, money, toNum } from '@/lib/format'
import type { TicketFull } from '@/types/models'
import type { Enums } from '@/types/database'
import { TICKET_SELECT } from './Maintenance'

export default function TicketDetail() {
  const { id = '' } = useParams()
  const { can, user, role } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const canAssign = can('mantenimiento.asignar')
  const staff = useStaff('mantenimiento', canAssign)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [f, setF] = useState({ description: '', cost: '0', due_date: '', priority: 'media' as Enums<'ticket_priority'>, assigned_to: '' })

  const { data: t, loading, error, reload } = useQuery(async () => {
    const res = await supabase.from('maintenance_tickets').select(TICKET_SELECT).eq('id', id).maybeSingle()
    if (res.error) throw res.error
    return res.data as unknown as TicketFull | null
  }, [id])

  useEffect(() => {
    if (t) setF({ description: t.description ?? '', cost: String(t.cost), due_date: t.due_date ?? '', priority: t.priority, assigned_to: t.assigned_to ?? '' })
  }, [t])

  if (loading && !t) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={() => void reload()} />
  if (!t) return <Card><EmptyState title="Ticket no encontrado" action={<Link to="/mantenimiento" className="text-brand-500 underline">Volver</Link>} /></Card>

  const canEdit = canAssign || role === 'mantenimiento' || t.assigned_to === user?.id

  async function patch(p: Partial<Pick<TicketFull, 'status' | 'description' | 'cost' | 'due_date' | 'priority' | 'assigned_to'>>, msg = 'Ticket actualizado') {
    setSaving(true)
    const { error: e } = await supabase.from('maintenance_tickets').update(p).eq('id', id)
    setSaving(false)
    if (e) return toast.error(errorMessage(e))
    toast.success(msg)
    void reload()
  }

  async function remove() {
    const { error: e } = await supabase.from('maintenance_tickets').delete().eq('id', id)
    if (e) return toast.error(errorMessage(e))
    toast.success('Ticket eliminado')
    navigate('/mantenimiento', { replace: true })
  }

  const staffOptions = staff.filter((s) => s.building_ids.includes(t.building_id) || s.id === t.assigned_to).map((s) => ({ value: s.id, label: s.full_name ?? s.email }))

  return (
    <>
      <Link to="/mantenimiento" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand"><ArrowLeft className="h-4 w-4" /> Mantenimiento</Link>
      <PageHeader
        title={t.title}
        subtitle={`${t.buildings?.name} · ${t.units?.name ?? 'General'} · Reportó ${t.reporter?.full_name ?? '—'} el ${fmtDateTime(t.created_at)}`}
        actions={<><Badge tone={TICKET_PRIORITY[t.priority].tone}>{TICKET_PRIORITY[t.priority].label}</Badge><Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge></>}
      />

      {canEdit && (
        <Card className="mb-4 p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Cambiar estado</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(TICKET_STATUS) as Enums<'ticket_status'>[]).map((s) => (
              <Button key={s} size="lg" variant={t.status === s ? 'sand' : 'secondary'} className="!h-12 !text-sm" disabled={saving || t.status === s} onClick={() => void patch({ status: s }, `Estado: ${TICKET_STATUS[s].label}`)}>
                {TICKET_STATUS[s].label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Detalles" />
        <div className="space-y-3 p-4">
          <Textarea label="Descripción" value={f.description} disabled={!canEdit} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Select label="Prioridad" options={toOptions(TICKET_PRIORITY)} value={f.priority} disabled={!canEdit} onChange={(e) => setF({ ...f, priority: e.target.value as Enums<'ticket_priority'> })} />
            <Input label="Costo (MXN)" type="number" min={0} step="0.01" value={f.cost} disabled={!canEdit} onChange={(e) => setF({ ...f, cost: e.target.value })} />
            <Input label="Fecha compromiso" type="date" value={f.due_date} disabled={!canEdit} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
            {canAssign ? (
              <Select label="Asignado a" placeholder="Sin asignar" options={staffOptions} value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })} />
            ) : (
              <Input label="Asignado a" value={t.assignee?.full_name ?? 'Sin asignar'} disabled readOnly />
            )}
          </div>
          <p className="text-xs text-slate-500">Costo actual: {money(t.cost)}{t.due_date && ` · Compromiso: ${fmtDate(t.due_date)}`}{t.resolved_at && ` · Resuelto: ${fmtDateTime(t.resolved_at)}`}</p>
          {canEdit && (
            <div className="flex flex-wrap justify-between gap-2">
              <Button loading={saving} onClick={() => void patch({ description: emptyToNull(f.description), cost: toNum(f.cost), due_date: f.due_date || null, priority: f.priority, ...(canAssign ? { assigned_to: f.assigned_to || null } : {}) })}>Guardar cambios</Button>
              {canAssign && <Button variant="secondary" icon={<Trash2 className="h-4 w-4 text-red-600" />} onClick={() => setConfirmDel(true)}>Eliminar</Button>}
            </div>
          )}
        </div>
      </Card>
      <ConfirmModal open={confirmDel} title="Eliminar ticket" message="¿Eliminar este ticket definitivamente?" confirmLabel="Eliminar" danger onConfirm={() => void remove()} onClose={() => setConfirmDel(false)} />
    </>
  )
}
