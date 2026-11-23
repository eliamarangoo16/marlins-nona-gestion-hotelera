import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Alert } from '@/components/ui'
import { AuthShell } from './AuthShell'

export default function Login() {
  const { signIn, session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      const msg = (err as Error).message
      setError(/invalid login/i.test(msg) ? 'Correo o contraseña incorrectos.' : /not confirmed/i.test(msg) ? 'Debes confirmar tu correo antes de entrar.' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Iniciar sesión" subtitle="Entra con tu correo y contraseña">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Correo electrónico" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Entrar
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/recuperar" className="text-brand-500 hover:underline">
          Olvidé mi contraseña
        </Link>
        <Link to="/registro" className="text-brand-500 hover:underline">
          Crear cuenta
        </Link>
      </div>
    </AuthShell>
  )
}
