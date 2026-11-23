import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { Button, Card, EmptyState, PageHeader, PageLoader } from '@/components/ui'
import { fmtDateTime } from '@/lib/dates'

export default function Notifications() {
  const { items, loading, unread, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()
  return (
    <>
      <PageHeader title="Notificaciones" subtitle={unread ? `${unread} sin leer` : 'Todo al día'} actions={<Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} disabled={!unread} onClick={() => void markAllRead()}>Marcar todas como leídas</Button>} />
      {loading ? <PageLoader /> : items.length === 0 ? (
        <Card><EmptyState icon={<Bell className="h-10 w-10" />} title="Sin notificaciones" description="Aquí verás reservas, tickets, limpiezas y solicitudes." /></Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {items.map((n) => (
            <button key={n.id} onClick={() => { void markRead(n.id); if (n.link) navigate(n.link) }} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.read_at ? '' : 'bg-sand-50'}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-sand'}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800">{n.title}</span>
                {n.body && <span className="block text-sm text-slate-600">{n.body}</span>}
                <span className="mt-0.5 block text-xs text-slate-400">{fmtDateTime(n.created_at)}</span>
              </span>
            </button>
          ))}
        </Card>
      )}
    </>
  )
}
