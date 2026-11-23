import { useMemo, useState } from 'react'
import { Copy, KeyRound, Pencil, Plus, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { Alert, Badge, Button, Card, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Select } from '@/components/ui'
import { ROLE_LABELS, type Role } from '@/lib/permissions'
import { errorMessage, generatePassword } from '@/lib/format'
import type { Profile } from '@/types/models'
import type { Tone } from '@/lib/labels'

const ROLE_TONE: Record<Role, Tone> = { developer: 'purple', admin_universal: 'blue', admin_edificio: 'sand', mantenimiento: 'amber', limpieza: 'green', sin_asignar: 'gray' }

async function callAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    let msg = errorMessage(error)
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json()
        if (j?.error) msg = j.error
      } catch { /* ignorar */ }
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data as { ok: boolean; user_id?: string }
}

export default function Users() {
  const { can, user } = useAuth()
  const { buildings } = useBuildings()
  const [edit, setEdit] = useState<Profile | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null)

  const { data, loading, error, reload } = useQuery(async () => {
    const [p, a] = await Promise.all([supabase.from('profiles').select('*').order('created_at'), supabase.from('building_assignments').select('*')])
    return { profiles: unwrap(p) as Profile[], assignments: unwrap(a) as { user_id: string; building_id: string }[] }
  }, [])

  const isDev = can('usuarios.developer')
  // developer ve todos; admin_universal solo roles inferiores
  const roleOptions = useMemo(() => (Object.keys(ROLE_LABELS) as Role[]).filter((r) => isDev || !['developer', 'admin_universal'].includes(r)).map((r) => ({ value: r, label: ROLE_LABELS[r] })), [isDev])

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Roles, edificios asignados y accesos" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Crear usuario</Button>} />
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data ? <PageLoader /> : (data?.profiles ?? []).length === 0 ? <Card><EmptyState title="Sin usuarios" /></Card> : (
        <Card className="divide-y divide-slate-100">
          {(data?.profiles ?? []).map((p) => {
            const bs = (data?.assignments ?? []).filter((a) => a.user_id === p.id).map((a) => buildings.find((b) => b.id === a.building_id)?.name).filter(Boolean)
            const locked = !isDev && (p.role === 'developer' || p.role === 'admin_universal')
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="font-medium text-brand">{p.full_name ?? p.email} {p.id === user?.id && <span className="text-xs text-slate-400">(tú)</span>}</div>
                  <div className="text-xs text-slate-500">{p.email}{p.phone && ` · ${p.phone}`}</div>
                  <div className="text-xs text-slate-500">{['developer', 'admin_universal'].includes(p.role) ? 'Todos los edificios' : bs.length ? bs.join(', ') : 'Sin edificios asignados'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={ROLE_TONE[p.role]}>{ROLE_LABELS[p.role]}</Badge>
                  {!p.active && <Badge tone="red">Inactivo</Badge>}
                </div>
                {!locked && <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEdit(p)}>Editar</Button>}
              </div>
            )
          })}
        </Card>
      )}
      <CreateUserModal open={createOpen} roleOptions={roleOptions} onClose={() => setCreateOpen(false)} onCreated={(c) => { setCred(c); void reload() }} />
      <EditUserModal profile={edit} roleOptions={roleOptions} assigned={(data?.assignments ?? []).filter((a) => a.user_id === edit?.id).map((a) => a.building_id)} onClose={() => setEdit(null)} onSaved={() => void reload()} onCred={setCred} />
      <CredentialsModal cred={cred} onClose={() => setCred(null)} />
    </>
  )
}

function BuildingChecks({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const { buildings } = useBuildings()
  if (buildings.length === 0) return <p className="text-sm text-slate-500">Aún no hay edificios.</p>
  return (
    <div className="space-y-1.5">
      {buildings.map((b) => (
        <label key={b.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={disabled} checked={value.includes(b.id)} onChange={(e) => onChange(e.target.checked ? [...value, b.id] : value.filter((x) => x !== b.id))} /> {b.name}
        </label>
      ))}
    </div>
  )
}

function CreateUserModal({ open, roleOptions, onClose, onCreated }: { open: boolean; roleOptions: { value: string; label: string }[]; onClose: () => void; onCreated: (c: { email: string; password: string }) => void }) {
  const [f, setF] = useState({ full_name: '', email: '', phone: '', role: 'limpieza', password: '' })
  const [bs, setBs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setF({ full_name: '', email: '', phone: '', role: 'limpieza', password: generatePassword() })
    setBs([])
    setError(null)
  }
  if (!open && wasOpen) setWasOpen(false)

  const global = f.role === 'developer' || f.role === 'admin_universal'

  async function save() {
    if (!f.full_name.trim() || !f.email.trim()) return setError('Nombre y correo son obligatorios.')
    if (!global && f.role !== 'sin_asignar' && bs.length === 0) return setError('Asigna al menos un edificio a este usuario.')
    setSaving(true)
    setError(null)
    try {
      await callAdmin({ action: 'create', email: f.email.trim(), password: f.password, full_name: f.full_name.trim(), phone: f.phone.trim(), role: f.role, building_ids: global ? [] : bs })
      onCreated({ email: f.email.trim(), password: f.password })
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Crear usuario" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Crear usuario</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Nombre completo" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Correo" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input label="Teléfono" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <Select label="Rol" options={roleOptions} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
        {!global && <div><span className="mb-1 block text-sm font-medium text-slate-700">Edificios</span><BuildingChecks value={bs} onChange={setBs} /></div>}
        <div className="flex items-end gap-2">
          <Input wrapperClassName="flex-1" label="Contraseña temporal" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} hint="Se mostrará una sola vez al crear" />
          <Button variant="secondary" aria-label="Generar" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setF({ ...f, password: generatePassword() })} />
        </div>
      </div>
    </Modal>
  )
}

function EditUserModal({ profile, roleOptions, assigned, onClose, onSaved, onCred }: { profile: Profile | null; roleOptions: { value: string; label: string }[]; assigned: string[]; onClose: () => void; onSaved: () => void; onCred: (c: { email: string; password: string }) => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ full_name: '', phone: '', role: 'sin_asignar', active: true })
  const [bs, setBs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  if ((profile?.id ?? null) !== last) {
    setLast(profile?.id ?? null)
    if (profile) {
      setF({ full_name: profile.full_name ?? '', phone: profile.phone ?? '', role: profile.role, active: profile.active })
      setBs(assigned)
      setError(null)
    }
  }
  const self = profile?.id === user?.id
  const global = f.role === 'developer' || f.role === 'admin_universal'

  async function save() {
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      await callAdmin({
        action: 'update', user_id: profile.id, full_name: f.full_name, phone: f.phone,
        ...(self ? {} : { role: f.role, active: f.active }),
        building_ids: global ? [] : bs,
      })
      toast.success('Usuario actualizado')
      onSaved()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  async function reset() {
    if (!profile) return
    const password = generatePassword()
    setSaving(true)
    try {
      await callAdmin({ action: 'reset_password', user_id: profile.id, password })
      onCred({ email: profile.email, password })
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!profile} onClose={onClose} title={`Editar · ${profile?.email ?? ''}`} footer={<><Button variant="secondary" icon={<KeyRound className="h-4 w-4" />} loading={saving} onClick={() => void reset()}>Nueva contraseña</Button><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Guardar</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {self && <Alert tone="info">No puedes cambiar tu propio rol ni desactivarte.</Alert>}
        <Input label="Nombre completo" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <Input label="Teléfono" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Select label="Rol" disabled={self} options={roleOptions} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
        {!global && <div><span className="mb-1 block text-sm font-medium text-slate-700">Edificios asignados</span><BuildingChecks value={bs} onChange={setBs} /></div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={self} checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Cuenta activa</label>
      </div>
    </Modal>
  )
}

function CredentialsModal({ cred, onClose }: { cred: { email: string; password: string } | null; onClose: () => void }) {
  const toast = useToast()
  const text = cred ? `Correo: ${cred.email}\nContraseña temporal: ${cred.password}\nEntra en ${window.location.origin}${import.meta.env.BASE_URL}` : ''
  return (
    <Modal open={!!cred} onClose={onClose} title="Credenciales del usuario" size="sm" footer={<Button onClick={onClose}>Listo</Button>}>
      <div className="space-y-3">
        <Alert tone="warn">Copia y comparte estos datos ahora. <strong>La contraseña no se volverá a mostrar.</strong> Pide al usuario que la cambie en su perfil.</Alert>
        <pre className="whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-sm">{text}</pre>
        <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => { void navigator.clipboard?.writeText(text).then(() => toast.success('Copiado')) }}>Copiar</Button>
      </div>
    </Modal>
  )
}
