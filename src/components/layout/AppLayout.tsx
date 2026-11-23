import { useMemo, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { Menu, X, LogOut, UserCircle, Bell, Building } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useBuildings } from '@/context/BuildingContext'
import { ROLE_LABELS } from '@/lib/permissions'
import { NAV, MOBILE_PRIMARY } from './nav'
import { NotificationBell } from './NotificationBell'

function Logo({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className={small ? 'h-7 w-7' : 'h-9 w-9'} />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-wide text-white">Marlins &amp; Nona</span>
        {!small && <span className="block text-[11px] text-sand">Gestión hotelera</span>}
      </span>
    </Link>
  )
}

export function AppLayout() {
  const { profile, role, can, signOut } = useAuth()
  const { buildings, selected, setSelected } = useBuildings()
  const [menuOpen, setMenuOpen] = useState(false)

  const items = useMemo(
    () => NAV.filter((n) => (n.permiso ? can(n.permiso) : n.any?.some((p) => can(p)))),
    [can],
  )
  const primary = useMemo(
    () => MOBILE_PRIMARY.map((to) => items.find((i) => i.to === to)).filter((x): x is (typeof items)[number] => !!x).slice(0, 4),
    [items],
  )

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-white/10 text-sand' : 'text-white/80 hover:bg-white/5 hover:text-white'
    }`

  return (
    <div className="flex min-h-full">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-brand md:flex">
        <div className="px-4 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>
              <n.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link to="/perfil" className="flex items-center gap-2 rounded-lg px-2 py-2 text-white/90 hover:bg-white/5">
            <UserCircle className="h-8 w-8 text-sand" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium">{profile?.full_name ?? profile?.email}</span>
              <span className="block text-[11px] text-white/60">{role ? ROLE_LABELS[role] : ''}</span>
            </span>
          </Link>
          <button onClick={() => void signOut()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        {/* Header */}
        <header className="safe-top sticky top-0 z-20 flex items-center gap-2 bg-brand px-3 py-2 shadow md:px-6">
          <div className="md:hidden">
            <Logo small />
          </div>
          <div className="flex-1" />
          {buildings.length > 1 && (
            <label className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-white">
              <Building className="h-4 w-4 text-sand" />
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="max-w-[9.5rem] truncate bg-transparent text-sm focus:outline-none sm:max-w-none [&>option]:text-slate-900"
                aria-label="Edificio"
              >
                <option value="all">Todos los edificios</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <NotificationBell />
        </header>

        <main className="flex-1 px-3 pb-24 pt-4 md:px-6 md:pb-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Barra inferior móvil */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white md:hidden">
        {primary.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-slate-500'}`
            }
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </NavLink>
        ))}
        <button onClick={() => setMenuOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <Menu className="h-5 w-5" />
          Menú
        </button>
      </nav>

      {/* Menú móvil */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-brand-900/50" onClick={() => setMenuOpen(false)} />
          <div className="safe-bottom absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-brand">{profile?.full_name ?? profile?.email}</div>
                <div className="text-xs text-slate-500">{role ? ROLE_LABELS[role] : ''}</div>
              </div>
              <button onClick={() => setMenuOpen(false)} aria-label="Cerrar" className="rounded p-1 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...items, { to: '/notificaciones', label: 'Avisos', icon: Bell }, { to: '/perfil', label: 'Mi perfil', icon: UserCircle }].map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 px-2 py-3 text-xs font-medium text-brand hover:bg-slate-50"
                >
                  <n.icon className="h-5 w-5" />
                  {n.label}
                </NavLink>
              ))}
            </div>
            <button
              onClick={() => void signOut()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
