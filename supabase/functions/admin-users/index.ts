// Edge Function: admin-users (verify_jwt = true)
// Gestión de usuarios para developer y admin_universal.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLES = ['developer', 'admin_universal', 'admin_edificio', 'mantenimiento', 'limpieza', 'sin_asignar'] as const
type Role = (typeof ROLES)[number]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
const fail = (error: string, status = 400) => json({ error }, status)

function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}
function validBuildingIds(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && UUID_RE.test(x))
}
function optStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Método no permitido', 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return fail('No autenticado', 401)

  // 1) Quién llama
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return fail('Sesión inválida', 401)
  const callerId = userData.user.id

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: caller } = await admin.from('profiles').select('id, role, active').eq('id', callerId).maybeSingle()
  if (!caller || !caller.active || !['developer', 'admin_universal'].includes(caller.role)) {
    return fail('No tienes permiso para administrar usuarios', 403)
  }
  const callerIsDev = caller.role === 'developer'

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('Cuerpo JSON inválido')
  }
  const action = body.action

  async function replaceAssignments(userId: string, buildingIds: string[]) {
    const { error: delErr } = await admin.from('building_assignments').delete().eq('user_id', userId)
    if (delErr) throw new Error(delErr.message)
    const unique = [...new Set(buildingIds)]
    if (unique.length) {
      const { error: insErr } = await admin
        .from('building_assignments')
        .insert(unique.map((building_id) => ({ user_id: userId, building_id })))
      if (insErr) throw new Error(insErr.message)
    }
  }

  try {
    // ---------------- create ----------------
    if (action === 'create') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const fullName = optStr(body.full_name)
      const phone = optStr(body.phone)
      const role = body.role
      const buildingIds = body.building_ids ?? []

      if (!EMAIL_RE.test(email)) return fail('Correo electrónico inválido')
      if (password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres')
      if (!fullName) return fail('El nombre es obligatorio')
      if (!isRole(role)) return fail('Rol inválido')
      if ((role === 'developer' || role === 'admin_universal') && !callerIsDev) {
        return fail('Solo un developer puede crear developers o administradores universales', 403)
      }
      if (!validBuildingIds(buildingIds)) return fail('Lista de edificios inválida')

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (cErr || !created?.user) {
        const msg = cErr?.message ?? 'No se pudo crear el usuario'
        if (/already|registered|exists/i.test(msg)) return fail('Ya existe un usuario con ese correo')
        return fail(msg)
      }
      const newId = created.user.id

      const { error: pErr } = await admin
        .from('profiles')
        .update({ full_name: fullName, phone, role })
        .eq('id', newId)
      if (pErr) return fail(`Usuario creado pero no se pudo asignar el rol: ${pErr.message}`, 500)

      await replaceAssignments(newId, buildingIds)
      return json({ ok: true, user_id: newId })
    }

    // ---------------- update ----------------
    if (action === 'update') {
      const userId = body.user_id
      if (typeof userId !== 'string' || !UUID_RE.test(userId)) return fail('user_id inválido')

      const { data: target } = await admin.from('profiles').select('id, role, active').eq('id', userId).maybeSingle()
      if (!target) return fail('Usuario no encontrado', 404)
      const targetIsPrivileged = target.role === 'developer' || target.role === 'admin_universal'
      if (targetIsPrivileged && !callerIsDev && userId !== callerId) {
        return fail('Solo un developer puede modificar a developers o administradores universales', 403)
      }

      const patch: Record<string, unknown> = {}
      if (body.role !== undefined) {
        if (!isRole(body.role)) return fail('Rol inválido')
        if (body.role !== target.role && (body.role === 'developer' || body.role === 'admin_universal') && !callerIsDev) {
          return fail('Solo un developer puede asignar ese rol', 403)
        }
        if (userId === callerId && body.role !== target.role) return fail('No puedes cambiar tu propio rol', 403)
        patch.role = body.role
      }
      if (body.active !== undefined) {
        if (typeof body.active !== 'boolean') return fail('Valor de activo inválido')
        if (userId === callerId && body.active === false) return fail('No puedes desactivarte a ti mismo', 403)
        patch.active = body.active
      }
      if (body.full_name !== undefined) {
        const n = optStr(body.full_name)
        if (!n) return fail('El nombre no puede quedar vacío')
        patch.full_name = n
      }
      if (body.phone !== undefined) patch.phone = optStr(body.phone)

      if (body.building_ids !== undefined && !validBuildingIds(body.building_ids)) {
        return fail('Lista de edificios inválida')
      }

      if (Object.keys(patch).length) {
        const { error } = await admin.from('profiles').update(patch).eq('id', userId)
        if (error) return fail(error.message, 500)
      }
      if (body.building_ids !== undefined) {
        await replaceAssignments(userId, body.building_ids as string[])
      }
      return json({ ok: true })
    }

    // ---------------- reset_password ----------------
    if (action === 'reset_password') {
      const userId = body.user_id
      const password = typeof body.password === 'string' ? body.password : ''
      if (typeof userId !== 'string' || !UUID_RE.test(userId)) return fail('user_id inválido')
      if (password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres')

      const { data: target } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle()
      if (!target) return fail('Usuario no encontrado', 404)
      if ((target.role === 'developer' || target.role === 'admin_universal') && !callerIsDev && userId !== callerId) {
        return fail('Solo un developer puede restablecer la contraseña de developers o administradores universales', 403)
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) return fail(error.message)
      return json({ ok: true })
    }

    return fail('Acción no reconocida')
  } catch (e) {
    console.error(e)
    return fail((e as Error).message || 'Error interno', 500)
  }
})
