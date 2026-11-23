import { useEffect, useState, type FormEvent } from 'react'
import { BellRing, BellOff, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Alert, Button, Card, CardHeader, Input, PageHeader } from '@/components/ui'
import { ROLE_LABELS } from '@/lib/permissions'
import { emptyToNull, errorMessage } from '@/lib/format'
import { disablePush, enablePush, getCurrentSubscription, isIOS, isStandalone, pushSupported } from '@/lib/push'

export default function Profile() {
  const { profile, user, refreshProfile, updatePassword } = useAuth()
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  useEffect(() => {
    setName(profile?.full_name ?? '')
    setPhone(profile?.phone ?? '')
  }, [profile])

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() || null, phone: emptyToNull(phone) }).eq('id', user.id)
    setSaving(false)
    if (error) return toast.error(errorMessage(error))
    toast.success('Perfil actualizado')
    void refreshProfile()
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setPwError(null)
    if (pw.length < 8) return setPwError('La contraseña debe tener al menos 8 caracteres.')
    if (pw !== pw2) return setPwError('Las contraseñas no coinciden.')
    setPwSaving(true)
    try {
      await updatePassword(pw)
      toast.success('Contraseña actualizada')
      setPw('')
      setPw2('')
    } catch (err) {
      setPwError(errorMessage(err))
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Mi perfil" subtitle={`${profile?.email ?? ''} · ${profile ? ROLE_LABELS[profile.role] : ''}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Datos personales" />
          <form onSubmit={saveProfile} className="space-y-3 p-4">
            <Input label="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Teléfono" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" loading={saving}>Guardar</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Cambiar contraseña" />
          <form onSubmit={savePassword} className="space-y-3 p-4">
            {pwError && <Alert tone="error">{pwError}</Alert>}
            <Input label="Nueva contraseña" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <Input label="Confirmar contraseña" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <Button type="submit" loading={pwSaving}>Actualizar contraseña</Button>
          </form>
        </Card>
        <PushCard />
      </div>
    </>
  )
}

function PushCard() {
  const { user } = useAuth()
  const toast = useToast()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(pushSupported() ? Notification.permission : 'unsupported')

  useEffect(() => {
    if (!pushSupported()) return
    void getCurrentSubscription().then((s) => setEnabled(!!s && Notification.permission === 'granted'))
  }, [])

  const iosNeedsInstall = isIOS() && !isStandalone()

  async function toggle() {
    if (!user) return
    setBusy(true)
    try {
      if (enabled) {
        await disablePush()
        setEnabled(false)
        toast.success('Notificaciones desactivadas en este dispositivo')
      } else {
        await enablePush()
        setEnabled(true)
        toast.success('Notificaciones activadas')
      }
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPermission(pushSupported() ? Notification.permission : 'unsupported')
      setBusy(false)
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Notificaciones en este celular" />
      <div className="space-y-3 p-4">
        {iosNeedsInstall && (
          <Alert tone="warn">
            <div className="flex items-start gap-2">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>En iPhone / iPad:</strong> primero agrega la app a tu pantalla de inicio. Abre esta página en <strong>Safari</strong>, toca el botón <strong>Compartir</strong> y elige <strong>"Agregar a pantalla de inicio"</strong>. Después abre la app desde el nuevo ícono y activa las notificaciones aquí (requiere iOS 16.4 o superior).
              </div>
            </div>
          </Alert>
        )}
        {permission === 'unsupported' && !iosNeedsInstall && <Alert tone="warn">Este navegador no soporta notificaciones push. Prueba con Chrome en Android o instala la app.</Alert>}
        {permission === 'denied' && <Alert tone="error">Bloqueaste las notificaciones para este sitio. Actívalas desde los ajustes del navegador o del sistema y vuelve a intentarlo.</Alert>}
        <p className="text-sm text-slate-600">Recibe avisos de reservas, tickets, limpiezas y solicitudes aunque la app esté cerrada. Estado en este dispositivo: <strong>{enabled ? 'activadas' : 'desactivadas'}</strong>.</p>
        <Button onClick={() => void toggle()} loading={busy} disabled={permission === 'unsupported' || iosNeedsInstall} variant={enabled ? 'secondary' : 'primary'} icon={enabled ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}>
          {enabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}
        </Button>
      </div>
    </Card>
  )
}
