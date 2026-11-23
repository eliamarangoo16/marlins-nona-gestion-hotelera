import { addDays, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

export const YMD = 'yyyy-MM-dd'

export const ymd = (d: Date) => format(d, YMD)
export const today = () => ymd(new Date())
export const parse = (s: string) => parseISO(s)

/** dd/MM/yyyy a partir de 'yyyy-MM-dd' o ISO. */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return format(parseISO(s), 'dd/MM/yyyy')
}
export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  return format(parseISO(s), 'dd/MM/yyyy HH:mm')
}
export const fmtMonth = (d: Date) => format(d, "LLLL 'de' yyyy", { locale: es })
export const fmtShortMonth = (d: Date) => format(d, 'MMM yy', { locale: es })
export const fmtDayShort = (d: Date) => format(d, 'EEE d', { locale: es })

export const nightsBetween = (checkIn: string, checkOut: string) =>
  Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)))

export { addDays, startOfMonth, endOfMonth, differenceInCalendarDays }

/** Rango [inicio, fin) de un mes como strings yyyy-MM-dd. */
export function monthRange(d: Date) {
  const start = startOfMonth(d)
  const endExclusive = addDays(endOfMonth(d), 1)
  return { start: ymd(start), end: ymd(endExclusive), days: differenceInCalendarDays(endExclusive, start) }
}

/** Noches de una estancia [checkIn, checkOut) que caen dentro de [start, end). */
export function overlapNights(checkIn: string, checkOut: string, start: string, end: string): number {
  const a = checkIn > start ? checkIn : start
  const b = checkOut < end ? checkOut : end
  return Math.max(0, differenceInCalendarDays(parseISO(b), parseISO(a)))
}
