import type { ReactNode } from 'react'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-brand px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="text-2xl font-semibold tracking-wide text-white">Marlins &amp; Nona Apartments</h1>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-brand">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
