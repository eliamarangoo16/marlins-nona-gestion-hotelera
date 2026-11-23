import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Alert } from '@/components/ui'
import { AuthShell } from './AuthShell'

/** Pantalla para cambiar contraseña; también atiende el flujo de recovery de Supabase. */
export default function ChangePassword() {
  const { updatePassword, session, recovery, clearRecovery, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setLoading(true)
    try {
      await updatePassword(password)
      clearRecovery()
      setDone(true)
      setTimeout(() => navigate('/', { replace: true }), 1500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title={recovery ? 'Crea tu nueva contraseña' : 'Cambiar contraseña'}>
      {authLoading ? null : !session ? (
        <div className="space-y-3">
          <Alert tone="warn">El enlace expiró o no es válido. Solicita uno nuevo.</Alert>
          <Link to="/recuperar" className="block text-center text-sm text-brand-500 hover:underline">
            Recuperar contraseña
          </Link>
        </div>
      ) : done ? (
        <Alert tone="success">Contraseña actualizada. Redirigiendo…</Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Input label="Nueva contraseña" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <Input label="Confirmar contraseña" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          <Button type="submit" loading={loading} size="lg">
            Guardar contraseña
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
