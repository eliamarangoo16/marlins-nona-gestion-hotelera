import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { Badge, Button, Card, CardHeader, ConfirmModal, EmptyState, ErrorBox, PageHeader, PageLoader } from '@/components/ui'
import { CHANNELS, RESERVATION_STATUS, TASK_STATUS } from '@/lib/labels'
import { fmtDate, fmtDateTime, nightsBetween } from '@/lib/dates'
import { errorMessage, money } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import type { CleaningFull, ReservationFull } from '@/types/models'
import type { Enums } from '@/types/database'
import { ReservationFormModal } from './ReservationForm'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}

export default function ReservationDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)

  const { data: r, loading, error, reload } = useQuery(async () => {
    const res = await supabase
      .from('reservations')
      .select('*, units(name, building_id, buildings(name)), guests(full_name, phone, email)')
      .eq('id', id)
      .maybeSingle()
    if (res.error) throw res.error
    return res.data as unknown as ReservationFull | null
  }, [id])

  const { data: cleanings, reload: reloadClean } = useQuery(async () =>
    unwrap(await supabase.from('cleaning_tasks').select('*, units(name), buildings(name), assignee:profiles!cleaning_tasks_assigned_to_fkey(full_name)').eq('reservation_id', id)) as unknown as CleaningFull[],
  [id])

  async function setStatus(s: Enums<'reservation_status'>) {
    setBusy(true)
    const { error: e } = await supabase.from('reservations').update({ status: s }).eq('id', id)
    setBusy(false)
    if (e) return toast.error(errorMessage(e))
    toast.success(`Reserva ${RESERVATION_STATUS[s].label.toLowerCase()}`)
    void reload()
  }

  async function remove() {
    setBusy(true)
    const { error: e } = await supabase.from('reservations').delete().eq('id', id)
    setBusy(false)
    if (e) return toast.error(errorMessage(e))
    toast.success('Reserva eliminada')
    navigate('/reservas', { replace: true })
  }

  async function addCleaning() {
    if (!r) return
    const { error: e } = await supabase.from('cleaning_tasks').insert({ unit_id: r.unit_id, building_id: r.building_id, reservation_id: r.id, scheduled_date: r.check_out })
    if (e) return toast.error(errorMessage(e))
    toast.success('Limpieza programada')
    void reloadClean()
  }

  if (loading && !r) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={() => void reload()} />
  if (!r) return <Card><EmptyState title="Reserva no encontrada" action={<Link to="/reservas" className="text-brand-500 underline">Volver a reservas</Link>} /></Card>

  const st = RESERVATION_STATUS[r.status]
  const pending = Number(r.total_amount) - Number(r.amount_paid)

  return (
    <>
      <Link to="/reservas" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand"><ArrowLeft className="h-4 w-4" /> Reservas</Link>
      <PageHeader
        title={r.guests?.full_name ?? 'Reserva sin huésped'}
        subtitle={`${r.units?.buildings?.name} · ${r.units?.name}`}
        actions={
          <>
            <Badge tone={st.tone}>{st.label}</Badge>
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}>Editar</Button>
            <Button variant="secondary" icon={<Trash2 className="h-4 w-4 text-red-600" />} onClick={() => setConfirmDel(true)}>Eliminar</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {r.status === 'pendiente' && <Button loading={busy} onClick={() => void setStatus('confirmada')}>Confirmar</Button>}
        {(r.status === 'pendiente' || r.status === 'confirmada') && <Button variant="sand" loading={busy} onClick={() => void setStatus('en_curso')}>Registrar check-in</Button>}
        {r.status === 'en_curso' && <Button variant="sand" loading={busy} onClick={() => void setStatus('finalizada')}>Registrar check-out</Button>}
        {r.status !== 'cancelada' && r.status !== 'finalizada' && <Button variant="secondary" loading={busy} onClick={() => void setStatus('cancelada')}>Cancelar reserva</Button>}
        {r.status === 'cancelada' && <Button variant="secondary" loading={busy} onClick={() => void setStatus('confirmada')}>Reactivar</Button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Estancia" />
          <div className="px-4 py-2">
            <Row label="Entrada" value={fmtDate(r.check_in)} />
            <Row label="Salida" value={fmtDate(r.check_out)} />
            <Row label="Noches" value={nightsBetween(r.check_in, r.check_out)} />
            <Row label="Huéspedes" value={r.guests_count} />
            <Row label="Canal" value={CHANNELS[r.channel]} />
            <Row label="Referencia" value={r.external_ref ?? '—'} />
            <Row label="Contacto" value={r.guests ? [r.guests.phone, r.guests.email].filter(Boolean).join(' · ') || '—' : '—'} />
            {r.notes && <Row label="Notas" value={r.notes} />}
            <Row label="Creada" value={fmtDateTime(r.created_at)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Montos" />
          <div className="px-4 py-2">
            <Row label="Tarifa por noche" value={r.nightly_rate !== null ? money(r.nightly_rate) : '—'} />
            <Row label="Cuota de limpieza" value={money(r.cleaning_fee)} />
            <Row label="Total" value={money(r.total_amount)} />
            <Row label="Comisión plataforma" value={`− ${money(r.platform_fee)}`} />
            <Row label="Impuestos" value={`− ${money(r.taxes)}`} />
            <Row label="Ingreso neto" value={<span className="text-emerald-700">{money(r.net_amount)}</span>} />
            <Row label="Pagado" value={money(r.amount_paid)} />
            <Row label="Saldo pendiente" value={<span className={pending > 0 ? 'text-red-700' : ''}>{money(pending)}</span>} />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Limpieza" action={(cleanings ?? []).length === 0 && r.status !== 'cancelada' ? <Button size="sm" variant="secondary" onClick={() => void addCleaning()}>Programar limpieza</Button> : undefined} />
        {(cleanings ?? []).length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">Sin limpieza programada.</p>
        ) : (
          (cleanings ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm last:border-0">
              <span>{fmtDate(c.scheduled_date)} · {c.assignee?.full_name ?? 'Sin asignar'}</span>
              <Badge tone={TASK_STATUS[c.status].tone}>{TASK_STATUS[c.status].label}</Badge>
            </div>
          ))
        )}
      </Card>

      <ReservationFormModal open={edit} reservation={r} onClose={() => setEdit(false)} onSaved={() => void reload()} />
      <ConfirmModal open={confirmDel} title="Eliminar reserva" message="Se eliminará la reserva definitivamente. Si solo quieres liberar las fechas, mejor cancélala." confirmLabel="Eliminar" danger loading={busy} onConfirm={() => void remove()} onClose={() => setConfirmDel(false)} />
    </>
  )
}
