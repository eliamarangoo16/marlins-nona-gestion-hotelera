import { Clock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui'
import { AuthShell } from './AuthShell'

export default function Pending() {
  const { signOut, refreshProfile, profile } = useAuth()
  const inactive = profile && !profile.active
  return (
    <AuthShell title={inactive ? 'Tu cuenta está desactivada' : 'Tu cuenta está pendiente de aprobación'}>
      <div className="flex flex-col items-center gap-3 text-center">
        <Clock className="h-10 w-10 text-sand" />
        <p className="text-sm text-slate-600">
          {inactive
            ? 'Un administrador desactivó tu acceso. Si crees que es un error, contáctalo.'
            : 'Un administrador debe asignarte un rol y los edificios que podrás ver. Cuando lo haga, pulsa "Revisar de nuevo".'}
        </p>
        <p className="text-xs text-slate-400">{profile?.email}</p>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={() => void refreshProfile()}>Revisar de nuevo</Button>
          <Button variant="secondary" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </AuthShell>
  )
}
