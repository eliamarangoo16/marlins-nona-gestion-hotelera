const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const num = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 })

export const money = (n: number | null | undefined) => mxn.format(Number(n ?? 0))
export const number = (n: number | null | undefined) => num.format(Number(n ?? 0))
export const percent = (n: number) => `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`

/** Convierte un campo de formulario a número (acepta vacío). */
export function toNum(v: string | number | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback
  const n = typeof v === 'number' ? v : parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export const emptyToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

export function errorMessage(e: unknown): string {
  if (!e) return 'Error desconocido'
  if (typeof e === 'string') return e
  if (typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Error desconocido'
}

/** Genera una contraseña temporal legible. */
export function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length]
  return `${out}#7`
}

export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
