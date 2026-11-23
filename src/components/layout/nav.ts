import {
  LayoutDashboard, CalendarDays, BookOpen, Users, Tag, Building2, Wrench, SprayCan, Boxes, Wallet, UserCog, ClipboardList, type LucideIcon,
} from 'lucide-react'
import type { Permiso } from '@/lib/permissions'

export type NavItem = { to: string; label: string; icon: LucideIcon; permiso?: Permiso; any?: Permiso[]; end?: boolean }

export const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, any: ['dashboard', 'mis_tareas'], end: true },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays, permiso: 'calendario' },
  { to: '/reservas', label: 'Reservas', icon: BookOpen, permiso: 'reservas' },
  { to: '/huespedes', label: 'Huéspedes', icon: Users, permiso: 'huespedes' },
  { to: '/tarifas', label: 'Tarifas', icon: Tag, permiso: 'tarifas' },
  { to: '/mantenimiento', label: 'Mantenimiento', icon: Wrench, permiso: 'mantenimiento' },
  { to: '/limpieza', label: 'Limpieza', icon: SprayCan, permiso: 'limpieza' },
  { to: '/inventario', label: 'Inventario', icon: Boxes, permiso: 'inventario' },
  { to: '/finanzas', label: 'Finanzas', icon: Wallet, permiso: 'finanzas' },
  { to: '/edificios', label: 'Edificios', icon: Building2, permiso: 'edificios' },
  { to: '/usuarios', label: 'Usuarios', icon: UserCog, permiso: 'usuarios' },
]

/** Preferencia de la barra inferior en móvil. */
export const MOBILE_PRIMARY = ['/', '/calendario', '/reservas', '/mantenimiento', '/limpieza', '/inventario']

export const TasksIcon = ClipboardList
