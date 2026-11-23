import type { ReactNode } from 'react'

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-full text-left text-sm">{children}</table>
    </div>
  )
}
export const THead = ({ children }: { children: ReactNode }) => (
  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
    <tr>{children}</tr>
  </thead>
)
export const Th = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <th className={`whitespace-nowrap px-3 py-2 font-medium ${className}`}>{children}</th>
)
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>
)
export const Tr = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <tr onClick={onClick} className={`border-b border-slate-100 last:border-0 ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
    {children}
  </tr>
)
