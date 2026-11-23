import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, format, subMonths } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight, Package, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBuildings } from '@/context/BuildingContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { Badge, Button, Card, CardHeader, ErrorBox, PageHeader, PageLoader, Stat } from '@/components/ui'
import { money, number, percent } from '@/lib/format'
import { fmtMonth, fmtShortMonth, monthRange, overlapNights, today, ymd } from '@/lib/dates'
import { sumProrated } from '@/lib/metrics'
import { TICKET_PRIORITY, URGENCY } from '@/lib/labels'
import type { Block, InvItem, Reservation, ReservationFull, SupplyFull, TicketFull } from '@/types/models'
import { TICKET_SELECT } from '../maintenance/Maintenance'

export default function Dashboard() {
  const { scopeIds, scopedUnits, buildings, buildingName } = useBuildings()
  const [month, setMonth] = useState(() => new Date())
  const range = monthRange(month)
  const activeUnitList = useMemo(() => scopedUnits.filter((u) => u.active), [scopedUnits])
  const activeUnits = activeUnitList.length
  const activeIds = useMemo(() => new Set(activeUnitList.map((u) => u.id)), [activeUnitList])
  const key = scopeIds.join(',')

  // Periodo y últimos 6 meses
  const chartStart = ymd(new Date(month.getFullYear(), month.getMonth() - 5, 1))
  const { data, loading, error, reload } = useQuery(async () => {
    if (!scopeIds.length) return null
    const t = today()
    const [res, exp, ci, co, tickets, supplies, items, blocks] = await Promise.all([
      supabase.from('reservations').select('*').in('building_id', scopeIds).neq('status', 'cancelada').lt('check_in', range.end).gt('check_out', chartStart),
      supabase.from('expenses').select('amount, expense_date').in('building_id', scopeIds).gte('expense_date', chartStart).lt('expense_date', range.end),
      supabase.from('reservations').select('*, units(name, building_id, buildings(name)), guests(full_name, phone, email)').in('building_id', scopeIds).eq('check_in', t).neq('status', 'cancelada'),
      supabase.from('reservations').select('*, units(name, building_id, buildings(name)), guests(full_name, phone, email)').in('building_id', scopeIds).eq('check_out', t).neq('status', 'cancelada'),
      supabase.from('maintenance_tickets').select(TICKET_SELECT).in('building_id', scopeIds).in('priority', ['urgente', 'alta']).in('status', ['abierto', 'en_progreso', 'en_espera']).order('created_at', { ascending: false }).limit(10),
      supabase.from('supply_requests').select('*, buildings(name), requester:profiles!supply_requests_requested_by_fkey(full_name)').in('building_id', scopeIds).eq('status', 'pendiente').order('created_at', { ascending: false }).limit(10),
      supabase.from('inventory_items').select('*').in('building_id', scopeIds),
      supabase.from('calendar_blocks').select('*').in('building_id', scopeIds).lt('start_date', range.end).gt('end_date', range.start),
    ])
    return {
      res: unwrap(res) as Reservation[],
      blocks: unwrap(blocks) as Block[],
      exp: unwrap(exp) as { amount: number; expense_date: string }[],
      ci: unwrap(ci) as unknown as ReservationFull[],
      co: unwrap(co) as unknown as ReservationFull[],
      tickets: unwrap(tickets) as unknown as TicketFull[],
      supplies: unwrap(supplies) as unknown as SupplyFull[],
      low: (unwrap(items) as InvItem[]).filter((i) => Number(i.current_stock) <= Number(i.min_stock)),
    }
  }, [key, range.start])

  const kpi = useMemo(() => {
    const all = sumProrated(data?.res ?? [], range.start, range.end)
    // Ocupación, ADR y RevPAR: solo reservas de las mismas unidades activas del denominador
    const act = sumProrated((data?.res ?? []).filter((r) => activeIds.has(r.unit_id)), range.start, range.end)
    const blocked = (data?.blocks ?? [])
      .filter((b) => activeIds.has(b.unit_id))
      .reduce((s, b) => s + overlapNights(b.start_date, b.end_date, range.start, range.end), 0)
    const available = Math.max(0, activeUnits * range.days - blocked)
    const exp = (data?.exp ?? []).filter((e) => e.expense_date >= range.start && e.expense_date < range.end).reduce((s, e) => s + Number(e.amount), 0)
    return {
      occupancy: available ? Math.min(100, (act.nights / available) * 100) : 0,
      adr: act.nights ? act.lodging / act.nights : 0,
      revpar: available ? act.lodging / available : 0,
      gross: all.gross,
      commission: all.commission,
      net: all.net,
      expenses: exp,
      profit: all.net - exp,
      nights: act.nights,
      available,
    }
  }, [data, range.start, range.end, range.days, activeUnits, activeIds])

  const chart = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(month, 5 - i)
        const r = monthRange(d)
        const p = sumProrated(data?.res ?? [], r.start, r.end)
        const gastos = (data?.exp ?? []).filter((e) => e.expense_date >= r.start && e.expense_date < r.end).reduce((s, e) => s + Number(e.amount), 0)
        return { mes: fmtShortMonth(d), Ingresos: Math.round(p.net), Gastos: Math.round(gastos) }
      }),
    [data, month],
  )

  const multi = buildings.length > 1
  const isCurrent = format(month, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Resumen de ${fmtMonth(month)}`}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" icon={<ChevronLeft className="h-4 w-4" />} aria-label="Mes anterior" onClick={() => setMonth(subMonths(month, 1))} />
            <input type="month" aria-label="Mes" value={format(month, 'yyyy-MM')} onChange={(e) => e.target.value && setMonth(new Date(`${e.target.value}-01T12:00:00`))} className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm" />
            <Button variant="secondary" size="sm" icon={<ChevronRight className="h-4 w-4" />} aria-label="Mes siguiente" onClick={() => setMonth(addMonths(month, 1))} />
            {!isCurrent && <Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>Actual</Button>}
          </div>
        }
      />
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {scopeIds.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-600">Aún no tienes edificios. Crea uno en <Link to="/edificios" className="text-brand-500 underline">Edificios</Link>.</Card>
      ) : loading && !data ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Ocupación" value={percent(kpi.occupancy)} sub={`${number(kpi.nights)} de ${number(kpi.available)} noches disponibles`} />
            <Stat label="ADR" value={money(kpi.adr)} sub="Ingreso por noche vendida" />
            <Stat label="RevPAR" value={money(kpi.revpar)} sub="Ingreso por noche disponible" />
            <Stat label="Ingresos brutos" value={money(kpi.gross)} />
            <Stat label="Comisiones" value={money(kpi.commission)} />
            <Stat label="Ingreso neto" value={money(kpi.net)} />
            <Stat label="Gastos" value={money(kpi.expenses)} />
            <Stat label="Utilidad operativa" value={money(kpi.profit)} tone={kpi.profit < 0 ? 'bad' : 'good'} />
          </div>

          <Card className="mt-4">
            <CardHeader title="Ingresos netos vs gastos · últimos 6 meses" />
            <div className="h-64 p-2 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} width={40} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#0f2a44" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos" fill="#c8a96a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <MoveCard title="Check-ins hoy" icon={<ArrowDownToLine className="h-4 w-4" />} list={data?.ci ?? []} multi={multi} />
            <MoveCard title="Check-outs hoy" icon={<ArrowUpFromLine className="h-4 w-4" />} list={data?.co ?? []} multi={multi} />

            <Card>
              <CardHeader title={<span className="flex items-center gap-1.5"><Wrench className="h-4 w-4" /> Tickets urgentes / altos</span>} action={<Link to="/mantenimiento" className="text-xs text-brand-500 hover:underline">Ver todos</Link>} />
              {(data?.tickets ?? []).length === 0 ? <p className="px-4 py-5 text-sm text-slate-500">Sin tickets urgentes.</p> : (
                <div className="divide-y divide-slate-100">
                  {(data?.tickets ?? []).map((t) => (
                    <Link key={t.id} to={`/mantenimiento/${t.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{t.title}</span><span className="block text-xs text-slate-500">{multi && `${t.buildings?.name} · `}{t.units?.name ?? 'General'}</span></span>
                      <Badge tone={TICKET_PRIORITY[t.priority].tone}>{TICKET_PRIORITY[t.priority].label}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title={<span className="flex items-center gap-1.5"><Package className="h-4 w-4" /> Solicitudes de insumo pendientes</span>} action={<Link to="/inventario" className="text-xs text-brand-500 hover:underline">Ver todas</Link>} />
              {(data?.supplies ?? []).length === 0 ? <p className="px-4 py-5 text-sm text-slate-500">Sin solicitudes pendientes.</p> : (
                <div className="divide-y divide-slate-100">
                  {(data?.supplies ?? []).map((s) => (
                    <Link key={s.id} to="/inventario" className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{s.item_name} × {number(s.quantity)}</span><span className="block text-xs text-slate-500">{s.requester?.full_name ?? '—'}{multi && ` · ${s.buildings?.name}`}</span></span>
                      <Badge tone={URGENCY[s.urgency].tone}>{URGENCY[s.urgency].label}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title={<span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-red-600" /> Artículos con stock bajo</span>} action={<Link to="/inventario" className="text-xs text-brand-500 hover:underline">Inventario</Link>} />
              {(data?.low ?? []).length === 0 ? <p className="px-4 py-5 text-sm text-slate-500">Todo el inventario está sobre el mínimo.</p> : (
                <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
                  {(data?.low ?? []).map((i) => (
                    <div key={i.id} className="bg-white px-4 py-2.5">
                      <div className="text-sm font-medium text-slate-800">{i.name}</div>
                      <div className="text-xs text-slate-500">{multi && `${buildingName(i.building_id)} · `}<span className="font-semibold text-red-700">{number(i.current_stock)}</span> / mín. {number(i.min_stock)} {i.unit_of_measure}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}

function MoveCard({ title, icon, list, multi }: { title: string; icon: React.ReactNode; list: ReservationFull[]; multi: boolean }) {
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-1.5">{icon} {title} <span className="font-normal text-slate-400">({list.length})</span></span>} />
      {list.length === 0 ? <p className="px-4 py-5 text-sm text-slate-500">Nada programado para hoy.</p> : (
        <div className="divide-y divide-slate-100">
          {list.map((r) => (
            <Link key={r.id} to={`/reservas/${r.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{r.guests?.full_name ?? 'Sin huésped'}</span><span className="block text-xs text-slate-500">{multi && `${r.units?.buildings?.name} · `}{r.units?.name}</span></span>
              <span className="text-xs text-slate-500">{r.guests_count} huésp.</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
