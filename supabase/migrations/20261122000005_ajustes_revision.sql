-- =====================================================================
-- Migración 5: ajustes tras la revisión de código
-- =====================================================================

-- 1) Rol developer solo cuando el correo esté confirmado
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when new.email_confirmed_at is not null
          and exists (select 1 from private.bootstrap_developers b where lower(b.email) = lower(new.email))
         then 'developer'::public.app_role else 'sin_asignar'::public.app_role end
  );
  return new;
end $$;

create or replace function private.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null
     and exists (select 1 from private.bootstrap_developers b where lower(b.email) = lower(new.email)) then
    update public.profiles set role = 'developer'
     where id = new.id and role = 'sin_asignar';
  end if;
  return new;
end $$;

create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function private.handle_user_confirmed();

-- 2) Nadie se desactiva a sí mismo; admin_universal no toca a otro admin_universal
create or replace function private.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare caller_role public.app_role;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.email is distinct from old.email or new.id is distinct from old.id then
    raise exception 'No se puede cambiar el correo ni el id desde aquí';
  end if;

  if new.role is distinct from old.role or new.active is distinct from old.active then
    caller_role := private.my_role();
    if caller_role is null or caller_role not in ('developer','admin_universal') then
      raise exception 'Solo un administrador universal o developer puede cambiar roles';
    end if;
    if old.id = (select auth.uid()) then
      raise exception 'No puedes cambiar tu propio rol ni desactivarte';
    end if;
    if caller_role = 'admin_universal'
       and (new.role in ('developer','admin_universal') or old.role in ('developer','admin_universal')) then
      raise exception 'Solo un developer puede asignar o modificar administradores universales y developers';
    end if;
  end if;
  return new;
end $$;

-- 3) Registro de dispositivo push: si el endpoint ya existía (otro usuario en el
--    mismo navegador), se reasigna al usuario actual.
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'No autenticado';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now();
end $$;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- 4) Bloqueos de calendario no pueden traslaparse entre sí
alter table public.calendar_blocks
  add constraint calendar_blocks_no_overlap exclude using gist (
    unit_id with =,
    daterange(start_date, end_date, '[)') with &&
  );

-- 5) Integridad entre edificios
create or replace function private.check_same_building()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'cleaning_tasks' and new.reservation_id is not null then
    if not exists (select 1 from public.reservations r where r.id = new.reservation_id and r.unit_id = new.unit_id) then
      raise exception 'La reserva no corresponde a ese departamento';
    end if;
  elsif tg_table_name = 'supply_requests' and new.item_id is not null then
    if not exists (select 1 from public.inventory_items i where i.id = new.item_id and i.building_id = new.building_id) then
      raise exception 'El artículo no pertenece a ese edificio';
    end if;
  elsif tg_table_name = 'expenses' and new.unit_id is not null then
    if not exists (select 1 from public.units u where u.id = new.unit_id and u.building_id = new.building_id) then
      raise exception 'El departamento no pertenece a ese edificio';
    end if;
  end if;
  return new;
end $$;

create trigger cleaning_tasks_same_building before insert or update on public.cleaning_tasks
  for each row execute function private.check_same_building();
create trigger supply_requests_same_building before insert or update on public.supply_requests
  for each row execute function private.check_same_building();
create trigger expenses_same_building before insert or update on public.expenses
  for each row execute function private.check_same_building();
