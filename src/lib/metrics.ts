import { overlapNights, nightsBetween } from './dates'
import type { Reservation } from '@/types/models'

type ResLike = Pick<Reservation, 'check_in' | 'check_out' | 'total_amount' | 'cleaning_fee' | 'platform_fee' | 'taxes' | 'net_amount' | 'status'>

export type Prorated = {
  nights: number
  gross: number
  lodging: number
  commission: number
  taxes: number
  net: number
}

/** Prorratea una reserva al rango [start, end). Excluye canceladas. */
export function prorate(r: ResLike, start: string, end: string): Prorated {
  const zero = { nights: 0, gross: 0, lodging: 0, commission: 0, taxes: 0, net: 0 }
  if (r.status === 'cancelada') return zero
  const total = nightsBetween(r.check_in, r.check_out)
  if (total <= 0) return zero
  const n = overlapNights(r.check_in, r.check_out, start, end)
  if (n === 0) return zero
  const f = n / total
  const net = r.net_amount ?? r.total_amount - r.platform_fee - r.taxes
  return {
    nights: n,
    gross: r.total_amount * f,
    lodging: (r.total_amount - r.cleaning_fee) * f,
    commission: r.platform_fee * f,
    taxes: r.taxes * f,
    net: net * f,
  }
}

export function sumProrated(list: ResLike[], start: string, end: string): Prorated {
  return list.reduce<Prorated>(
    (acc, r) => {
      const p = prorate(r, start, end)
      return {
        nights: acc.nights + p.nights,
        gross: acc.gross + p.gross,
        lodging: acc.lodging + p.lodging,
        commission: acc.commission + p.commission,
        taxes: acc.taxes + p.taxes,
        net: acc.net + p.net,
      }
    },
    { nights: 0, gross: 0, lodging: 0, commission: 0, taxes: 0, net: 0 },
  )
}
