import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Alert } from '@/components/ui'
import { AuthShell } from './AuthShell'

export default function Register() {
  const { signUp, session } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    setLoading(true)
    try {
      const { needsConfirmation } = await signUp(email.trim(), password, name.trim())
      if (needsConfirmation) setInfo('Te enviamos un correo para confirmar tu cuenta. Después de confirmarlo podrás iniciar sesión.')
    } catch (err) {
      const msg = (err as Error).message
      setError(/already registered/i.test(msg) ? 'Ya existe una cuenta con ese correo.' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Crear cuenta" subtitle="Solo para primer acceso">
      <Alert tone="warn">
        Una cuenta nueva queda <strong>sin asignar</strong> hasta que un administrador te dé un rol. Si ya te crearon un usuario, entra con la contraseña temporal que te dieron.
      </Alert>
      {info ? (
        <div className="mt-4 space-y-3">
          <Alert tone="success">{info}</Alert>
          <Link to="/login" className="block text-center text-sm text-brand-500 hover:underline">
            Ir a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Input label="Nombre completo" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <Input label="Correo electrónico" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Input label="Contraseña" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint="Mínimo 8 caracteres" />
          <Button type="submit" loading={loading} size="lg">
            Crear cuenta
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-brand-500 hover:underline">
              Ya tengo cuenta
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
