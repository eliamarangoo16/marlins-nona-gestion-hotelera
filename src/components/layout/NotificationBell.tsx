import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { fmtDateTime } from '@/lib/dates'

export function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-white/90 hover:bg-white/10"
        aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sand px-1 text-[10px] font-bold text-brand-900">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-14 z-50 max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-brand">Notificaciones</span>
            <button onClick={() => void markAllRead()} className="flex items-center gap-1 text-xs font-medium text-brand-500 hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
            </button>
          </div>
          <div className="max-h-[55vh] overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No tienes notificaciones.</p>}
            {items.slice(0, 15).map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  void markRead(n.id)
                  setOpen(false)
                  if (n.link) navigate(n.link)
                }}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${n.read_at ? '' : 'bg-sand-50'}`}
              >
                <div className="flex items-start gap-2">
                  {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sand" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{n.title}</div>
                    {n.body && <div className="line-clamp-2 text-xs text-slate-600">{n.body}</div>}
                    <div className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(n.created_at)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Link to="/notificaciones" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-500 hover:bg-slate-50">
            Ver todas
          </Link>
        </div>
      )}
    </div>
  )
}
