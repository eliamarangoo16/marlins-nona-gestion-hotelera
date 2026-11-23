import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Input, Modal, Textarea, Alert } from '@/components/ui'
import { emptyToNull, errorMessage } from '@/lib/format'
import type { Building } from '@/types/models'
import { useToast } from '@/context/ToastContext'

export function BuildingFormModal({ open, building, onClose, onSaved }: { open: boolean; building: Building | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', address: '', city: '', state: '', postal_code: '', notes: '', active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setF({
      name: building?.name ?? '',
      address: building?.address ?? '',
      city: building?.city ?? '',
      state: building?.state ?? '',
      postal_code: building?.postal_code ?? '',
      notes: building?.notes ?? '',
      active: building?.active ?? true,
    })
  }, [open, building])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!f.name.trim()) return setError('El nombre es obligatorio.')
    setSaving(true)
    setError(null)
    const payload = {
      name: f.name.trim(),
      address: emptyToNull(f.address),
      city: emptyToNull(f.city),
      state: emptyToNull(f.state),
      postal_code: emptyToNull(f.postal_code),
      notes: emptyToNull(f.notes),
      active: f.active,
    }
    const res = building ? await supabase.from('buildings').update(payload).eq('id', building.id) : await supabase.from('buildings').insert(payload)
    setSaving(false)
    if (res.error) {
      setError(res.error.code === '23505' ? 'Ya existe un edificio con ese nombre.' : errorMessage(res.error))
      return
    }
    toast.success(building ? 'Edificio actualizado' : 'Edificio creado')
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={building ? 'Editar edificio' : 'Nuevo edificio'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={saving} onClick={(e) => void submit(e as unknown as FormEvent)}>Guardar</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Nombre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <Input label="Dirección" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Ciudad" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <Input label="Estado" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
        </div>
        <Input label="Código postal" value={f.postal_code} onChange={(e) => setF({ ...f, postal_code: e.target.value })} />
        <Textarea label="Notas" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Edificio activo
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
