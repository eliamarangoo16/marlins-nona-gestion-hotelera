import { useMemo, useState } from 'react'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { addMonths, format, startOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useBuildings } from '@/context/BuildingContext'
import { useToast } from '@/context/ToastContext'
import { useQuery, unwrap } from '@/hooks/useQuery'
import { Alert, Badge, Button, Card, CardHeader, ConfirmModal, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Select, Stat, Table, THead, Th, Td, Tr, Textarea } from '@/components/ui'
import { EXPENSE_CATEGORIES, categoryLabel } from '@/lib/labels'
import { downloadCsv, emptyToNull, errorMessage, money, toNum } from '@/lib/format'
import { fmtDate, fmtMonth, today, ymd } from '@/lib/dates'
import { sumProrated } from '@/lib/metrics'
import { useBuildingOptions } from '@/hooks/useOptions'
import type { ExpenseFull, Reservation } from '@/types/models'
import { es } from 'date-fns/locale'

type Tab = 'gastos' | 'resultados'

export default function Finance() {
  const [tab, setTab] = useState<Tab>('gastos')
  const tabBtn = (t: Tab, l: string) => (
    <button onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium ${tab === t ? 'border-b-2 border-sand text-brand' : 'text-slate-500'}`}>{l}</button>
  )
  return (
    <>
      <PageHeader title="Finanzas" />
      <div className="mb-4 flex border-b border-slate-200">{tabBtn('gastos', 'Gastos')}{tabBtn('resultados', 'Estado de resultados')}</div>
      {tab === 'gastos' ? <Expenses /> : <Results />}
    </>
  )
}

function Expenses() {
  const { scopeIds, buildings, buildingName } = useBuildings()
  const toast = useToast()
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [cat, setCat] = useState('')
  const [edit, setEdit] = useState<ExpenseFull | null>(null)
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState<ExpenseFull | null>(null)

  const start = `${month}-01`
  const end = ymd(addMonths(new Date(`${month}-01T12:00:00`), 1)).slice(0, 8) + '01'
  const { data, loading, error, reload } = useQuery(async () => {
    if (!scopeIds.length) return [] as ExpenseFull[]
    let q = supabase.from('expenses').select('*, buildings(name), units(name)').in('building_id', scopeIds).gte('expense_date', start).lt('expense_date', end).order('expense_date', { ascending: false })
    if (cat) q = q.eq('category', cat)
    return unwrap(await q) as unknown as ExpenseFull[]
  }, [scopeIds.join(','), month, cat])

  const rows = data ?? []
  const total = rows.reduce((s, e) => s + Number(e.amount), 0)

  async function remove() {
    if (!del) return
    const { error: e } = await supabase.from('expenses').delete().eq('id', del.id)
    if (e) return toast.error(errorMessage(e))
    toast.success('Gasto eliminado')
    setDel(null)
    void reload()
  }

  return (
    <>
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <Input label="Mes" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <Select label="Categoría" placeholder="Todas" options={EXPENSE_CATEGORIES} value={cat} onChange={(e) => setCat(e.target.value)} />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!rows.length} onClick={() => downloadCsv(`gastos-${month}.csv`, [['Fecha', 'Edificio', 'Departamento', 'Categoría', 'Descripción', 'Monto'], ...rows.map((e) => [e.expense_date, e.buildings?.name ?? '', e.units?.name ?? '', categoryLabel(EXPENSE_CATEGORIES, e.category), e.description ?? '', Number(e.amount)])])}>CSV</Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEdit(null); setOpen(true) }}>Nuevo gasto</Button>
        </div>
      </Card>
      {error && <ErrorBox message={error} onRetry={() => void reload()} />}
      {loading && !data ? <PageLoader /> : rows.length === 0 ? <Card><EmptyState title="Sin gastos" description="No hay gastos registrados en este periodo." /></Card> : (
        <Card>
          <CardHeader title={`${rows.length} gasto${rows.length > 1 ? 's' : ''}`} action={<span className="text-sm font-semibold text-brand">{money(total)}</span>} />
          <Table>
            <THead><Th>Fecha</Th>{buildings.length > 1 && <Th>Edificio</Th>}<Th>Categoría</Th><Th>Descripción</Th><Th className="text-right">Monto</Th><Th /></THead>
            <tbody>
              {rows.map((e) => (
                <Tr key={e.id}>
                  <Td>{fmtDate(e.expense_date)}</Td>
                  {buildings.length > 1 && <Td>{buildingName(e.building_id)}</Td>}
                  <Td><Badge tone="sand">{categoryLabel(EXPENSE_CATEGORIES, e.category)}</Badge></Td>
                  <Td className="max-w-xs truncate">{e.description ?? '—'}{e.units?.name && <span className="text-xs text-slate-400"> · {e.units.name}</span>}</Td>
                  <Td className="text-right font-medium">{money(e.amount)}</Td>
                  <Td><div className="flex justify-end gap-1">
                    <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Editar" onClick={() => { setEdit(e); setOpen(true) }}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Eliminar" onClick={() => setDel(e)}><Trash2 className="h-4 w-4" /></button>
                  </div></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <ExpenseForm open={open} expense={edit} onClose={() => setOpen(false)} onSaved={() => void reload()} />
      <ConfirmModal open={!!del} title="Eliminar gasto" message="¿Eliminar este gasto?" confirmLabel="Eliminar" danger onConfirm={() => void remove()} onClose={() => setDel(null)} />
    </>
  )
}

function ExpenseForm({ open, expense, onClose, onSaved }: { open: boolean; expense: ExpenseFull | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const { units, selected, buildings } = useBuildings()
  const buildingOptions = useBuildingOptions()
  const [f, setF] = useState({ building_id: '', unit_id: '', category: 'mantenimiento', description: '', amount: '', expense_date: today() })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  const key = open ? (expense?.id ?? 'new') : null
  if (key !== last) {
    setLast(key)
    if (key) {
      setF({ building_id: expense?.building_id ?? (selected !== 'all' ? selected : buildings[0]?.id ?? ''), unit_id: expense?.unit_id ?? '', category: expense?.category ?? 'mantenimiento', description: expense?.description ?? '', amount: expense ? String(expense.amount) : '', expense_date: expense?.expense_date ?? today() })
      setError(null)
    }
  }
  async function save() {
    if (!f.building_id) return setError('Elige un edificio.')
    if (!(toNum(f.amount) >= 0) || f.amount === '') return setError('Indica el monto.')
    setSaving(true)
    const payload = { building_id: f.building_id, unit_id: f.unit_id || null, category: f.category, description: emptyToNull(f.description), amount: toNum(f.amount), expense_date: f.expense_date }
    const res = expense ? await supabase.from('expenses').update(payload).eq('id', expense.id) : await supabase.from('expenses').insert(payload)
    setSaving(false)
    if (res.error) return setError(errorMessage(res.error))
    toast.success('Gasto guardado')
    onSaved()
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={expense ? 'Editar gasto' : 'Nuevo gasto'} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Guardar</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {buildingOptions.length > 1 && <Select label="Edificio" options={buildingOptions} value={f.building_id} onChange={(e) => setF({ ...f, building_id: e.target.value, unit_id: '' })} />}
        <Select label="Departamento (opcional)" placeholder="General del edificio" options={units.filter((u) => u.building_id === f.building_id).map((u) => ({ value: u.id, label: u.name }))} value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Categoría" options={EXPENSE_CATEGORIES} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <Input label="Fecha" type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} />
        </div>
        <Input label="Monto (MXN)" type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Textarea label="Descripción" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
    </Modal>
  )
}

type MonthRow = { label: string; gross: number; deductions: number; net: number; expenses: number; profit: number }

function Results() {
  const { scopeIds, buildings } = useBuildings()
  const [year, setYear] = useState(new Date().getFullYear())
  const yStart = `${year}-01-01`
  const yEnd = `${year + 1}-01-01`

  const { data, loading, error, reload } = useQuery(async () => {
    if (!scopeIds.length) return { res: [] as Reservation[], exp: [] as { building_id: string; amount: number; expense_date: string }[] }
    const [r, e] = await Promise.all([
      supabase.from('reservations').select('*').in('building_id', scopeIds).neq('status', 'cancelada').lt('check_in', yEnd).gt('check_out', yStart),
      supabase.from('expenses').select('building_id, amount, expense_date').in('building_id', scopeIds).gte('expense_date', yStart).lt('expense_date', yEnd),
    ])
    return { res: unwrap(r) as Reservation[], exp: unwrap(e) as { building_id: string; amount: number; expense_date: string }[] }
  }, [scopeIds.join(','), year])

  const { months, byBuilding } = useMemo(() => {
    const res = data?.res ?? []
    const exp = data?.exp ?? []
    const calc = (rs: Reservation[], ex: typeof exp, s: string, e: string): Omit<MonthRow, 'label'> => {
      const p = sumProrated(rs, s, e)
      const expenses = ex.filter((x) => x.expense_date >= s && x.expense_date < e).reduce((a, x) => a + Number(x.amount), 0)
      return { gross: p.gross, deductions: p.commission + p.taxes, net: p.net, expenses, profit: p.net - expenses }
    }
    const months: MonthRow[] = Array.from({ length: 12 }, (_, i) => {
      const s = ymd(new Date(year, i, 1))
      const e = ymd(new Date(year, i + 1, 1))
      return { label: format(startOfMonth(new Date(year, i, 1)), 'LLLL', { locale: es }), ...calc(res, exp, s, e) }
    })
    const byBuilding = buildings.filter((b) => scopeIds.includes(b.id)).map((b) => ({ name: b.name, ...calc(res.filter((r) => r.building_id === b.id), exp.filter((x) => x.building_id === b.id), yStart, yEnd) }))
    return { months, byBuilding }
  }, [data, year, buildings, scopeIds, yStart, yEnd])

  const total = months.reduce((a, m) => ({ gross: a.gross + m.gross, deductions: a.deductions + m.deductions, net: a.net + m.net, expenses: a.expenses + m.expenses, profit: a.profit + m.profit }), { gross: 0, deductions: 0, net: 0, expenses: 0, profit: 0 })

  function exportCsv() {
    const head = ['Periodo', 'Ingresos brutos', 'Comisiones e impuestos', 'Ingreso neto', 'Gastos', 'Utilidad']
    const rows = [...months.map((m) => [m.label, m.gross, m.deductions, m.net, m.expenses, m.profit]), ['TOTAL', total.gross, total.deductions, total.net, total.expenses, total.profit], [], ['Por edificio'], ...byBuilding.map((b) => [b.name, b.gross, b.deductions, b.net, b.expenses, b.profit])]
    downloadCsv(`estado-resultados-${year}.csv`, [head, ...rows.map((r) => r.map((x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x)))])
  }

  const cols = (r: { gross: number; deductions: number; net: number; expenses: number; profit: number }, bold = false) => (
    <>
      <Td className="text-right">{money(r.gross)}</Td>
      <Td className="text-right text-slate-500">− {money(r.deductions)}</Td>
      <Td className="text-right">{money(r.net)}</Td>
      <Td className="text-right text-slate-500">− {money(r.expenses)}</Td>
      <Td className={`text-right ${bold ? 'font-bold' : 'font-medium'} ${r.profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(r.profit)}</Td>
    </>
  )
  const head = <><Th className="text-right">Ingresos brutos</Th><Th className="text-right">Comisiones + imp.</Th><Th className="text-right">Ingreso neto</Th><Th className="text-right">Gastos</Th><Th className="text-right">Utilidad</Th></>

  return (
    <>
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <Select label="Año" options={Array.from({ length: 6 }, (_, i) => { const y = new Date().getFullYear() - 4 + i; return { value: String(y), label: String(y) } })} value={String(year)} onChange={(e) => setYear(Number(e.target.value))} />
        <Button className="ml-auto" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Exportar CSV</Button>
      </Card>
      <Alert tone="info">Ingresos netos = total de reservas (sin canceladas) − comisión de plataforma − impuestos, prorrateados por noche cuando la estancia cruza meses. La utilidad resta los gastos registrados.</Alert>
      {error && <div className="mt-3"><ErrorBox message={error} onRetry={() => void reload()} /></div>}
      {loading && !data ? <PageLoader /> : (
        <>
          <div className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`Ingreso bruto ${year}`} value={money(total.gross)} />
            <Stat label="Ingreso neto" value={money(total.net)} />
            <Stat label="Gastos" value={money(total.expenses)} />
            <Stat label="Utilidad" value={money(total.profit)} tone={total.profit < 0 ? 'bad' : 'good'} />
          </div>
          <Card className="mb-4">
            <CardHeader title="Por mes" />
            <Table>
              <THead><Th>Mes</Th>{head}</THead>
              <tbody>
                {months.map((m) => <Tr key={m.label}><Td className="capitalize">{m.label}</Td>{cols(m)}</Tr>)}
                <Tr><Td className="font-bold">Total</Td>{cols(total, true)}</Tr>
              </tbody>
            </Table>
          </Card>
          <Card>
            <CardHeader title={`Por edificio · ${fmtMonth(new Date(year, 0, 1)).replace(/^.* de /, '')}`} />
            {byBuilding.length === 0 ? <EmptyState title="Sin edificios" /> : (
              <Table>
                <THead><Th>Edificio</Th>{head}</THead>
                <tbody>{byBuilding.map((b) => <Tr key={b.name}><Td className="font-medium text-brand">{b.name}</Td>{cols(b)}</Tr>)}</tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </>
  )
}
