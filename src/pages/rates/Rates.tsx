import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { useUnitOptions } from '@/hooks/useOptions'
import { Alert, Button, Card, ConfirmModal, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Select, Table, THead, Th, Td, Tr } from '@/components/ui'
import { emptyToNull, errorMessage, money, toNum } from '@/lib/format'
import { fmtDate } from '@/lib/dates'
import type { Rate } from '@/types/models'

export default function Rates() {
  const { units } = useBuildings()
  const toast = useToast()
  const unitOptions = useUnitOptions()
  const [unitId, setUnitId] = useState('')
  const [edit, setEdit] = useState<Rate | null>(null)
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState<Rate | null>(null)

  useEffect(() => {
    if (!unitId && unitOptions.length) setUnitId(unitOptions[0].value)
    if (unitId && !unitOptions.some((o) => o.value === unitId)) setUnitId(unitOptions[0]?.value ?? '')
  }, [unitOptions, unitId])

  const unit = units.find((u) => u.id === unitId)
  const { data, loading, error, reload } = useQuery(async () => unwrap(await supabase.from('rates').select('*').eq('unit_id', unitId).order('start_date')) as Rate[], [unitId], !!unitId)

  async function remove() {
    if (!del) return
    const { error: e } = await supabase.from('rates').delete().eq('id', del.id)
    if (e) return toast.error(errorMessage(e))
    toast.success('Tarifa eliminada')
    setDel(null)
    void reload()
  }

  return (
    <>
      <PageHeader title="Tarifas" subtitle="Temporadas con tarifa por noche; fuera de ellas aplica la tarifa base" actions={<Button disabled={!unitId} icon={<Plus className="h-4 w-4" />} onClick={() => { setEdit(null); setOpen(true) }}>Nueva temporada</Button>} />
      <Card className="mb-4 p-3">
        <Select label="Departamento" options={unitOptions} value={unitId} onChange={(e) => setUnitId(e.target.value)} />
        {unit && <p className="mt-2 text-sm text-slate-600">Tarifa base: <strong>{money(unit.base_rate)}</strong> por noche · Limpieza: {money(unit.cleaning_fee)}</p>}
      </Card>
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {!unitId ? <Card><EmptyState title="Sin departamentos" /></Card> : loading && !data ? <PageLoader /> : (data ?? []).length === 0 ? (
        <Card><EmptyState title="Sin temporadas" description="Agrega temporadas (alta, fines de semana largos, etc.) para sugerir tarifas al reservar." /></Card>
      ) : (
        <Card>
          <Table>
            <THead><Th>Temporada</Th><Th>Inicio</Th><Th>Fin</Th><Th>Tarifa/noche</Th><Th>Mín. noches</Th><Th /></THead>
            <tbody>
              {(data ?? []).map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium text-brand">{r.name ?? '—'}</Td>
                  <Td>{fmtDate(r.start_date)}</Td>
                  <Td>{fmtDate(r.end_date)}</Td>
                  <Td>{money(r.nightly_rate)}</Td>
                  <Td>{r.min_nights}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Editar" onClick={() => { setEdit(r); setOpen(true) }}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Eliminar" onClick={() => setDel(r)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <RateForm open={open} unitId={unitId} buildingId={unit?.building_id ?? ''} rate={edit} onClose={() => setOpen(false)} onSaved={() => void reload()} />
      <ConfirmModal open={!!del} title="Eliminar tarifa" message="¿Eliminar esta temporada?" confirmLabel="Eliminar" danger onConfirm={() => void remove()} onClose={() => setDel(null)} />
    </>
  )
}

function RateForm({ open, unitId, buildingId, rate, onClose, onSaved }: { open: boolean; unitId: string; buildingId: string; rate: Rate | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', start_date: '', end_date: '', nightly_rate: '', min_nights: '1' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = open ? (rate?.id ?? 'new') : null
  if (key !== lastKey) {
    setLastKey(key)
    if (key) {
      setF({ name: rate?.name ?? '', start_date: rate?.start_date ?? '', end_date: rate?.end_date ?? '', nightly_rate: rate ? String(rate.nightly_rate) : '', min_nights: String(rate?.min_nights ?? 1) })
      setError(null)
    }
  }
  async function save() {
    if (!f.start_date || !f.end_date) return setError('Indica fecha de inicio y fin.')
    if (f.end_date < f.start_date) return setError('La fecha final no puede ser anterior a la inicial.')
    if (!(toNum(f.nightly_rate) > 0)) return setError('Indica una tarifa mayor a 0.')
    setSaving(true)
    const payload = { unit_id: unitId, building_id: buildingId, name: emptyToNull(f.name), start_date: f.start_date, end_date: f.end_date, nightly_rate: toNum(f.nightly_rate), min_nights: Math.max(1, Math.round(toNum(f.min_nights, 1))) }
    const res = rate ? await supabase.from('rates').update(payload).eq('id', rate.id) : await supabase.from('rates').insert(payload)
    setSaving(false)
    if (res.error) return setError(errorMessage(res.error))
    toast.success('Tarifa guardada')
    onSaved()
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={rate ? 'Editar temporada' : 'Nueva temporada'} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Guardar</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Nombre" placeholder="Temporada alta, Semana Santa…" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Inicio" type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
          <Input label="Fin (incluido)" type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
          <Input label="Tarifa por noche" type="number" min={0} step="0.01" value={f.nightly_rate} onChange={(e) => setF({ ...f, nightly_rate: e.target.value })} />
          <Input label="Noches mínimas" type="number" min={1} value={f.min_nights} onChange={(e) => setF({ ...f, min_nights: e.target.value })} />
        </div>
      </div>
    </Modal>
  )
}
