-- =====================================================================
-- Migración 4: notificaciones a administradores + envío push
-- Cada evento importante inserta filas en public.notifications.
-- Cada fila nueva dispara (pg_net) la Edge Function `send-push`,
-- que entrega la notificación a los celulares suscritos.
-- =====================================================================

-- ---------- Destinatarios ----------
-- Todos los administradores relevantes para un edificio:
-- developer + admin_universal + admin_edificio asignado. Excluye a quien hizo el cambio.
create or replace function private.notify_admins(
  p_building uuid, p_type text, p_title text, p_body text, p_link text
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (user_id, building_id, type, title, body, link)
  select p.id, p_building, p_type, p_title, p_body, p_link
  from public.profiles p
  where p.active
    and p.id is distinct from (select auth.uid())
    and (
      p.role in ('developer','admin_universal')
      or (p.role = 'admin_edificio' and exists (
            select 1 from public.building_assignments a
            where a.user_id = p.id and a.building_id = p_building))
    );
end $$;

create or replace function private.notify_user(
  p_user uuid, p_building uuid, p_type text, p_title text, p_body text, p_link text
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_user is null or p_user = (select auth.uid()) then
    return;
  end if;
  insert into public.notifications (user_id, building_id, type, title, body, link)
  select p.id, p_building, p_type, p_title, p_body, p_link
  from public.profiles p where p.id = p_user and p.active;
end $$;

create or replace function private.unit_label(p_unit uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select b.name || ' · ' || u.name
  from public.units u join public.buildings b on b.id = u.building_id
  where u.id = p_unit
$$;

-- ---------- Reservas ----------
create or replace function private.on_reservation_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare lbl text := private.unit_label(new.unit_id);
        fechas text := to_char(new.check_in, 'DD/MM') || ' → ' || to_char(new.check_out, 'DD/MM/YYYY');
begin
  if tg_op = 'INSERT' then
    perform private.notify_admins(new.building_id, 'reserva_nueva',
      'Nueva reserva · ' || lbl,
      fechas || ' · ' || new.channel::text || ' · $' || to_char(new.total_amount, 'FM999,999,990.00'),
      '/reservas/' || new.id);
  elsif new.status = 'cancelada' and old.status <> 'cancelada' then
    perform private.notify_admins(new.building_id, 'reserva_cancelada',
      'Reserva cancelada · ' || lbl, fechas, '/reservas/' || new.id);
  elsif new.check_in <> old.check_in or new.check_out <> old.check_out or new.unit_id <> old.unit_id then
    perform private.notify_admins(new.building_id, 'reserva_modificada',
      'Reserva modificada · ' || lbl, 'Nuevas fechas: ' || fechas, '/reservas/' || new.id);
  end if;
  return new;
end $$;

create trigger reservations_notify after insert or update on public.reservations
  for each row execute function private.on_reservation_change();

-- ---------- Mantenimiento ----------
create or replace function private.on_ticket_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare lbl text;
begin
  lbl := coalesce(private.unit_label(new.unit_id),
                  (select b.name from public.buildings b where b.id = new.building_id));
  if tg_op = 'INSERT' then
    perform private.notify_admins(new.building_id, 'mantenimiento_nuevo',
      case when new.priority = 'urgente' then '🚨 URGENTE · ' else 'Mantenimiento · ' end || lbl,
      new.title || ' (prioridad ' || new.priority::text || ')',
      '/mantenimiento/' || new.id);
    perform private.notify_user(new.assigned_to, new.building_id, 'mantenimiento_asignado',
      'Te asignaron un ticket · ' || lbl, new.title, '/mantenimiento/' || new.id);
  else
    if new.status <> old.status then
      perform private.notify_admins(new.building_id, 'mantenimiento_estado',
        'Ticket ' || new.status::text || ' · ' || lbl, new.title, '/mantenimiento/' || new.id);
    end if;
    if new.priority = 'urgente' and old.priority <> 'urgente' then
      perform private.notify_admins(new.building_id, 'mantenimiento_urgente',
        '🚨 Ticket escalado a URGENTE · ' || lbl, new.title, '/mantenimiento/' || new.id);
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      perform private.notify_user(new.assigned_to, new.building_id, 'mantenimiento_asignado',
        'Te asignaron un ticket · ' || lbl, new.title, '/mantenimiento/' || new.id);
    end if;
  end if;
  return new;
end $$;

create trigger maintenance_notify after insert or update on public.maintenance_tickets
  for each row execute function private.on_ticket_change();

-- ---------- Limpieza ----------
create or replace function private.on_cleaning_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare lbl text := private.unit_label(new.unit_id);
begin
  if tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to then
    perform private.notify_user(new.assigned_to, new.building_id, 'limpieza_asignada',
      'Limpieza asignada · ' || lbl, 'Fecha: ' || to_char(new.scheduled_date, 'DD/MM/YYYY'), '/limpieza');
  end if;
  if tg_op = 'UPDATE' and new.status = 'terminada' and old.status <> 'terminada' then
    perform private.notify_admins(new.building_id, 'limpieza_terminada',
      '✅ Limpieza terminada · ' || lbl, 'Departamento listo', '/limpieza');
  end if;
  return new;
end $$;

create trigger cleaning_notify after insert or update on public.cleaning_tasks
  for each row execute function private.on_cleaning_change();

-- ---------- Inventario ----------
create or replace function private.on_supply_request_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare bname text := (select b.name from public.buildings b where b.id = new.building_id);
begin
  if tg_op = 'INSERT' then
    perform private.notify_admins(new.building_id, 'insumo_solicitado',
      case when new.urgency in ('alta','urgente') then '📦 Insumo URGENTE · ' else '📦 Insumo solicitado · ' end || bname,
      new.item_name || ' × ' || trim(to_char(new.quantity, 'FM999990.##')) || coalesce(' ' || new.unit_of_measure, ''),
      '/inventario');
  elsif new.status <> old.status then
    perform private.notify_user(new.requested_by, new.building_id, 'insumo_estado',
      'Tu solicitud de ' || new.item_name || ' fue ' || new.status::text, bname, '/inventario');
  end if;
  return new;
end $$;

create trigger supply_requests_notify after insert or update on public.supply_requests
  for each row execute function private.on_supply_request_change();

create or replace function private.on_stock_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.current_stock <= new.min_stock and old.current_stock > old.min_stock then
    perform private.notify_admins(new.building_id, 'stock_bajo',
      '⚠️ Stock bajo · ' || new.name,
      'Quedan ' || trim(to_char(new.current_stock, 'FM999990.##')) || ' ' || new.unit_of_measure
        || ' (mínimo ' || trim(to_char(new.min_stock, 'FM999990.##')) || ')',
      '/inventario');
  end if;
  return new;
end $$;

create trigger inventory_stock_notify after update of current_stock, min_stock on public.inventory_items
  for each row execute function private.on_stock_change();

-- ---------- Envío push ----------
create or replace function private.dispatch_push()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://fjnkjlrbxunaflwdjlvp.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
  return new;
end $$;

create trigger notifications_push after insert on public.notifications
  for each row execute function private.dispatch_push();

-- Llaves VAPID (las guarda Vault); solo service_role puede leerlas
create or replace function public.get_vapid_keys()
returns table (public_key text, private_key text, subject text)
language sql stable security definer set search_path = ''
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_subject')
$$;
revoke execute on function public.get_vapid_keys() from public, anon, authenticated;
grant execute on function public.get_vapid_keys() to service_role;

-- Realtime para la campanita in-app
alter publication supabase_realtime add table public.notifications;
