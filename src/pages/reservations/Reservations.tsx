import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBuildings } from '@/context/BuildingContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { useUnitOptions } from '@/hooks/useOptions'
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, PageLoader, Select, Input } from '@/components/ui'
import { CHANNELS, RESERVATION_STATUS, toOptions } from '@/lib/labels'
import { fmtDate, nightsBetween } from '@/lib/dates'
import { money } from '@/lib/format'
import type { ReservationFull } from '@/types/models'
import { ReservationFormModal } from './ReservationForm'

export default function Reservations() {
  const { scopeIds, buildings } = useBuildings()
  const navigate = useNavigate()
  const unitOptions = useUnitOptions()
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [unit, setUnit] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [open, setOpen] = useState(false)

  const { data, loading, error, reload } = useQuery(async () => {
    if (scopeIds.length === 0) return [] as ReservationFull[]
    let q = supabase
      .from('reservations')
      .select('*, units(name, building_id, buildings(name)), guests(full_name, phone, email)')
      .in('building_id', scopeIds)
      .order('check_in', { ascending: false })
      .limit(500)
    if (status) q = q.eq('status', status as never)
    if (channel) q = q.eq('channel', channel as never)
    if (unit) q = q.eq('unit_id', unit)
    if (from) q = q.gte('check_out', from)
    if (to) q = q.lte('check_in', to)
    return unwrap(await q) as unknown as ReservationFull[]
  }, [scopeIds.join(','), status, channel, unit, from, to])

  const rows = useMemo(() => data ?? [], [data])

  return (
    <>
      <PageHeader title="Reservas" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Nueva reserva</Button>} />
      <Card className="mb-4 p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Select placeholder="Todos los deptos" options={unitOptions} value={unit} onChange={(e) => setUnit(e.target.value)} />
          <Select placeholder="Todos los estados" options={toOptions(RESERVATION_STATUS)} value={status} onChange={(e) => setStatus(e.target.value)} />
          <Select placeholder="Todos los canales" options={toOptions(CHANNELS)} value={channel} onChange={(e) => setChannel(e.target.value)} />
          <Input type="date" aria-label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <Card><EmptyState title="Sin reservas" description="No hay reservas con estos filtros." /></Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {rows.map((r) => {
            const st = RESERVATION_STATUS[r.status]
            return (
              <Link key={r.id} to={`/reservas/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-[10rem] flex-1">
                  <div className="font-medium text-brand">{r.guests?.full_name ?? 'Sin huésped'}</div>
                  <div className="text-xs text-slate-500">
                    {buildings.length > 1 && `${r.units?.buildings?.name} · `}{r.units?.name} · {CHANNELS[r.channel]}
                  </div>
                </div>
                <div className="text-sm text-slate-700">
                  {fmtDate(r.check_in)} → {fmtDate(r.check_out)}
                  <span className="ml-1 text-xs text-slate-400">({nightsBetween(r.check_in, r.check_out)} n)</span>
                </div>
                <div className="w-28 text-right text-sm font-medium">{money(r.total_amount)}</div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </Link>
            )
          })}
        </Card>
      )}
      <ReservationFormModal open={open} onClose={() => setOpen(false)} onSaved={(id) => navigate(`/reservas/${id}`)} />
    </>
  )
}
