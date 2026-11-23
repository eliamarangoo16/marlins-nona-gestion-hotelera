import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '@/lib/format'

/** Carga de datos sencilla con loading/error/recarga. `fn` se re-ejecuta cuando cambian `deps`. */
export function useQuery<T>(fn: () => PromiseLike<T>, deps: unknown[], enabled = true) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const reqId = useRef(0)

  const run = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    try {
      const res = await fnRef.current()
      if (id === reqId.current) setData(res)
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled])

  return { data, loading, error, reload: run, setData }
}

/** Desenvuelve la respuesta { data, error } de supabase-js lanzando el error. */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return (res.data ?? ([] as unknown)) as T
}
