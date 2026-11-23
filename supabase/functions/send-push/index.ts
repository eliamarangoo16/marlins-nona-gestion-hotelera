// Edge Function: send-push (verify_jwt = false)
// Recibe { notification_id } desde la base (pg_net) y envía Web Push a los
// dispositivos suscritos del usuario destinatario.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let notificationId: string | undefined
  try {
    const body = await req.json()
    notificationId = body?.notification_id
  } catch {
    return json({ error: 'Cuerpo JSON inválido' }, 400)
  }
  if (!notificationId || typeof notificationId !== 'string') {
    return json({ error: 'Falta notification_id' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Reclamar la notificación de forma atómica: solo una llamada la envía
  const { data: notification, error: nErr } = await supabase
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('pushed_at', null)
    .select('*')
    .maybeSingle()
  if (nErr) return json({ error: nErr.message }, 500)
  if (!notification) {
    return json({ skipped: true, reason: 'not_found_or_already_pushed' })
  }

  // Si algo falla antes de enviar, liberar la notificación para reintentar
  const release = () =>
    supabase.from('notifications').update({ pushed_at: null }).eq('id', notification.id)

  const { data: keys, error: kErr } = await supabase.rpc('get_vapid_keys')
  const vapid = Array.isArray(keys) ? keys[0] : keys
  if (kErr || !vapid) {
    await release()
    return json({ error: kErr?.message ?? 'Sin llaves VAPID' }, 500)
  }

  webpush.setVapidDetails(vapid.subject, vapid.public_key, vapid.private_key)

  const { data: subs, error: sErr } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notification.user_id)
  if (sErr) {
    await release()
    return json({ error: sErr.message }, 500)
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body ?? '',
    url: notification.link ?? '/',
    tag: notification.id,
  })

  let sent = 0
  let removed = 0
  let failed = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24 },
        )
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id)
          removed++
        } else {
          failed++
          console.error('push error', status, (e as Error).message)
        }
      }
    }),
  )

  return json({ ok: true, sent, removed, failed, subscriptions: subs?.length ?? 0 })
})
