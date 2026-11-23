import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Play, ShoppingCart, AlertOctagon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBox, PageHeader, PageLoader } from '@/components/ui'
import { TASK_STATUS, TICKET_PRIORITY, TICKET_STATUS } from '@/lib/labels'
import { addDays, fmtDate, today, ymd } from '@/lib/dates'
import { errorMessage } from '@/lib/format'
import type { CleaningFull, InvItem, TicketFull } from '@/types/models'
import type { Enums } from '@/types/database'
import { TICKET_SELECT } from '../maintenance/Maintenance'
import { CLEAN_SELECT } from '../cleaning/Cleaning'
import { TicketFormModal } from '../maintenance/TicketForm'
import { SupplyRequestModal } from '../inventory/InventoryModals'

export default function MyTasks() {
  const { user, role, profile } = useAuth()
  const { scopeIds } = useBuildings()
  const toast = useToast()
  const [ticketOpen, setTicketOpen] = useState(false)
  const [supplyOpen, setSupplyOpen] = useState(false)
  const isClean = role === 'limpieza'
  const key = scopeIds.join(',')

  const tickets = useQuery(async () => {
    if (!user || !scopeIds.length) return [] as TicketFull[]
    return unwrap(await supabase.from('maintenance_tickets').select(TICKET_SELECT).in('building_id', scopeIds).eq('assigned_to', user.id).in('status', ['abierto', 'en_progreso', 'en_espera']).order('created_at', { ascending: false })) as unknown as TicketFull[]
  }, [key, user?.id], role === 'mantenimiento')

  const cleanings = useQuery(async () => {
    if (!user || !scopeIds.length) return [] as CleaningFull[]
    return unwrap(await supabase.from('cleaning_tasks').select(CLEAN_SELECT).in('building_id', scopeIds).eq('assigned_to', user.id).in('status', ['pendiente', 'en_progreso']).gte('scheduled_date', today()).lte('scheduled_date', ymd(addDays(new Date(), 7))).order('scheduled_date')) as unknown as CleaningFull[]
  }, [key, user?.id], isClean)

  const items = useQuery(async () => (scopeIds.length ? (unwrap(await supabase.from('inventory_items').select('*').in('building_id', scopeIds)) as InvItem[]) : []), [key])

  async function setTicket(t: TicketFull, s: Enums<'ticket_status'>) {
    const { error } = await supabase.from('maintenance_tickets').update({ status: s }).eq('id', t.id)
    if (error) return toast.error(errorMessage(error))
    toast.success(`Ticket: ${TICKET_STATUS[s].label}`)
    void tickets.reload()
  }
  async function setClean(t: CleaningFull, s: Enums<'task_status'>) {
    const { error } = await supabase.from('cleaning_tasks').update({ status: s }).eq('id', t.id)
    if (error) return toast.error(errorMessage(error))
    toast.success(s === 'terminada' ? 'Limpieza terminada' : 'Limpieza iniciada')
    void cleanings.reload()
  }

  const firstName = (profile?.full_name ?? '').split(' ')[0]

  return (
    <>
      <PageHeader title={`Hola${firstName ? `, ${firstName}` : ''}`} subtitle="Tus tareas de hoy y próximas" />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Button size="lg" variant="sand" icon={<ShoppingCart className="h-5 w-5" />} onClick={() => setSupplyOpen(true)}>Pedir insumo</Button>
        <Button size="lg" variant="secondary" icon={<AlertOctagon className="h-5 w-5" />} onClick={() => setTicketOpen(true)}>Reportar falla</Button>
      </div>

      {role === 'mantenimiento' && (
        <Card>
          <CardHeader title="Mis tickets" action={<Link to="/mantenimiento" className="text-xs text-brand-500 hover:underline">Ver todos</Link>} />
          {tickets.error && <div className="p-3"><ErrorBox message={tickets.error} onRetry={() => void tickets.reload()} /></div>}
          {tickets.loading && !tickets.data ? <PageLoader /> : (tickets.data ?? []).length === 0 ? <EmptyState title="Sin tickets asignados" description="Cuando te asignen un ticket aparecerá aquí." /> : (
            <div className="divide-y divide-slate-100">
              {(tickets.data ?? []).map((t) => (
                <div key={t.id} className="p-4">
                  <Link to={`/mantenimiento/${t.id}`} className="flex items-start justify-between gap-2">
                    <span><span className="block font-medium text-brand">{t.title}</span><span className="text-xs text-slate-500">{t.buildings?.name} · {t.units?.name ?? 'General'}{t.due_date && ` · vence ${fmtDate(t.due_date)}`}</span></span>
                    <Badge tone={TICKET_PRIORITY[t.priority].tone}>{TICKET_PRIORITY[t.priority].label}</Badge>
                  </Link>
                  <div className="mt-3 flex gap-2">
                    {t.status !== 'en_progreso' && <Button size="lg" className="!w-auto flex-1" icon={<Play className="h-5 w-5" />} onClick={() => void setTicket(t, 'en_progreso')}>Iniciar</Button>}
                    <Button size="lg" variant="sand" className="!w-auto flex-1" icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => void setTicket(t, 'resuelto')}>Resuelto</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {isClean && (
        <Card>
          <CardHeader title="Mis limpiezas" action={<Link to="/limpieza" className="text-xs text-brand-500 hover:underline">Ver todas</Link>} />
          {cleanings.error && <div className="p-3"><ErrorBox message={cleanings.error} onRetry={() => void cleanings.reload()} /></div>}
          {cleanings.loading && !cleanings.data ? <PageLoader /> : (cleanings.data ?? []).length === 0 ? <EmptyState title="Sin limpiezas asignadas" description="No tienes limpiezas pendientes en los próximos 7 días." /> : (
            <div className="divide-y divide-slate-100">
              {(cleanings.data ?? []).map((t) => (
                <div key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span><span className="block text-base font-semibold text-brand">{t.units?.name}</span><span className="text-xs text-slate-500">{t.buildings?.name} · {fmtDate(t.scheduled_date)}{t.scheduled_date === today() && ' (hoy)'}</span></span>
                    <Badge tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge>
                  </div>
                  {t.notes && <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-600">{t.notes}</p>}
                  <div className="mt-3 flex gap-2">
                    {t.status === 'pendiente' && <Button size="lg" className="!w-auto flex-1" icon={<Play className="h-5 w-5" />} onClick={() => void setClean(t, 'en_progreso')}>Iniciar</Button>}
                    <Button size="lg" variant="sand" className="!w-auto flex-1" icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => void setClean(t, 'terminada')}>Terminada</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <TicketFormModal open={ticketOpen} onClose={() => setTicketOpen(false)} onSaved={() => void tickets.reload()} />
      <SupplyRequestModal open={supplyOpen} items={items.data ?? []} onClose={() => setSupplyOpen(false)} onSaved={() => undefined} />
    </>
  )
}
