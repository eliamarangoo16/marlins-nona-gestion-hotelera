import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Input, Modal, Select, Textarea, Alert } from '@/components/ui'
import { CHANNELS, RESERVATION_STATUS, toOptions } from '@/lib/labels'
import { emptyToNull, errorMessage, toNum } from '@/lib/format'
import { addDays, fmtDate, nightsBetween, ymd, today, parse } from '@/lib/dates'
import { useBuildings } from '@/context/BuildingContext'
import { useUnitOptions } from '@/hooks/useOptions'
import { useToast } from '@/context/ToastContext'
import type { Guest, Rate, Reservation } from '@/types/models'
import type { Enums } from '@/types/database'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: (id: string) => void
  reservation?: Reservation | null
  initial?: { unit_id?: string; check_in?: string }
}

type FormState = {
  unit_id: string
  guestMode: 'existing' | 'new' | 'none'
  guest_id: string
  guest_filter: string
  new_name: string
  new_phone: string
  new_email: string
  check_in: string
  check_out: string
  channel: Enums<'booking_channel'>
  external_ref: string
  guests_count: string
  nightly_rate: string
  cleaning_fee: string
  platform_fee: string
  taxes: string
  total_amount: string
  amount_paid: string
  notes: string
  status: Enums<'reservation_status'>
  schedule_cleaning: boolean
}

function suggestNightly(rates: Rate[], base: number, ci: string, co: string): number {
  const n = nightsBetween(ci, co)
  if (n <= 0) return base
  let sum = 0
  for (let i = 0; i < n; i++) {
    const day = ymd(addDays(parse(ci), i))
    const r = rates.find((x) => x.start_date <= day && x.end_date >= day)
    sum += r ? Number(r.nightly_rate) : base
  }
  return Math.round((sum / n) * 100) / 100
}

export function ReservationFormModal({ open, onClose, onSaved, reservation, initial }: Props) {
  const toast = useToast()
  const { units } = useBuildings()
  const unitOptions = useUnitOptions({ onlyActive: true })
  const [guests, setGuests] = useState<Guest[]>([])
  const [rates, setRates] = useState<Rate[]>([])
  const [totalTouched, setTotalTouched] = useState(false)
  const [rateTouched, setRateTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState<FormState>(blank())

  function blank(): FormState {
    return {
      unit_id: '', guestMode: 'existing', guest_id: '', guest_filter: '', new_name: '', new_phone: '', new_email: '',
      check_in: today(), check_out: ymd(addDays(new Date(), 1)), channel: 'airbnb', external_ref: '', guests_count: '1',
      nightly_rate: '', cleaning_fee: '0', platform_fee: '0', taxes: '0', total_amount: '0', amount_paid: '0', notes: '',
      status: 'confirmada', schedule_cleaning: true,
    }
  }

  // Inicialización al abrir
  useEffect(() => {
    if (!open) return
    setError(null)
    if (reservation) {
      setF({
        unit_id: reservation.unit_id,
        guestMode: reservation.guest_id ? 'existing' : 'none',
        guest_id: reservation.guest_id ?? '',
        guest_filter: '', new_name: '', new_phone: '', new_email: '',
        check_in: reservation.check_in, check_out: reservation.check_out, channel: reservation.channel,
        external_ref: reservation.external_ref ?? '', guests_count: String(reservation.guests_count),
        nightly_rate: reservation.nightly_rate?.toString() ?? '', cleaning_fee: String(reservation.cleaning_fee),
        platform_fee: String(reservation.platform_fee), taxes: String(reservation.taxes),
        total_amount: String(reservation.total_amount), amount_paid: String(reservation.amount_paid),
        notes: reservation.notes ?? '', status: reservation.status, schedule_cleaning: false,
      })
      setTotalTouched(true)
      setRateTouched(true)
    } else {
      const ci = initial?.check_in ?? today()
      const unit = units.find((u) => u.id === initial?.unit_id)
      setF({
        ...blank(),
        unit_id: initial?.unit_id ?? '',
        check_in: ci,
        check_out: ymd(addDays(parse(ci), 1)),
        cleaning_fee: String(unit?.cleaning_fee ?? 0),
      })
      setTotalTouched(false)
      setRateTouched(false)
    }
    void supabase.from('guests').select('*').order('full_name').limit(2000).then(({ data }) => setGuests(data ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation, initial])

  const unit = units.find((u) => u.id === f.unit_id)

  // Tarifas vigentes del departamento
  useEffect(() => {
    if (!open || !f.unit_id) return setRates([])
    void supabase.from('rates').select('*').eq('unit_id', f.unit_id).then(({ data }) => setRates(data ?? []))
  }, [open, f.unit_id])

  const nights = nightsBetween(f.check_in, f.check_out)

  // Sugerencia de tarifa por noche
  useEffect(() => {
    if (!open || !unit || rateTouched || nights <= 0) return
    setF((s) => ({ ...s, nightly_rate: String(suggestNightly(rates, Number(unit.base_rate), s.check_in, s.check_out)) }))
  }, [open, unit, rates, f.check_in, f.check_out, rateTouched, nights])

  // Cuota de limpieza por defecto al elegir depto (solo en alta)
  useEffect(() => {
    if (!open || reservation || !unit) return
    setF((s) => ({ ...s, cleaning_fee: String(unit.cleaning_fee) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.unit_id])

  // Total calculado
  const computedTotal = useMemo(() => Math.max(0, nights) * toNum(f.nightly_rate) + toNum(f.cleaning_fee), [nights, f.nightly_rate, f.cleaning_fee])
  useEffect(() => {
    if (!totalTouched) setF((s) => ({ ...s, total_amount: String(Math.round(computedTotal * 100) / 100) }))
  }, [computedTotal, totalTouched])

  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))

  const filteredGuests = useMemo(() => {
    const q = f.guest_filter.trim().toLowerCase()
    const list = q ? guests.filter((g) => g.full_name.toLowerCase().includes(q) || (g.phone ?? '').includes(q) || (g.email ?? '').toLowerCase().includes(q)) : guests
    // conservar el seleccionado visible
    const sel = guests.find((g) => g.id === f.guest_id)
    return sel && !list.includes(sel) ? [sel, ...list] : list
  }, [guests, f.guest_filter, f.guest_id])

  async function submit() {
    setError(null)
    if (!unit) return setError('Elige un departamento.')
    if (nights <= 0) return setError('La fecha de salida debe ser posterior a la de entrada.')
    if (f.guestMode === 'new' && !f.new_name.trim()) return setError('Escribe el nombre del huésped.')
    const maxG = unit.max_guests
    if (toNum(f.guests_count, 1) > maxG && !confirm(`Este departamento admite ${maxG} huéspedes. ¿Continuar con ${f.guests_count}?`)) return

    setSaving(true)
    let createdGuestId: string | null = null
    try {
      // Bloqueos de calendario (no hay constraint en BD)
      if (f.status !== 'cancelada') {
        const { data: blocks } = await supabase
          .from('calendar_blocks')
          .select('start_date, end_date, reason')
          .eq('unit_id', unit.id)
          .lt('start_date', f.check_out)
          .gt('end_date', f.check_in)
        if (blocks && blocks.length) {
          const b = blocks[0]
          setError(`Ese departamento está bloqueado del ${fmtDate(b.start_date)} al ${fmtDate(b.end_date)}${b.reason ? ` (${b.reason})` : ''}.`)
          return
        }
      }

      let guestId: string | null = f.guestMode === 'existing' && f.guest_id ? f.guest_id : null
      if (f.guestMode === 'new') {
        const { data: g, error: gErr } = await supabase
          .from('guests')
          .insert({ full_name: f.new_name.trim(), phone: emptyToNull(f.new_phone), email: emptyToNull(f.new_email) })
          .select('id')
          .single()
        if (gErr) throw gErr
        guestId = g.id
        createdGuestId = g.id
      }

      const payload = {
        unit_id: unit.id,
        building_id: unit.building_id,
        guest_id: guestId,
        check_in: f.check_in,
        check_out: f.check_out,
        status: f.status,
        channel: f.channel,
        external_ref: emptyToNull(f.external_ref),
        guests_count: Math.max(1, Math.round(toNum(f.guests_count, 1))),
        nightly_rate: f.nightly_rate === '' ? null : toNum(f.nightly_rate),
        cleaning_fee: toNum(f.cleaning_fee),
        platform_fee: toNum(f.platform_fee),
        taxes: toNum(f.taxes),
        total_amount: toNum(f.total_amount),
        amount_paid: toNum(f.amount_paid),
        notes: emptyToNull(f.notes),
      }

      let id = reservation?.id ?? ''
      if (reservation) {
        const { error: e } = await supabase.from('reservations').update(payload).eq('id', reservation.id)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase.from('reservations').insert(payload).select('id').single()
        if (e) throw e
        id = data.id
        if (f.schedule_cleaning && f.status !== 'cancelada') {
          const { error: cErr } = await supabase.from('cleaning_tasks').insert({
            unit_id: unit.id,
            building_id: unit.building_id,
            reservation_id: id,
            scheduled_date: f.check_out,
            status: 'pendiente',
          })
          if (cErr) toast.error(`Reserva creada, pero no se pudo programar la limpieza: ${errorMessage(cErr)}`)
        }
      }
      toast.success(reservation ? 'Reserva actualizada' : 'Reserva creada')
      onSaved(id)
      onClose()
    } catch (e) {
      if (createdGuestId) await supabase.from('guests').delete().eq('id', createdGuestId)
      const err = e as { code?: string; message?: string }
      if (err.code === '23P01' || /reservations_no_overlap/.test(err.message ?? '')) {
        setError('Las fechas chocan con otra reserva de este departamento. Revisa el calendario.')
      } else {
        setError(errorMessage(e))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={reservation ? 'Editar reserva' : 'Nueva reserva'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={saving} onClick={() => void submit()}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Select label="Departamento" placeholder="Selecciona…" options={unitOptions} value={f.unit_id} onChange={set('unit_id')} />

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex flex-wrap gap-3 text-sm">
            {([['existing', 'Huésped existente'], ['new', 'Nuevo huésped'], ['none', 'Sin huésped']] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" name="gm" checked={f.guestMode === v} onChange={() => setF((s) => ({ ...s, guestMode: v }))} /> {l}
              </label>
            ))}
          </div>
          {f.guestMode === 'existing' && (
            <div className="space-y-2">
              <Input placeholder="Buscar por nombre, teléfono o correo…" value={f.guest_filter} onChange={set('guest_filter')} />
              <Select placeholder="Selecciona un huésped…" options={filteredGuests.map((g) => ({ value: g.id, label: g.full_name + (g.phone ? ` · ${g.phone}` : '') }))} value={f.guest_id} onChange={set('guest_id')} />
            </div>
          )}
          {f.guestMode === 'new' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Nombre" value={f.new_name} onChange={set('new_name')} />
              <Input label="Teléfono" type="tel" value={f.new_phone} onChange={set('new_phone')} />
              <Input label="Correo" type="email" value={f.new_email} onChange={set('new_email')} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input label="Entrada" type="date" value={f.check_in} onChange={set('check_in')} />
          <Input label="Salida" type="date" value={f.check_out} min={f.check_in} onChange={set('check_out')} />
          <Input label="Noches" value={nights > 0 ? nights : ''} readOnly disabled />
          <Input label="# Huéspedes" type="number" min={1} value={f.guests_count} onChange={set('guests_count')} />
          <Select label="Canal" options={toOptions(CHANNELS)} value={f.channel} onChange={set('channel')} />
          <Input label="Referencia externa" value={f.external_ref} onChange={set('external_ref')} wrapperClassName="col-span-1 sm:col-span-2" />
          <Select label="Estado" options={toOptions(RESERVATION_STATUS)} value={f.status} onChange={set('status')} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Input label="Tarifa por noche" type="number" min={0} step="0.01" value={f.nightly_rate} onChange={(e) => { setRateTouched(true); set('nightly_rate')(e) }} hint="Sugerida según tarifas vigentes" />
          <Input label="Cuota de limpieza" type="number" min={0} step="0.01" value={f.cleaning_fee} onChange={set('cleaning_fee')} />
          <Input label="Comisión plataforma" type="number" min={0} step="0.01" value={f.platform_fee} onChange={set('platform_fee')} />
          <Input label="Impuestos" type="number" min={0} step="0.01" value={f.taxes} onChange={set('taxes')} />
          <Input
            label="Total (editable)"
            type="number"
            min={0}
            step="0.01"
            value={f.total_amount}
            onChange={(e) => { setTotalTouched(true); set('total_amount')(e) }}
            hint={totalTouched ? 'Editado manualmente' : 'Noches × tarifa + limpieza'}
          />
          <Input label="Pagado" type="number" min={0} step="0.01" value={f.amount_paid} onChange={set('amount_paid')} />
        </div>
        {totalTouched && Math.abs(computedTotal - toNum(f.total_amount)) > 0.01 && (
          <button type="button" className="text-xs text-brand-500 underline" onClick={() => setTotalTouched(false)}>
            Recalcular total ({computedTotal.toFixed(2)})
          </button>
        )}

        <Textarea label="Notas" value={f.notes} onChange={set('notes')} />

        {!reservation && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.schedule_cleaning} onChange={(e) => setF((s) => ({ ...s, schedule_cleaning: e.target.checked }))} />
            Programar limpieza el día de salida
          </label>
        )}
      </div>
    </Modal>
  )
}
