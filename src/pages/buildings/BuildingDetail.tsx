import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { Badge, Button, Card, CardHeader, ConfirmModal, EmptyState, PageHeader, PageLoader, Table, THead, Th, Td, Tr } from '@/components/ui'
import { money } from '@/lib/format'
import { UNIT_STATUS } from '@/lib/labels'
import { errorMessage } from '@/lib/format'
import { BuildingFormModal } from './BuildingFormModal'
import { UnitFormModal } from './UnitFormModal'
import type { Unit } from '@/types/models'

export default function BuildingDetail() {
  const { id = '' } = useParams()
  const { buildings, units, loading, refresh } = useBuildings()
  const toast = useToast()
  const building = buildings.find((b) => b.id === id)
  const list = units.filter((u) => u.building_id === id)
  const [unitOpen, setUnitOpen] = useState(false)
  const [editUnit, setEditUnit] = useState<Unit | null>(null)
  const [bOpen, setBOpen] = useState(false)
  const [del, setDel] = useState<Unit | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (loading) return <PageLoader />
  if (!building) return <Card><EmptyState title="Edificio no encontrado" action={<Link to="/edificios" className="text-brand-500 underline">Volver a edificios</Link>} /></Card>

  async function remove() {
    if (!del) return
    setDeleting(true)
    const { error } = await supabase.from('units').delete().eq('id', del.id)
    setDeleting(false)
    if (error) {
      toast.error(error.code === '23503' ? 'No se puede eliminar: el departamento tiene reservas. Mejor márcalo como inactivo.' : errorMessage(error))
      return
    }
    toast.success('Departamento eliminado')
    setDel(null)
    void refresh()
  }

  return (
    <>
      <Link to="/edificios" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand"><ArrowLeft className="h-4 w-4" /> Edificios</Link>
      <PageHeader
        title={building.name}
        subtitle={[building.address, building.city, building.state, building.postal_code].filter(Boolean).join(', ')}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setBOpen(true)}>Editar</Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditUnit(null); setUnitOpen(true) }}>Nuevo departamento</Button>
          </>
        }
      />
      {building.notes && <p className="mb-3 text-sm text-slate-600">{building.notes}</p>}
      <Card>
        <CardHeader title={`Departamentos (${list.length})`} />
        {list.length === 0 ? (
          <EmptyState title="Sin departamentos" description="Agrega el primer departamento de este edificio." />
        ) : (
          <Table>
            <THead><Th>Nombre</Th><Th>Piso</Th><Th>Rec/Baños</Th><Th>Máx.</Th><Th>Tarifa base</Th><Th>Limpieza</Th><Th>Estado</Th><Th /></THead>
            <tbody>
              {list.map((u) => (
                <Tr key={u.id}>
                  <Td className="font-medium text-brand">
                    {u.name} {!u.active && <Badge tone="gray">Inactivo</Badge>}
                  </Td>
                  <Td>{u.floor ?? '—'}</Td>
                  <Td>{u.bedrooms} / {u.bathrooms}</Td>
                  <Td>{u.max_guests}</Td>
                  <Td>{money(u.base_rate)}</Td>
                  <Td>{money(u.cleaning_fee)}</Td>
                  <Td><Badge tone={UNIT_STATUS[u.status].tone}>{UNIT_STATUS[u.status].label}</Badge></Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {u.airbnb_listing_url && (
                        <a href={u.airbnb_listing_url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Abrir en Airbnb"><ExternalLink className="h-4 w-4" /></a>
                      )}
                      <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Editar" onClick={() => { setEditUnit(u); setUnitOpen(true) }}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Eliminar" onClick={() => setDel(u)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <BuildingFormModal open={bOpen} building={building} onClose={() => setBOpen(false)} onSaved={() => void refresh()} />
      <UnitFormModal open={unitOpen} buildingId={building.id} unit={editUnit} onClose={() => setUnitOpen(false)} onSaved={() => void refresh()} />
      <ConfirmModal open={!!del} title="Eliminar departamento" message={`¿Eliminar "${del?.name}"? Esta acción no se puede deshacer.`} confirmLabel="Eliminar" danger loading={deleting} onConfirm={() => void remove()} onClose={() => setDel(null)} />
    </>
  )
}
