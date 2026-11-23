import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const base =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-100 disabled:text-slate-500'

export function Field({ label, hint, error, children, className = '' }: { label?: string; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string | null; wrapperClassName?: string }
export function Input({ label, hint, error, wrapperClassName, className = '', ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      <input {...rest} className={`${base} ${className}`} />
    </Field>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string; error?: string | null; wrapperClassName?: string }
export function Textarea({ label, hint, error, wrapperClassName, className = '', rows = 3, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      <textarea rows={rows} {...rest} className={`${base} ${className}`} />
    </Field>
  )
}

export type Option = { value: string; label: string }
type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label?: string
  hint?: string
  error?: string | null
  options: Option[]
  placeholder?: string
  wrapperClassName?: string
}
export function Select({ label, hint, error, options, placeholder, wrapperClassName, className = '', ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      <select {...rest} className={`${base} ${className}`}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}
