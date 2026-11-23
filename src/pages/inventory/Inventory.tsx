import { useMemo, useState } from 'react'
import { Plus, Minus, PackagePlus, Pencil, Trash2, AlertTriangle, ShoppingCart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { Badge, Button, Card, ConfirmModal, EmptyState, ErrorBox, PageHeader, PageLoader, Select, Input } from '@/components/ui'
import { INVENTORY_CATEGORIES, categoryLabel, SUPPLY_STATUS, URGENCY } from '@/lib/labels'
import { fmtDateTime } from '@/lib/dates'
import { errorMessage, money, number } from '@/lib/format'
import type { InvItem, MovementFull, SupplyFull } from '@/types/models'
import type { Enums } from '@/types/database'
import { ItemFormModal, MovementModal, SupplyRequestModal } from './InventoryModals'

type Tab = 'articulos' | 'solicitudes' | 'movimientos'

export default function Inventory() {
  const { scopeIds, buildings } = useBuildings()
  const { can } = useAuth()
  const toast = useToast()
  const admin = can('inventario.administrar')
  const [tab, setTab] = useState<Tab>('articulos')
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [itemForm, setItemForm] = useState<{ open: boolean; item: InvItem | null }>({ open: false, item: null })
  const [move, setMove] = useState<{ item: InvItem; mode: 'consumo' | 'entrada' } | null>(null)
  const [reqOpen, setReqOpen] = useState(false)
  const [delItem, setDelItem] = useState<InvItem | null>(null)
  const [receive, setReceive] = useState<SupplyFull | null>(null)
  const [reqStatus, setReqStatus] = useState('')

  const key = scopeIds.join(',')
  const items = useQuery(async () => (scopeIds.length ? (unwrap(await supabase.from('inventory_items').select('*').in('building_id', scopeIds).order('name')) as InvItem[]) : []), [key])
  const supplies = useQuery(async () => {
    if (!scopeIds.length) return [] as SupplyFull[]
    let qy = supabase.from('supply_requests').select('*, buildings(name), requester:profiles!supply_requests_requested_by_fkey(full_name)').in('building_id', scopeIds).order('created_at', { ascending: false }).limit(300)
    if (reqStatus) qy = qy.eq('status', reqStatus as Enums<'supply_status'>)
    return unwrap(await qy) as unknown as SupplyFull[]
  }, [key, reqStatus])
  const moves = useQuery(async () => (scopeIds.length ? (unwrap(await supabase.from('inventory_movements').select('*, inventory_items(name, unit_of_measure), creator:profiles!inventory_movements_created_by_fkey(full_name)').in('building_id', scopeIds).order('created_at', { ascending: false }).limit(200)) as unknown as MovementFull[]) : []), [key], tab === 'movimientos')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (items.data ?? []).filter((i) => (!cat || i.category === cat) && (!s || i.name.toLowerCase().includes(s)) && (!lowOnly || Number(i.current_stock) <= Number(i.min_stock)))
  }, [items.data, cat, q, lowOnly])
  const lowCount = (items.data ?? []).filter((i) => Number(i.current_stock) <= Number(i.min_stock)).length
  const pendingCount = (supplies.data ?? []).filter((s) => s.status === 'pendiente').length

  const reloadAll = () => { void items.reload(); void supplies.reload(); void moves.reload() }

  async function removeItem() {
    if (!delItem) return
    const { error } = await supabase.from('inventory_items').delete().eq('id', delItem.id)
    if (error) return toast.error(errorMessage(error))
    toast.success('Artículo eliminado')
    setDelItem(null)
    reloadAll()
  }

  async function setSupplyStatus(s: SupplyFull, status: Enums<'supply_status'>) {
    const { error } = await supabase.from('supply_requests').update({ status }).eq('id', s.id)
    if (error) return toast.error(errorMessage(error))
    toast.success(`Solicitud ${SUPPLY_STATUS[status].label.toLowerCase()}`)
    void supplies.reload()
    if (status === 'entregada' && s.item_id) setReceive(s)
  }
  async function cancelRequest(s: SupplyFull) {
    const { error } = await supabase.from('supply_requests').delete().eq('id', s.id)
    if (error) return toast.error(errorMessage(error))
    toast.success('Solicitud cancelada')
    void supplies.reload()
  }
  async function registerReceipt() {
    if (!receive?.item_id) return
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('inventory_movements').insert({ item_id: receive.item_id, building_id: receive.building_id, quantity: Number(receive.quantity), reason: 'Entrega de solicitud de insumo', created_by: u.user?.id })
    if (error) return toast.error(errorMessage(error))
    toast.success('Entrada registrada en inventario')
    setReceive(null)
    reloadAll()
  }

  const tabBtn = (t: Tab, label: string, badge?: number) => (
    <button key={t} onClick={() => setTab(t)} className={`relative flex-1 px-3 py-2.5 text-sm font-medium sm:flex-none ${tab === t ? 'border-b-2 border-sand text-brand' : 'text-slate-500'}`}>
      {label}
      {!!badge && <span className="ml-1.5 rounded-full bg-sand px-1.5 py-0.5 text-[10px] font-bold text-brand-900">{badge}</span>}
    </button>
  )

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle={lowCount ? `${lowCount} artículo${lowCount > 1 ? 's' : ''} con stock bajo` : 'Existencias y solicitudes de insumos'}
        actions={admin && <Button variant="secondary" icon={<PackagePlus className="h-4 w-4" />} onClick={() => setItemForm({ open: true, item: null })}>Nuevo artículo</Button>}
      />
      <Button size="lg" variant="sand" className="mb-4 shadow" icon={<ShoppingCart className="h-5 w-5" />} onClick={() => setReqOpen(true)}>Pedir insumo</Button>

      <div className="mb-4 flex border-b border-slate-200">
        {tabBtn('articulos', 'Artículos')}
        {tabBtn('solicitudes', 'Solicitudes', pendingCount)}
        {tabBtn('movimientos', 'Movimientos')}
      </div>

      {tab === 'articulos' && (
        <>
          <Card className="mb-4 grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
            <Input placeholder="Buscar artículo…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select placeholder="Todas las categorías" options={INVENTORY_CATEGORIES} value={cat} onChange={(e) => setCat(e.target.value)} />
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Solo stock bajo</label>
          </Card>
          {items.error && <ErrorBox message={items.error} onRetry={() => void items.reload()} />}
          {items.loading && !items.data ? <PageLoader /> : filtered.length === 0 ? (
            <Card><EmptyState title="Sin artículos" description={admin ? 'Agrega artículos con "Nuevo artículo".' : 'No hay artículos registrados.'} /></Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              {filtered.map((i) => {
                const low = Number(i.current_stock) <= Number(i.min_stock)
                return (
                  <div key={i.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${low ? 'bg-red-50/60' : ''}`}>
                    <div className="min-w-[10rem] flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-brand">{i.name}{low && <AlertTriangle className="h-4 w-4 text-red-600" aria-label="Stock bajo" />}</div>
                      <div className="text-xs text-slate-500">{buildings.length > 1 && `${buildings.find((b) => b.id === i.building_id)?.name} · `}{categoryLabel(INVENTORY_CATEGORIES, i.category)}{i.unit_cost !== null && ` · ${money(i.unit_cost)}/${i.unit_of_measure}`}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${low ? 'text-red-700' : 'text-brand'}`}>{number(i.current_stock)} <span className="text-xs font-normal text-slate-500">{i.unit_of_measure}</span></div>
                      <div className="text-xs text-slate-500">mínimo {number(i.min_stock)}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" icon={<Minus className="h-3.5 w-3.5" />} onClick={() => setMove({ item: i, mode: 'consumo' })}>Consumo</Button>
                      {can('inventario.entrada') && <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setMove({ item: i, mode: 'entrada' })}>Entrada</Button>}
                      {admin && (
                        <>
                          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Editar" onClick={() => setItemForm({ open: true, item: i })}><Pencil className="h-4 w-4" /></button>
                          <button className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Eliminar" onClick={() => setDelItem(i)}><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </>
      )}

      {tab === 'solicitudes' && (
        <>
          <div className="mb-3 max-w-xs"><Select placeholder="Todos los estados" options={(Object.keys(SUPPLY_STATUS) as Enums<'supply_status'>[]).map((k) => ({ value: k, label: SUPPLY_STATUS[k].label }))} value={reqStatus} onChange={(e) => setReqStatus(e.target.value)} /></div>
          {supplies.error && <ErrorBox message={supplies.error} onRetry={() => void supplies.reload()} />}
          {supplies.loading && !supplies.data ? <PageLoader /> : (supplies.data ?? []).length === 0 ? (
            <Card><EmptyState title="Sin solicitudes" description='Usa el botón "Pedir insumo" para solicitar material.' /></Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              {(supplies.data ?? []).map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-brand">{s.item_name} <span className="text-sm font-normal text-slate-600">× {number(s.quantity)} {s.unit_of_measure ?? ''}</span></div>
                      <div className="text-xs text-slate-500">{buildings.length > 1 && `${s.buildings?.name} · `}{s.requester?.full_name ?? '—'} · {fmtDateTime(s.created_at)}</div>
                      {s.notes && <div className="mt-1 text-sm text-slate-600">{s.notes}</div>}
                    </div>
                    <div className="flex gap-1.5"><Badge tone={URGENCY[s.urgency].tone}>{URGENCY[s.urgency].label}</Badge><Badge tone={SUPPLY_STATUS[s.status].tone}>{SUPPLY_STATUS[s.status].label}</Badge></div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {can('solicitudes.gestionar') ? (
                      <>
                        {s.status === 'pendiente' && <><Button size="sm" onClick={() => void setSupplyStatus(s, 'aprobada')}>Aprobar</Button><Button size="sm" variant="secondary" onClick={() => void setSupplyStatus(s, 'rechazada')}>Rechazar</Button></>}
                        {s.status === 'aprobada' && <Button size="sm" onClick={() => void setSupplyStatus(s, 'comprada')}>Marcar comprada</Button>}
                        {(s.status === 'aprobada' || s.status === 'comprada') && <Button size="sm" variant="sand" onClick={() => void setSupplyStatus(s, 'entregada')}>Marcar entregada</Button>}
                      </>
                    ) : (
                      s.status === 'pendiente' && <Button size="sm" variant="secondary" onClick={() => void cancelRequest(s)}>Cancelar solicitud</Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'movimientos' && (
        moves.loading && !moves.data ? <PageLoader /> : (moves.data ?? []).length === 0 ? <Card><EmptyState title="Sin movimientos" /></Card> : (
          <Card className="divide-y divide-slate-100">
            {(moves.data ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800">{m.inventory_items?.name}</div>
                  <div className="text-xs text-slate-500">{m.creator?.full_name ?? '—'} · {fmtDateTime(m.created_at)}{m.reason && ` · ${m.reason}`}</div>
                </div>
                <div className={`shrink-0 font-semibold ${Number(m.quantity) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{Number(m.quantity) > 0 ? '+' : ''}{number(m.quantity)} {m.inventory_items?.unit_of_measure}</div>
              </div>
            ))}
          </Card>
        )
      )}

      <ItemFormModal open={itemForm.open} item={itemForm.item} onClose={() => setItemForm({ open: false, item: null })} onSaved={reloadAll} />
      <MovementModal target={move} onClose={() => setMove(null)} onSaved={reloadAll} />
      <SupplyRequestModal open={reqOpen} items={items.data ?? []} onClose={() => setReqOpen(false)} onSaved={() => { setTab('solicitudes'); void supplies.reload() }} />
      <ConfirmModal open={!!delItem} title="Eliminar artículo" message={`¿Eliminar "${delItem?.name}" y su historial de movimientos?`} confirmLabel="Eliminar" danger onConfirm={() => void removeItem()} onClose={() => setDelItem(null)} />
      <ConfirmModal open={!!receive} title="Registrar entrada" message={receive ? `¿Sumar ${number(receive.quantity)} ${receive.unit_of_measure ?? ''} de "${receive.item_name}" al inventario?` : ''} confirmLabel="Registrar entrada" onConfirm={() => void registerReceipt()} onClose={() => setReceive(null)} />
    </>
  )
}
