import type { Enums } from '@/types/database'

export type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'sand'

type Meta = { label: string; tone: Tone }

export const RESERVATION_STATUS: Record<Enums<'reservation_status'>, Meta> = {
  pendiente: { label: 'Pendiente', tone: 'amber' },
  confirmada: { label: 'Confirmada', tone: 'blue' },
  en_curso: { label: 'En curso', tone: 'green' },
  finalizada: { label: 'Finalizada', tone: 'gray' },
  cancelada: { label: 'Cancelada', tone: 'red' },
}
export const CHANNELS: Record<Enums<'booking_channel'>, string> = {
  airbnb: 'Airbnb',
  directo: 'Directo',
  booking: 'Booking',
  vrbo: 'VRBO',
  otro: 'Otro',
}
export const UNIT_STATUS: Record<Enums<'unit_status'>, Meta> = {
  disponible: { label: 'Disponible', tone: 'green' },
  ocupado: { label: 'Ocupado', tone: 'blue' },
  limpieza: { label: 'En limpieza', tone: 'purple' },
  mantenimiento: { label: 'En mantenimiento', tone: 'amber' },
  bloqueado: { label: 'Bloqueado', tone: 'gray' },
}
export const TICKET_PRIORITY: Record<Enums<'ticket_priority'>, Meta> = {
  baja: { label: 'Baja', tone: 'gray' },
  media: { label: 'Media', tone: 'blue' },
  alta: { label: 'Alta', tone: 'amber' },
  urgente: { label: 'Urgente', tone: 'red' },
}
export const TICKET_STATUS: Record<Enums<'ticket_status'>, Meta> = {
  abierto: { label: 'Abierto', tone: 'red' },
  en_progreso: { label: 'En progreso', tone: 'blue' },
  en_espera: { label: 'En espera', tone: 'amber' },
  resuelto: { label: 'Resuelto', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'gray' },
}
export const TASK_STATUS: Record<Enums<'task_status'>, Meta> = {
  pendiente: { label: 'Pendiente', tone: 'amber' },
  en_progreso: { label: 'En progreso', tone: 'blue' },
  terminada: { label: 'Terminada', tone: 'green' },
  cancelada: { label: 'Cancelada', tone: 'gray' },
}
export const SUPPLY_STATUS: Record<Enums<'supply_status'>, Meta> = {
  pendiente: { label: 'Pendiente', tone: 'amber' },
  aprobada: { label: 'Aprobada', tone: 'blue' },
  comprada: { label: 'Comprada', tone: 'purple' },
  entregada: { label: 'Entregada', tone: 'green' },
  rechazada: { label: 'Rechazada', tone: 'red' },
}
export const URGENCY: Record<Enums<'urgency_level'>, Meta> = {
  baja: { label: 'Baja', tone: 'gray' },
  normal: { label: 'Normal', tone: 'blue' },
  alta: { label: 'Alta', tone: 'amber' },
  urgente: { label: 'Urgente', tone: 'red' },
}

export const INVENTORY_CATEGORIES = [
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'amenidades', label: 'Amenidades' },
  { value: 'blancos', label: 'Blancos' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'otro', label: 'Otro' },
]
export const EXPENSE_CATEGORIES = [
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'comisiones', label: 'Comisiones' },
  { value: 'nomina', label: 'Nómina' },
  { value: 'otro', label: 'Otro' },
]
export const categoryLabel = (list: { value: string; label: string }[], v: string) =>
  list.find((c) => c.value === v)?.label ?? v

export const toOptions = <T extends string>(rec: Record<T, Meta | string>) =>
  (Object.keys(rec) as T[]).map((k) => ({
    value: k,
    label: typeof rec[k] === 'string' ? (rec[k] as string) : (rec[k] as Meta).label,
  }))
