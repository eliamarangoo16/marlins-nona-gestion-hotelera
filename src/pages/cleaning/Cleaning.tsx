import { useMemo, useState } from 'react'
import { Plus, Play, CheckCircle2, StickyNote, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { useStaff } from '@/hooks/useStaff'
import { useUnitOptions } from '@/hooks/useOptions'
import { Alert, Badge, Button, Card, ConfirmModal, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Select, Textarea } from '@/components/ui'
import { TASK_STATUS } from '@/lib/labels'
import { addDays, fmtDate, today, ymd } from '@/lib/dates'
import { emptyToNull, errorMessage } from '@/lib/format'
import type { CleaningFull } from '@/types/models'
import type { Enums } from '@/types/database'

export const CLEAN_SELECT = '*, units(name), buildings(name), assignee:profiles!cleaning_tasks_assigned_to_fkey(full_name)'

export default function Cleaning() {
  const { scopeIds, buildings, units } = useBuildings()
  const { can, user } = useAuth()
  const toast = useToast()
  const manage = can('limpieza.gestionar')
  const staff = useStaff('limpieza', manage)
  const unitOptions = useUnitOptions({ onlyActive: true })
  const [range, setRange] = useState<'hoy' | 'semana' | 'fecha'>('hoy')
  const [date, setDate] = useState(today())
  const [mine, setMine] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [noteTask, setNoteTask] = useState<CleaningFull | null>(null)
  const [del, setDel] = useState<CleaningFull | null>(null)

  const [from, to] = useMemo(() => {
    if (range === 'hoy') return [today(), today()]
    if (range === 'semana') return [today(), ymd(addDays(new Date(), 6))]
    return [date, date]
  }, [range, date])

  const { data, loading, error, reload } = useQuery(async () => {
    if (scopeIds.length === 0) return [] as CleaningFull[]
    let q = supabase.from('cleaning_tasks').select(CLEAN_SELECT).in('building_id', scopeIds).gte('scheduled_date', from).lte('scheduled_date', to).order('scheduled_date')
    if (mine && user) q = q.eq('assigned_to', user.id)
    return unwrap(await q) as unknown as CleaningFull[]
  }, [scopeIds.join(','), from, to, mine, user?.id])

  async function setStatus(t: CleaningFull, s: Enums<'task_status'>) {
    const { error: e } = await supabase.from('cleaning_tasks').update({ status: s }).eq('id', t.id)
    if (e) return toast.error(errorMessage(e))
    toast.success(s === 'terminada' ? 'Limpieza terminada' : 'Estado actualizado')
    void reload()
  }
  async function assign(t: CleaningFull, uid: string) {
    const { error: e } = await supabase.from('cleaning_tasks').update({ assigned_to: uid || null }).eq('id', t.id)
    if (e) return toast.error(errorMessage(e))
    toast.success('Asignación guardada')
    void reload()
  }
  async function remove() {
    if (!del) return
    const { error: e } = await supabase.from('cleaning_tasks').delete().eq('id', del.id)
    if (e) return toast.error(errorMessage(e))
    setDel(null)
    void reload()
  }

  const rows = data ?? []

  return (
    <>
      <PageHeader title="Limpieza" actions={manage && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Nueva tarea</Button>} />
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          {([['hoy', 'Hoy'], ['semana', '7 días'], ['fecha', 'Fecha']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setRange(v)} className={`px-3 py-2 ${range === v ? 'bg-brand text-white' : 'bg-white text-slate-600'}`}>{l}</button>
          ))}
        </div>
        {range === 'fecha' && <Input type="date" aria-label="Fecha" value={date} onChange={(e) => setDate(e.target.value)} />}
        <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Solo mías</label>
      </Card>
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data ? <PageLoader /> : rows.length === 0 ? (
        <Card><EmptyState title="Sin tareas de limpieza" description="No hay limpiezas programadas para este periodo." /></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => {
            const st = TASK_STATUS[t.status]
            const opts = staff.filter((s) => s.building_ids.includes(t.building_id) || s.id === t.assigned_to).map((s) => ({ value: s.id, label: s.full_name ?? s.email }))
            const active = t.status === 'pendiente' || t.status === 'en_progreso'
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold text-brand">{t.units?.name}</div>
                    <div className="text-xs text-slate-500">{buildings.length > 1 && `${t.buildings?.name} · `}{fmtDate(t.scheduled_date)}{t.scheduled_date === today() && ' (hoy)'} · {t.assignee?.full_name ?? 'Sin asignar'}</div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                {t.notes && <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-600">{t.notes}</p>}
                {manage && (
                  <div className="mt-3 max-w-xs"><Select aria-label="Asignar" placeholder="Sin asignar" options={opts} value={t.assigned_to ?? ''} onChange={(e) => void assign(t, e.target.value)} /></div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.status === 'pendiente' && <Button size="lg" className="!w-auto flex-1" icon={<Play className="h-5 w-5" />} onClick={() => void setStatus(t, 'en_progreso')}>Iniciar</Button>}
                  {active && <Button size="lg" variant="sand" className="!w-auto flex-1" icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => void setStatus(t, 'terminada')}>Terminar</Button>}
                  {t.status === 'terminada' && <Button variant="secondary" onClick={() => void setStatus(t, 'pendiente')}>Reabrir</Button>}
                  <Button variant="secondary" icon={<StickyNote className="h-4 w-4" />} onClick={() => setNoteTask(t)}>Notas</Button>
                  {manage && active && <Button variant="ghost" onClick={() => void setStatus(t, 'cancelada')}>Cancelar</Button>}
                  {manage && <Button variant="ghost" icon={<Trash2 className="h-4 w-4 text-red-600" />} aria-label="Eliminar" onClick={() => setDel(t)} />}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <NotesModal task={noteTask} onClose={() => setNoteTask(null)} onSaved={() => void reload()} />
      <CreateModal open={createOpen} unitOptions={unitOptions} units={units} staff={staff} onClose={() => setCreateOpen(false)} onSaved={() => void reload()} />
      <ConfirmModal open={!!del} title="Eliminar tarea" message="¿Eliminar esta tarea de limpieza?" confirmLabel="Eliminar" danger onConfirm={() => void remove()} onClose={() => setDel(null)} />
    </>
  )
}

function NotesModal({ task, onClose, onSaved }: { task: CleaningFull | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [notes, setNotes] = useState('')
  const [last, setLast] = useState<string | null>(null)
  if ((task?.id ?? null) !== last) {
    setLast(task?.id ?? null)
    setNotes(task?.notes ?? '')
  }
  async function save() {
    if (!task) return
    const { error: e } = await supabase.from('cleaning_tasks').update({ notes: emptyToNull(notes) }).eq('id', task.id)
    if (e) return toast.error(errorMessage(e))
    toast.success('Notas guardadas')
    onSaved()
    onClose()
  }
  return (
    <Modal open={!!task} onClose={onClose} title={`Notas · ${task?.units?.name ?? ''}`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => void save()}>Guardar</Button></>}>
      <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones, faltantes, daños…" />
    </Modal>
  )
}

function CreateModal({ open, unitOptions, units, staff, onClose, onSaved }: { open: boolean; unitOptions: { value: string; label: string }[]; units: { id: string; building_id: string }[]; staff: { id: string; full_name: string | null; email: string; building_ids: string[] }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ unit_id: '', date: today(), assigned_to: '', notes: '' })
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setF({ unit_id: '', date: today(), assigned_to: '', notes: '' })
    setError(null)
  }
  if (!open && wasOpen) setWasOpen(false)
  const unit = units.find((u) => u.id === f.unit_id)
  const opts = staff.filter((s) => !unit || s.building_ids.includes(unit.building_id)).map((s) => ({ value: s.id, label: s.full_name ?? s.email }))

  async function save() {
    if (!unit) return setError('Elige un departamento.')
    const { error: e } = await supabase.from('cleaning_tasks').insert({ unit_id: unit.id, building_id: unit.building_id, scheduled_date: f.date, assigned_to: f.assigned_to || null, notes: emptyToNull(f.notes) })
    if (e) return setError(errorMessage(e))
    toast.success('Tarea creada')
    onSaved()
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Nueva tarea de limpieza" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => void save()}>Crear</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Select label="Departamento" placeholder="Selecciona…" options={unitOptions} value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value, assigned_to: '' })} />
        <Input label="Fecha" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <Select label="Asignar a" placeholder="Sin asignar" options={opts} value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })} />
        <Textarea label="Notas" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
    </Modal>
  )
}

