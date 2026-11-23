-- =====================================================================
-- Migración 2: funciones de permisos y triggers de negocio
-- =====================================================================

grant usage on schema private to authenticated, service_role;

-- ---------- Helpers de permisos ----------
create or replace function private.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.active
$$;

create or replace function private.is_global_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.my_role() in ('developer','admin_universal'), false)
$$;

create or replace function private.is_developer()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.my_role() = 'developer', false)
$$;

-- ¿El usuario puede VER este edificio? (cualquier rol asignado o admin global)
create or replace function private.has_building_access(p_building uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_global_admin()
    or exists (
      select 1 from public.building_assignments a
      join public.profiles p on p.id = a.user_id
      where a.user_id = (select auth.uid())
        and a.building_id = p_building
        and p.active
        and p.role <> 'sin_asignar'
    )
$$;

-- ¿El usuario puede ADMINISTRAR este edificio?
create or replace function private.can_manage_building(p_building uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_global_admin()
    or (
      private.my_role() = 'admin_edificio'
      and exists (
        select 1 from public.building_assignments a
        where a.user_id = (select auth.uid()) and a.building_id = p_building
      )
    )
$$;

-- ¿Es administrador de al menos un edificio (o global)?
create or replace function private.is_any_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.my_role() in ('developer','admin_universal','admin_edificio'), false)
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- Funciones públicas útiles para el frontend
create or replace function public.my_role()
returns public.app_role
language sql stable security invoker set search_path = ''
as $$ select private.my_role() $$;

-- ---------- updated_at ----------
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','buildings','units','guests','reservations',
    'maintenance_tickets','cleaning_tasks','inventory_items','supply_requests']
  loop
    execute format('create trigger %I_touch before update on public.%I
      for each row execute function private.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------- building_id derivado del departamento ----------
create or replace function private.set_building_from_unit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select u.building_id into new.building_id from public.units u where u.id = new.unit_id;
  if new.building_id is null then
    raise exception 'Departamento % no existe', new.unit_id;
  end if;
  return new;
end $$;

create trigger reservations_building before insert or update on public.reservations
  for each row execute function private.set_building_from_unit();
create trigger rates_building before insert or update on public.rates
  for each row execute function private.set_building_from_unit();
create trigger calendar_blocks_building before insert or update on public.calendar_blocks
  for each row execute function private.set_building_from_unit();
create trigger cleaning_tasks_building before insert or update on public.cleaning_tasks
  for each row execute function private.set_building_from_unit();

-- Tickets: si traen unit_id, el edificio se toma del departamento
create or replace function private.ticket_building_from_unit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.unit_id is not null then
    select u.building_id into new.building_id from public.units u where u.id = new.unit_id;
  end if;
  if new.status = 'resuelto' and (tg_op = 'INSERT' or old.status <> 'resuelto') then
    new.resolved_at := now();
  end if;
  return new;
end $$;
create trigger maintenance_building before insert or update on public.maintenance_tickets
  for each row execute function private.ticket_building_from_unit();

-- Movimientos de inventario: edificio del artículo + actualizar existencias
create or replace function private.inventory_movement_apply()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select i.building_id into new.building_id from public.inventory_items i where i.id = new.item_id;
  update public.inventory_items
     set current_stock = current_stock + new.quantity
   where id = new.item_id;
  return new;
end $$;
create trigger inventory_movements_apply before insert on public.inventory_movements
  for each row execute function private.inventory_movement_apply();

-- Limpieza terminada → marca fecha
create or replace function private.cleaning_completed_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'terminada' and (tg_op = 'INSERT' or old.status <> 'terminada') then
    new.completed_at := now();
  end if;
  return new;
end $$;
create trigger cleaning_tasks_completed before insert or update on public.cleaning_tasks
  for each row execute function private.cleaning_completed_at();

-- Solicitudes de insumo resueltas
create or replace function private.supply_resolved()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status <> old.status and new.status in ('aprobada','rechazada','comprada','entregada') then
    new.resolved_by := (select auth.uid());
    new.resolved_at := now();
  end if;
  return new;
end $$;
create trigger supply_requests_resolved before update on public.supply_requests
  for each row execute function private.supply_resolved();

-- ---------- Alta automática de perfil ----------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from private.bootstrap_developers b where lower(b.email) = lower(new.email))
         then 'developer'::public.app_role else 'sin_asignar'::public.app_role end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- Protección de roles ----------
create or replace function private.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare caller_role public.app_role;
begin
  -- Llamadas de servidor (service_role / SQL) no tienen auth.uid(): se permiten
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
    if caller_role = 'admin_universal' and (new.role = 'developer' or old.role = 'developer') then
      raise exception 'Solo un developer puede asignar o modificar el rol developer';
    end if;
    if old.id = (select auth.uid()) and new.role is distinct from old.role then
      raise exception 'No puedes cambiar tu propio rol';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function private.protect_profile_fields();
