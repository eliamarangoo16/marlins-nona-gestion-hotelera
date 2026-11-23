import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Input, Modal, Select, Textarea, Alert } from '@/components/ui'
import { emptyToNull, errorMessage, toNum } from '@/lib/format'
import { toOptions, UNIT_STATUS } from '@/lib/labels'
import type { Unit } from '@/types/models'
import type { Enums } from '@/types/database'
import { useToast } from '@/context/ToastContext'

export function UnitFormModal({ open, buildingId, unit, onClose, onSaved }: { open: boolean; buildingId: string; unit: Unit | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({
    name: '', floor: '', bedrooms: '1', bathrooms: '1', max_guests: '2', base_rate: '0', cleaning_fee: '0',
    status: 'disponible' as Enums<'unit_status'>, airbnb_listing_url: '', ical_import_url: '', notes: '', active: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF({
      name: unit?.name ?? '',
      floor: unit?.floor?.toString() ?? '',
      bedrooms: String(unit?.bedrooms ?? 1),
      bathrooms: String(unit?.bathrooms ?? 1),
      max_guests: String(unit?.max_guests ?? 2),
      base_rate: String(unit?.base_rate ?? 0),
      cleaning_fee: String(unit?.cleaning_fee ?? 0),
      status: unit?.status ?? 'disponible',
      airbnb_listing_url: unit?.airbnb_listing_url ?? '',
      ical_import_url: unit?.ical_import_url ?? '',
      notes: unit?.notes ?? '',
      active: unit?.active ?? true,
    })
  }, [open, unit])

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!f.name.trim()) return setError('El nombre es obligatorio.')
    setSaving(true)
    setError(null)
    const payload = {
      building_id: buildingId,
      name: f.name.trim(),
      floor: f.floor === '' ? null : Math.round(toNum(f.floor)),
      bedrooms: Math.round(toNum(f.bedrooms, 1)),
      bathrooms: toNum(f.bathrooms, 1),
      max_guests: Math.round(toNum(f.max_guests, 2)),
      base_rate: toNum(f.base_rate),
      cleaning_fee: toNum(f.cleaning_fee),
      status: f.status,
      airbnb_listing_url: emptyToNull(f.airbnb_listing_url),
      ical_import_url: emptyToNull(f.ical_import_url),
      notes: emptyToNull(f.notes),
      active: f.active,
    }
    const res = unit ? await supabase.from('units').update(payload).eq('id', unit.id) : await supabase.from('units').insert(payload)
    setSaving(false)
    if (res.error) {
      setError(res.error.code === '23505' ? 'Ya existe un departamento con ese nombre en este edificio.' : errorMessage(res.error))
      return
    }
    toast.success(unit ? 'Departamento actualizado' : 'Departamento creado')
    onSaved()
    onClose()
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={unit ? 'Editar departamento' : 'Nuevo departamento'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={saving} onClick={() => void submit()}>Guardar</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" value={f.name} onChange={set('name')} required />
          <Input label="Piso" type="number" value={f.floor} onChange={set('floor')} />
          <Input label="Recámaras" type="number" min={0} value={f.bedrooms} onChange={set('bedrooms')} />
          <Input label="Baños" type="number" min={0} step="0.5" value={f.bathrooms} onChange={set('bathrooms')} />
          <Input label="Huéspedes máx." type="number" min={1} value={f.max_guests} onChange={set('max_guests')} />
          <Select label="Estado" options={toOptions(UNIT_STATUS)} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Enums<'unit_status'> })} />
          <Input label="Tarifa base / noche" type="number" min={0} step="0.01" value={f.base_rate} onChange={set('base_rate')} />
          <Input label="Cuota de limpieza" type="number" min={0} step="0.01" value={f.cleaning_fee} onChange={set('cleaning_fee')} />
        </div>
        <Input label="URL del anuncio en Airbnb" type="url" value={f.airbnb_listing_url} onChange={set('airbnb_listing_url')} />
        <Input label="URL iCal (importar)" type="url" value={f.ical_import_url} onChange={set('ical_import_url')} />
        <Textarea label="Notas" value={f.notes} onChange={set('notes')} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Departamento activo (cuenta para ocupación)
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
