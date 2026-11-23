import type { Enums } from '@/types/database'

export type Role = Enums<'app_role'>

export type Permiso =
  | 'dashboard'
  | 'mis_tareas'
  | 'edificios'
  | 'edificios.crear'
  | 'calendario'
  | 'reservas'
  | 'huespedes'
  | 'tarifas'
  | 'mantenimiento'
  | 'mantenimiento.asignar'
  | 'limpieza'
  | 'limpieza.gestionar'
  | 'inventario'
  | 'inventario.entrada'
  | 'inventario.administrar'
  | 'solicitudes.gestionar'
  | 'finanzas'
  | 'usuarios'
  | 'usuarios.developer'

const ADMINS: Role[] = ['developer', 'admin_universal', 'admin_edificio']
const GLOBAL: Role[] = ['developer', 'admin_universal']
const STAFF: Role[] = ['mantenimiento', 'limpieza']

const MATRIX: Record<Permiso, Role[]> = {
  dashboard: ADMINS,
  mis_tareas: STAFF,
  edificios: ADMINS,
  'edificios.crear': GLOBAL,
  calendario: ADMINS,
  reservas: ADMINS,
  huespedes: ADMINS,
  tarifas: ADMINS,
  mantenimiento: [...ADMINS, 'mantenimiento', 'limpieza'],
  'mantenimiento.asignar': ADMINS,
  limpieza: [...ADMINS, 'limpieza'],
  'limpieza.gestionar': ADMINS,
  inventario: [...ADMINS, ...STAFF],
  'inventario.entrada': ADMINS,
  'inventario.administrar': ADMINS,
  'solicitudes.gestionar': ADMINS,
  finanzas: ADMINS,
  usuarios: GLOBAL,
  'usuarios.developer': ['developer'],
}

export function can(role: Role | null | undefined, permiso: Permiso): boolean {
  if (!role) return false
  return MATRIX[permiso].includes(role)
}

export const isAdmin = (role: Role | null | undefined) => !!role && ADMINS.includes(role)
export const isGlobalAdmin = (role: Role | null | undefined) => !!role && GLOBAL.includes(role)

export const ROLE_LABELS: Record<Role, string> = {
  developer: 'Developer',
  admin_universal: 'Administrador universal',
  admin_edificio: 'Administrador de edificio',
  mantenimiento: 'Mantenimiento',
  limpieza: 'Limpieza',
  sin_asignar: 'Sin asignar',
}
