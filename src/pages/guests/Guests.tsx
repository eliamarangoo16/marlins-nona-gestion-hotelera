import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Phone, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { Alert, Badge, Button, Card, ConfirmModal, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Textarea } from '@/components/ui'
import { emptyToNull, errorMessage, money } from '@/lib/format'
import { fmtDate } from '@/lib/dates'
import { RESERVATION_STATUS } from '@/lib/labels'
import type { Guest, ReservationFull } from '@/types/models'

export default function Guests() {
  const { role } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Guest | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [view, setView] = useState<Guest | null>(null)
  const [del, setDel] = useState<Guest | null>(null)

  const { data, loading, error, reload } = useQuery(async () => unwrap(await supabase.from('guests').select('*').order('full_name').limit(2000)) as Guest[], [])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    const all = data ?? []
    return s ? all.filter((g) => g.full_name.toLowerCase().includes(s) || (g.phone ?? '').includes(s) || (g.email ?? '').toLowerCase().includes(s)) : all
  }, [data, q])

  async function remove() {
    if (!del) return
    const { error: e } = await supabase.from('guests').delete().eq('id', del.id)
    if (e) return toast.error(errorMessage(e))
    toast.success('Huésped eliminado')
    setDel(null)
    void reload()
  }

  return (
    <>
      <PageHeader title="Huéspedes" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEdit(null); setFormOpen(true) }}>Nuevo huésped</Button>} />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar por nombre, teléfono o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data ? <PageLoader /> : rows.length === 0 ? (
        <Card><EmptyState title={q ? 'Sin resultados' : 'Aún no hay huéspedes'} description={q ? 'Prueba con otra búsqueda.' : 'Se crean al registrar reservas o con el botón "Nuevo huésped".'} /></Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {rows.map((g) => (
            <div key={g.id} className="flex items-center gap-3 px-4 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setView(g)}>
                <div className="truncate font-medium text-brand">{g.full_name}</div>
                <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                  {g.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{g.phone}</span>}
                  {g.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{g.email}</span>}
                  {g.country && <span>{g.country}</span>}
                </div>
              </button>
              <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Editar" onClick={() => { setEdit(g); setFormOpen(true) }}><Pencil className="h-4 w-4" /></button>
              {(role === 'developer' || role === 'admin_universal') && <button className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Eliminar" onClick={() => setDel(g)}><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
        </Card>
      )}
      <GuestForm open={formOpen} guest={edit} onClose={() => setFormOpen(false)} onSaved={() => void reload()} />
      <GuestHistory guest={view} onClose={() => setView(null)} />
      <ConfirmModal open={!!del} title="Eliminar huésped" message={`¿Eliminar a ${del?.full_name}? Sus reservas quedarán sin huésped.`} confirmLabel="Eliminar" danger onConfirm={() => void remove()} onClose={() => setDel(null)} />
    </>
  )
}

function GuestForm({ open, guest, onClose, onSaved }: { open: boolean; guest: Guest | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ full_name: '', email: '', phone: '', country: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastKey, setLastKey] = useState<string | null>(null)

  const key = open ? (guest?.id ?? 'new') : null
  if (key !== lastKey) {
    setLastKey(key)
    if (key) {
      setF({ full_name: guest?.full_name ?? '', email: guest?.email ?? '', phone: guest?.phone ?? '', country: guest?.country ?? '', notes: guest?.notes ?? '' })
      setError(null)
    }
  }

  async function save() {
    if (!f.full_name.trim()) return setError('El nombre es obligatorio.')
    setSaving(true)
    const payload = { full_name: f.full_name.trim(), email: emptyToNull(f.email), phone: emptyToNull(f.phone), country: emptyToNull(f.country), notes: emptyToNull(f.notes) }
    const res = guest ? await supabase.from('guests').update(payload).eq('id', guest.id) : await supabase.from('guests').insert(payload)
    setSaving(false)
    if (res.error) return setError(errorMessage(res.error))
    toast.success('Huésped guardado')
    onSaved()
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={guest ? 'Editar huésped' : 'Nuevo huésped'} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Guardar</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Nombre completo" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Teléfono" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <Input label="Correo" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <Input label="País" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
        <Textarea label="Notas" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
    </Modal>
  )
}

function GuestHistory({ guest, onClose }: { guest: Guest | null; onClose: () => void }) {
  const { data, loading } = useQuery(async () => {
    if (!guest) return [] as ReservationFull[]
    return unwrap(await supabase.from('reservations').select('*, units(name, building_id, buildings(name)), guests(full_name, phone, email)').eq('guest_id', guest.id).order('check_in', { ascending: false })) as unknown as ReservationFull[]
  }, [guest?.id], !!guest)
  return (
    <Modal open={!!guest} onClose={onClose} title={guest?.full_name ?? ''} size="md">
      {guest && (
        <div className="space-y-3 text-sm">
          <div className="text-slate-600">{[guest.phone, guest.email, guest.country].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</div>
          {guest.notes && <p className="rounded-lg bg-slate-50 p-2 text-slate-600">{guest.notes}</p>}
          <h3 className="pt-2 font-semibold text-brand">Historial de reservas</h3>
          {loading ? <PageLoader /> : (data ?? []).length === 0 ? <p className="text-slate-500">Sin reservas.</p> : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {(data ?? []).map((r) => (
                <Link key={r.id} to={`/reservas/${r.id}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50">
                  <span>{r.units?.buildings?.name} · {r.units?.name}<br /><span className="text-xs text-slate-500">{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</span></span>
                  <span className="text-right">{money(r.total_amount)}<br /><Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge></span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
