import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Lock, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { Button, Card, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, ConfirmModal } from '@/components/ui'
import { RESERVATION_STATUS } from '@/lib/labels'
import { toneBar } from '@/components/ui/Badge'
import { addDays, differenceInCalendarDays, fmtDate, fmtDayShort, parse, today, ymd } from '@/lib/dates'
import { errorMessage } from '@/lib/format'
import type { Block, ReservationFull } from '@/types/models'
import { ReservationFormModal } from '../reservations/ReservationForm'

const CELL = 46
const LABEL_W = 120

export default function Calendar() {
  const { scopedUnits, buildings, buildingName } = useBuildings()
  const navigate = useNavigate()
  const toast = useToast()
  const [start, setStart] = useState(() => ymd(addDays(new Date(), -1)))
  const [days, setDays] = useState(14)
  const [cell, setCell] = useState<{ unit_id: string; date: string } | null>(null)
  const [resOpen, setResOpen] = useState(false)
  const [initial, setInitial] = useState<{ unit_id?: string; check_in?: string }>({})
  const [blockOpen, setBlockOpen] = useState(false)
  const [selBlock, setSelBlock] = useState<Block | null>(null)

  const units = useMemo(() => scopedUnits.filter((u) => u.active), [scopedUnits])
  const end = ymd(addDays(parse(start), days))
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(parse(start), i)), [start, days])
  const unitIds = units.map((u) => u.id).join(',')

  const { data, loading, error, reload } = useQuery(async () => {
    if (units.length === 0) return { res: [] as ReservationFull[], blocks: [] as Block[] }
    const ids = units.map((u) => u.id)
    const [r, b] = await Promise.all([
      supabase
        .from('reservations')
        .select('*, units(name, building_id, buildings(name)), guests(full_name, phone, email)')
        .in('unit_id', ids)
        .neq('status', 'cancelada')
        .lt('check_in', end)
        .gt('check_out', start),
      supabase.from('calendar_blocks').select('*').in('unit_id', ids).lt('start_date', end).gt('end_date', start),
    ])
    return { res: unwrap(r) as unknown as ReservationFull[], blocks: unwrap(b) as Block[] }
  }, [unitIds, start, days])

  const isToday = (d: Date) => ymd(d) === today()

  function bar(a: string, b: string) {
    const s = Math.max(0, differenceInCalendarDays(parse(a), parse(start)))
    const e = Math.min(days, differenceInCalendarDays(parse(b), parse(start)))
    const clippedStart = differenceInCalendarDays(parse(a), parse(start)) < 0
    const clippedEnd = differenceInCalendarDays(parse(b), parse(start)) > days
    const left = s * CELL + (clippedStart ? 0 : CELL / 2)
    const right = e * CELL - (clippedEnd ? 0 : CELL / 2)
    return { left, width: Math.max(8, right - left) }
  }

  async function deleteBlock() {
    if (!selBlock) return
    const { error: e } = await supabase.from('calendar_blocks').delete().eq('id', selBlock.id)
    if (e) return toast.error(errorMessage(e))
    toast.success('Bloqueo eliminado')
    setSelBlock(null)
    void reload()
  }

  return (
    <>
      <PageHeader title="Calendario" subtitle="Toca una celda vacía para crear una reserva o un bloqueo" />
      <Card className="mb-3 flex flex-wrap items-center gap-2 p-3">
        <Button variant="secondary" size="sm" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setStart(ymd(addDays(parse(start), -days)))} aria-label="Anterior" />
        <Button variant="secondary" size="sm" onClick={() => setStart(ymd(addDays(new Date(), -1)))}>Hoy</Button>
        <Button variant="secondary" size="sm" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setStart(ymd(addDays(parse(start), days)))} aria-label="Siguiente" />
        <span className="text-sm text-slate-600">{fmtDate(start)} – {fmtDate(ymd(addDays(parse(end), -1)))}</span>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          {[14, 30].map((n) => (
            <button key={n} onClick={() => setDays(n)} className={`px-3 py-1.5 ${days === n ? 'bg-brand text-white' : 'bg-white text-slate-600'}`}>{n} días</button>
          ))}
        </div>
      </Card>

      <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-600">
        {(['pendiente', 'confirmada', 'en_curso', 'finalizada'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${toneBar[RESERVATION_STATUS[s].tone]}`} />{RESERVATION_STATUS[s].label}</span>
        ))}
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-500" />Bloqueo</span>
      </div>

      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {units.length === 0 ? (
        <Card><EmptyState title="Sin departamentos activos" description="Agrega departamentos en la sección Edificios." /></Card>
      ) : loading && !data ? (
        <PageLoader />
      ) : (
        <Card className="overflow-x-auto">
          <div style={{ width: LABEL_W + CELL * days }}>
            <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50">
              <div style={{ width: LABEL_W }} className="sticky left-0 z-20 shrink-0 border-r border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-500">Departamento</div>
              {dayList.map((d) => (
                <div key={d.toISOString()} style={{ width: CELL }} className={`shrink-0 border-r border-slate-100 py-1 text-center text-[11px] capitalize leading-tight ${isToday(d) ? 'bg-sand-100 font-bold text-brand' : [0, 6].includes(d.getDay()) ? 'bg-slate-100 text-slate-500' : 'text-slate-500'}`}>
                  {fmtDayShort(d)}
                </div>
              ))}
            </div>
            {units.map((u) => {
              const rs = (data?.res ?? []).filter((r) => r.unit_id === u.id)
              const bs = (data?.blocks ?? []).filter((b) => b.unit_id === u.id)
              return (
                <div key={u.id} className="relative flex h-11 border-b border-slate-100">
                  <div style={{ width: LABEL_W }} className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-slate-200 bg-white px-2">
                    <span className="truncate text-xs font-semibold text-brand">{u.name}</span>
                    {buildings.length > 1 && <span className="truncate text-[10px] text-slate-400">{buildingName(u.building_id)}</span>}
                  </div>
                  {dayList.map((d) => (
                    <button
                      key={d.toISOString()}
                      style={{ width: CELL }}
                      aria-label={`${u.name} ${fmtDate(ymd(d))}`}
                      onClick={() => setCell({ unit_id: u.id, date: ymd(d) })}
                      className={`h-full shrink-0 border-r border-slate-100 hover:bg-sand-50 ${isToday(d) ? 'bg-sand-50' : [0, 6].includes(d.getDay()) ? 'bg-slate-50/70' : ''}`}
                    />
                  ))}
                  {rs.map((r) => {
                    const { left, width } = bar(r.check_in, r.check_out)
                    const st = RESERVATION_STATUS[r.status]
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/reservas/${r.id}`)}
                        title={`${r.guests?.full_name ?? 'Sin huésped'} · ${fmtDate(r.check_in)} → ${fmtDate(r.check_out)}`}
                        style={{ left: LABEL_W + left, width, top: 6, height: 32 }}
                        className={`absolute z-[5] overflow-hidden whitespace-nowrap rounded-md px-1.5 text-left text-[11px] font-medium text-white shadow ${toneBar[st.tone]}`}
                      >
                        {r.guests?.full_name ?? 'Sin huésped'}
                      </button>
                    )
                  })}
                  {bs.map((b) => {
                    const { left, width } = bar(b.start_date, b.end_date)
                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelBlock(b)}
                        title={b.reason ?? 'Bloqueo'}
                        style={{ left: LABEL_W + left, width, top: 6, height: 32, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 6px, transparent 6px 12px)' }}
                        className="absolute z-[5] flex items-center gap-1 overflow-hidden whitespace-nowrap rounded-md bg-slate-500 px-1.5 text-left text-[11px] font-medium text-white shadow"
                      >
                        <Lock className="h-3 w-3 shrink-0" />{b.reason ?? 'Bloqueo'}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Modal open={!!cell && !blockOpen} onClose={() => setCell(null)} title="¿Qué quieres crear?" size="sm">
        {cell && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">{scopedUnits.find((u) => u.id === cell.unit_id)?.name} · {fmtDate(cell.date)}</p>
            <Button className="w-full" size="lg" icon={<BookOpen className="h-4 w-4" />} onClick={() => { setInitial({ unit_id: cell.unit_id, check_in: cell.date }); setResOpen(true); setCell(null) }}>Nueva reserva</Button>
            <Button className="w-full" size="lg" variant="secondary" icon={<Lock className="h-4 w-4" />} onClick={() => { setBlockOpen(true) }}>Bloquear fechas</Button>
          </div>
        )}
      </Modal>

      <ReservationFormModal open={resOpen} initial={initial} onClose={() => setResOpen(false)} onSaved={() => void reload()} />
      <BlockModal open={blockOpen} cell={cell} onClose={() => { setBlockOpen(false); setCell(null) }} onSaved={() => void reload()} />

      <ConfirmModal
        open={!!selBlock}
        title="Bloqueo"
        message={selBlock ? `Bloqueo del ${fmtDate(selBlock.start_date)} al ${fmtDate(selBlock.end_date)}${selBlock.reason ? ` · ${selBlock.reason}` : ''}. ¿Eliminarlo?` : ''}
        confirmLabel="Eliminar bloqueo"
        danger
        onConfirm={() => void deleteBlock()}
        onClose={() => setSelBlock(null)}
      />
    </>
  )
}

function BlockModal({ open, cell, onClose, onSaved }: { open: boolean; cell: { unit_id: string; date: string } | null; onClose: () => void; onSaved: () => void }) {
  const { units } = useBuildings()
  const toast = useToast()
  const [startD, setStartD] = useState('')
  const [endD, setEndD] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastKey, setLastKey] = useState('')

  const key = open && cell ? `${cell.unit_id}|${cell.date}` : ''
  if (key && key !== lastKey) {
    setLastKey(key)
    setStartD(cell!.date)
    setEndD(ymd(addDays(parse(cell!.date), 1)))
    setReason('')
    setError(null)
  }
  if (!open && lastKey) setLastKey('')

  async function save() {
    if (!cell) return
    const unit = units.find((u) => u.id === cell.unit_id)
    if (!unit) return
    if (endD <= startD) return setError('La fecha final debe ser posterior a la inicial (el día final no se bloquea).')
    setSaving(true)
    setError(null)
    // Aviso si choca con reservas
    const { data: clash } = await supabase.from('reservations').select('id').eq('unit_id', unit.id).neq('status', 'cancelada').lt('check_in', endD).gt('check_out', startD).limit(1)
    if (clash && clash.length) {
      setSaving(false)
      return setError('Hay una reserva en esas fechas. Cancélala o elige otro rango.')
    }
    const { error: e } = await supabase.from('calendar_blocks').insert({ unit_id: unit.id, building_id: unit.building_id, start_date: startD, end_date: endD, reason: reason.trim() || null })
    setSaving(false)
    if (e) return setError(e.code === '23P01' ? 'Ya hay un bloqueo en esas fechas' : errorMessage(e))
    toast.success('Fechas bloqueadas')
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Bloquear fechas" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Bloquear</Button></>}>
      <div className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Desde" type="date" value={startD} onChange={(e) => setStartD(e.target.value)} />
          <Input label="Hasta" type="date" value={endD} min={startD} onChange={(e) => setEndD(e.target.value)} />
        </div>
        <Input label="Motivo" placeholder="Mantenimiento, uso personal…" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  )
}
