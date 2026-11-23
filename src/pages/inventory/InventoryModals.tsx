import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Alert, Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { INVENTORY_CATEGORIES, URGENCY, toOptions } from '@/lib/labels'
import { emptyToNull, errorMessage, number, toNum } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { useBuildingOptions } from '@/hooks/useOptions'
import type { InvItem } from '@/types/models'
import type { Enums } from '@/types/database'

export function ItemFormModal({ open, item, onClose, onSaved }: { open: boolean; item: InvItem | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const { selected, buildings } = useBuildings()
  const buildingOptions = useBuildingOptions()
  const [f, setF] = useState({ building_id: '', name: '', category: 'limpieza', unit_of_measure: 'pieza', current_stock: '0', min_stock: '0', unit_cost: '', notes: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  const key = open ? (item?.id ?? 'new') : null
  if (key !== last) {
    setLast(key)
    if (key) {
      setF({
        building_id: item?.building_id ?? (selected !== 'all' ? selected : buildings[0]?.id ?? ''),
        name: item?.name ?? '', category: item?.category ?? 'limpieza', unit_of_measure: item?.unit_of_measure ?? 'pieza',
        current_stock: String(item?.current_stock ?? 0), min_stock: String(item?.min_stock ?? 0), unit_cost: item?.unit_cost?.toString() ?? '', notes: item?.notes ?? '',
      })
      setError(null)
    }
  }
  async function save() {
    if (!f.building_id) return setError('Elige un edificio.')
    if (!f.name.trim()) return setError('El nombre es obligatorio.')
    setSaving(true)
    const base = { name: f.name.trim(), category: f.category, unit_of_measure: f.unit_of_measure.trim() || 'pieza', min_stock: toNum(f.min_stock), unit_cost: f.unit_cost === '' ? null : toNum(f.unit_cost), notes: emptyToNull(f.notes) }
    // Las existencias de un artículo existente cambian solo con movimientos
    const res = item
      ? await supabase.from('inventory_items').update(base).eq('id', item.id)
      : await supabase.from('inventory_items').insert({ ...base, building_id: f.building_id, current_stock: toNum(f.current_stock) })
    setSaving(false)
    if (res.error) return setError(res.error.code === '23505' ? 'Ya existe un artículo con ese nombre en este edificio.' : errorMessage(res.error))
    toast.success('Artículo guardado')
    onSaved()
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={item ? 'Editar artículo' : 'Nuevo artículo'} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Guardar</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {!item && buildingOptions.length > 1 && <Select label="Edificio" options={buildingOptions} value={f.building_id} onChange={(e) => setF({ ...f, building_id: e.target.value })} />}
        <Input label="Nombre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Categoría" options={INVENTORY_CATEGORIES} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <Input label="Unidad de medida" placeholder="pieza, litro, kg…" value={f.unit_of_measure} onChange={(e) => setF({ ...f, unit_of_measure: e.target.value })} />
          {!item && <Input label="Existencia inicial" type="number" min={0} step="0.01" value={f.current_stock} onChange={(e) => setF({ ...f, current_stock: e.target.value })} />}
          <Input label="Stock mínimo" type="number" min={0} step="0.01" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value })} />
          <Input label="Costo unitario" type="number" min={0} step="0.01" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} />
        </div>
        {item && <p className="text-xs text-slate-500">La existencia cambia con "Consumo" y "Entrada" para conservar el historial.</p>}
        <Textarea label="Notas" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
    </Modal>
  )
}

export function MovementModal({ target, onClose, onSaved }: { target: { item: InvItem; mode: 'consumo' | 'entrada' } | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const [qty, setQty] = useState('1')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  const key = target ? target.item.id + target.mode : null
  if (key !== last) {
    setLast(key)
    setQty('1')
    setReason('')
    setError(null)
  }
  const consumo = target?.mode === 'consumo'
  async function save() {
    if (!target || !user) return
    const n = toNum(qty)
    if (!(n > 0)) return setError('La cantidad debe ser mayor a 0.')
    if (consumo && n > Number(target.item.current_stock) && !confirm(`Solo hay ${number(target.item.current_stock)} en existencia. ¿Registrar de todas formas?`)) return
    setSaving(true)
    const { error: e } = await supabase.from('inventory_movements').insert({ item_id: target.item.id, building_id: target.item.building_id, quantity: consumo ? -n : n, reason: emptyToNull(reason), created_by: user.id })
    setSaving(false)
    if (e) return setError(errorMessage(e))
    toast.success(consumo ? 'Consumo registrado' : 'Entrada registrada')
    onSaved()
    onClose()
  }
  return (
    <Modal open={!!target} onClose={onClose} size="sm" title={`${consumo ? 'Registrar consumo' : 'Registrar entrada'} · ${target?.item.name ?? ''}`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Registrar</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-600">Existencia actual: <strong>{number(target?.item.current_stock)} {target?.item.unit_of_measure}</strong></p>
        <Input label={`Cantidad (${target?.item.unit_of_measure ?? ''})`} type="number" inputMode="decimal" min={0} step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        <Input label={consumo ? 'Motivo / depto (opcional)' : 'Motivo (opcional)'} placeholder={consumo ? 'Limpieza depto 3B' : 'Compra, reposición…'} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  )
}

export function SupplyRequestModal({ open, items, onClose, onSaved }: { open: boolean; items: InvItem[]; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const { selected, buildings } = useBuildings()
  const buildingOptions = useBuildingOptions()
  const toast = useToast()
  const [f, setF] = useState({ building_id: '', item_id: '', item_name: '', quantity: '1', unit: '', urgency: 'normal' as Enums<'urgency_level'>, notes: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setF({ building_id: selected !== 'all' ? selected : buildings[0]?.id ?? '', item_id: '', item_name: '', quantity: '1', unit: '', urgency: 'normal', notes: '' })
    setError(null)
  }
  if (!open && wasOpen) setWasOpen(false)

  const catalog = items.filter((i) => i.building_id === f.building_id)

  function pickItem(id: string) {
    const it = catalog.find((i) => i.id === id)
    setF({ ...f, item_id: id, item_name: it ? it.name : f.item_name, unit: it ? it.unit_of_measure : f.unit })
  }

  async function save() {
    if (!user) return
    if (!f.building_id) return setError('Elige un edificio.')
    if (!f.item_name.trim()) return setError('Elige un artículo o escribe qué necesitas.')
    if (!(toNum(f.quantity) > 0)) return setError('La cantidad debe ser mayor a 0.')
    setSaving(true)
    const { error: e } = await supabase.from('supply_requests').insert({
      building_id: f.building_id, item_id: f.item_id || null, item_name: f.item_name.trim(), quantity: toNum(f.quantity),
      unit_of_measure: emptyToNull(f.unit), urgency: f.urgency, notes: emptyToNull(f.notes), requested_by: user.id, status: 'pendiente',
    })
    setSaving(false)
    if (e) return setError(errorMessage(e))
    toast.success('Solicitud enviada a los administradores')
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Pedir insumo" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Enviar solicitud</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {buildingOptions.length > 1 && <Select label="Edificio" options={buildingOptions} value={f.building_id} onChange={(e) => setF({ ...f, building_id: e.target.value, item_id: '' })} />}
        <Select label="Artículo del catálogo" placeholder="— Otro (escribir abajo) —" options={catalog.map((i) => ({ value: i.id, label: `${i.name} (hay ${number(i.current_stock)} ${i.unit_of_measure})` }))} value={f.item_id} onChange={(e) => pickItem(e.target.value)} />
        <Input label="¿Qué necesitas?" value={f.item_name} onChange={(e) => setF({ ...f, item_name: e.target.value, item_id: f.item_id && catalog.find((i) => i.id === f.item_id)?.name === e.target.value ? f.item_id : '' })} placeholder="Ej. Cloro, focos, toallas…" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Cantidad" type="number" inputMode="decimal" min={0} step="0.01" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
          <Input label="Unidad" placeholder="pieza, litro…" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
        </div>
        <Select label="Urgencia" options={toOptions(URGENCY)} value={f.urgency} onChange={(e) => setF({ ...f, urgency: e.target.value as Enums<'urgency_level'> })} />
        <Textarea label="Notas" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
    </Modal>
  )
}
