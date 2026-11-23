import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Alert, Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { TICKET_PRIORITY, toOptions } from '@/lib/labels'
import { emptyToNull, errorMessage } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { useBuildingOptions } from '@/hooks/useOptions'
import type { Enums } from '@/types/database'

export function TicketFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const { user } = useAuth()
  const { units, buildings, selected } = useBuildings()
  const toast = useToast()
  const buildingOptions = useBuildingOptions()
  const [f, setF] = useState({ building_id: '', unit_id: '', title: '', description: '', priority: 'media' as Enums<'ticket_priority'> })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(false)

  if (open && !wasOpen) {
    setWasOpen(true)
    const b = selected !== 'all' ? selected : buildings[0]?.id ?? ''
    setF({ building_id: b, unit_id: '', title: '', description: '', priority: 'media' })
    setError(null)
  }
  if (!open && wasOpen) setWasOpen(false)

  const unitOpts = units.filter((u) => u.building_id === f.building_id).map((u) => ({ value: u.id, label: u.name }))

  async function save() {
    if (!f.building_id) return setError('Elige un edificio.')
    if (!f.title.trim()) return setError('Escribe un título.')
    if (!user) return
    setSaving(true)
    const { data, error: e } = await supabase
      .from('maintenance_tickets')
      .insert({ building_id: f.building_id, unit_id: f.unit_id || null, title: f.title.trim(), description: emptyToNull(f.description), priority: f.priority, reported_by: user.id })
      .select('id')
      .single()
    setSaving(false)
    if (e) return setError(errorMessage(e))
    toast.success('Ticket creado')
    onSaved(data.id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Reportar falla / nuevo ticket" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Crear ticket</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {buildingOptions.length > 1 && <Select label="Edificio" options={buildingOptions} value={f.building_id} onChange={(e) => setF({ ...f, building_id: e.target.value, unit_id: '' })} />}
        <Select label="Departamento (opcional)" placeholder="Área común / general" options={unitOpts} value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} />
        <Input label="Título" placeholder="Ej. Fuga en baño" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Textarea label="Descripción" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Select label="Prioridad" options={toOptions(TICKET_PRIORITY)} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Enums<'ticket_priority'> })} />
      </div>
    </Modal>
  )
}
