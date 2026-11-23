-- =====================================================================
-- Migración 3: Row Level Security por rol
--   developer / admin_universal → todo
--   admin_edificio              → todo dentro de sus edificios
--   mantenimiento / limpieza    → ver su edificio, operar tickets/limpiezas,
--                                 registrar consumo y pedir insumos
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.buildings           enable row level security;
alter table public.building_assignments enable row level security;
alter table public.units               enable row level security;
alter table public.guests              enable row level security;
alter table public.reservations        enable row level security;
alter table public.rates               enable row level security;
alter table public.calendar_blocks     enable row level security;
alter table public.maintenance_tickets enable row level security;
alter table public.cleaning_tasks      enable row level security;
alter table public.inventory_items     enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.supply_requests     enable row level security;
alter table public.expenses            enable row level security;
alter table public.notifications       enable row level security;
alter table public.push_subscriptions  enable row level security;

-- ---------- profiles ----------
create policy "perfiles: ver propio o equipo" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.my_role() is distinct from 'sin_asignar' and private.my_role() is not null);
create policy "perfiles: editar propio o admin global" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.is_global_admin())
  with check (id = (select auth.uid()) or private.is_global_admin());
create policy "perfiles: borrar solo developer" on public.profiles for delete to authenticated
  using (private.is_developer() and id <> (select auth.uid()));

-- ---------- buildings ----------
create policy "edificios: ver asignados" on public.buildings for select to authenticated
  using (private.has_building_access(id));
create policy "edificios: crear admin global" on public.buildings for insert to authenticated
  with check (private.is_global_admin());
create policy "edificios: editar admin" on public.buildings for update to authenticated
  using (private.can_manage_building(id)) with check (private.can_manage_building(id));
create policy "edificios: borrar admin global" on public.buildings for delete to authenticated
  using (private.is_global_admin());

-- ---------- building_assignments ----------
create policy "asignaciones: ver" on public.building_assignments for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_building(building_id));
create policy "asignaciones: crear admin global" on public.building_assignments for insert to authenticated
  with check (private.is_global_admin());
create policy "asignaciones: borrar admin global" on public.building_assignments for delete to authenticated
  using (private.is_global_admin());

-- ---------- units ----------
create policy "deptos: ver" on public.units for select to authenticated
  using (private.has_building_access(building_id));
create policy "deptos: crear" on public.units for insert to authenticated
  with check (private.can_manage_building(building_id));
create policy "deptos: editar" on public.units for update to authenticated
  using (private.can_manage_building(building_id)) with check (private.can_manage_building(building_id));
create policy "deptos: borrar" on public.units for delete to authenticated
  using (private.can_manage_building(building_id));

-- ---------- guests (solo administradores) ----------
create policy "huespedes: ver" on public.guests for select to authenticated
  using (
    private.is_global_admin()
    or created_by = (select auth.uid())
    or exists (select 1 from public.reservations r
               where r.guest_id = guests.id and private.can_manage_building(r.building_id))
  );
create policy "huespedes: crear" on public.guests for insert to authenticated
  with check (private.is_any_admin());
create policy "huespedes: editar" on public.guests for update to authenticated
  using (private.is_any_admin()) with check (private.is_any_admin());
create policy "huespedes: borrar" on public.guests for delete to authenticated
  using (private.is_global_admin());

-- ---------- reservations / rates / expenses (administración) ----------
create policy "reservas: ver" on public.reservations for select to authenticated
  using (private.can_manage_building(building_id));
create policy "reservas: crear" on public.reservations for insert to authenticated
  with check (private.can_manage_building(building_id));
create policy "reservas: editar" on public.reservations for update to authenticated
  using (private.can_manage_building(building_id)) with check (private.can_manage_building(building_id));
create policy "reservas: borrar" on public.reservations for delete to authenticated
  using (private.can_manage_building(building_id));

create policy "tarifas: ver" on public.rates for select to authenticated
  using (private.can_manage_building(building_id));
create policy "tarifas: crear" on public.rates for insert to authenticated
  with check (private.can_manage_building(building_id));
create policy "tarifas: editar" on public.rates for update to authenticated
  using (private.can_manage_building(building_id)) with check (private.can_manage_building(building_id));
create policy "tarifas: borrar" on public.rates for delete to authenticated
  using (private.can_manage_building(building_id));

create policy "gastos: ver" on public.expenses for select to authenticated
  using (private.can_manage_building(building_id));
create policy "gastos: crear" on public.expenses for insert to authenticated
  with check (private.can_manage_building(building_id));
create policy "gastos: editar" on public.expenses for update to authenticated
  using (private.can_manage_building(building_id)) with check (private.can_manage_building(building_id));
create policy "gastos: borrar" on public.expenses for delete to authenticated
  using (private.can_manage_building(building_id));

-- ---------- calendar_blocks (todos ven, admins editan) ----------
create policy "bloqueos: ver" on public.calendar_blocks for select to authenticated
  using (private.has_building_access(building_id));
create policy "bloqueos: crear" on public.calendar_blocks for insert to authenticated
  with check (private.can_manage_building(building_id));
create policy "bloqueos: editar" on public.calendar_blocks for update to authenticated
  using (private.can_manage_building(building_id)) with check (private.can_manage_building(building_id));
create policy "bloqueos: borrar" on public.calendar_blocks for delete to authenticated
  using (private.can_manage_building(building_id));

-- ---------- maintenance_tickets ----------
create policy "tickets: ver" on public.maintenance_tickets for select to authenticated
  using (private.has_building_access(building_id));
create policy "tickets: reportar" on public.maintenance_tickets for insert to authenticated
  with check (private.has_building_access(building_id) and reported_by = (select auth.uid()));
create policy "tickets: atender" on public.maintenance_tickets for update to authenticated
  using (
    private.can_manage_building(building_id)
    or assigned_to = (select auth.uid())
    or (private.my_role() = 'mantenimiento' and private.has_building_access(building_id))
  )
  with check (private.has_building_access(building_id));
create policy "tickets: borrar" on public.maintenance_tickets for delete to authenticated
  using (private.can_manage_building(building_id));

-- ---------- cleaning_tasks ----------
create policy "limpiezas: ver" on public.cleaning_tasks for select to authenticated
  using (private.has_building_access(building_id));
create policy "limpiezas: crear" on public.cleaning_tasks for insert to authenticated
  with check (private.can_manage_building(building_id));
create policy "limpiezas: actualizar" on public.cleaning_tasks for update to authenticated
  using (
    private.can_manage_building(building_id)
    or assigned_to = (select auth.uid())
    or (private.my_role() = 'limpieza' and private.has_building_access(building_id))
  )
  with check (private.has_building_access(building_id));
create policy "limpiezas: borrar" on public.cleaning_tasks for delete to authenticated
  using (private.can_manage_building(building_id));

-- ---------- inventory_items ----------
create policy "inventario: ver" on public.inventory_items for select to authenticated
  using (private.has_building_access(building_id));
create policy "inventario: crear" on public.inventory_items for insert to authenticated
  with check (private.can_manage_building(building_id));
create policy "inventario: editar" on public.inventory_items for update to authenticated
  using (private.can_manage_building(building_id)) with check (private.can_manage_building(building_id));
create policy "inventario: borrar" on public.inventory_items for delete to authenticated
  using (private.can_manage_building(building_id));

-- ---------- inventory_movements (todo el personal registra consumo) ----------
create policy "movimientos: ver" on public.inventory_movements for select to authenticated
  using (private.has_building_access(building_id));
create policy "movimientos: registrar" on public.inventory_movements for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.inventory_items i
                where i.id = item_id and private.has_building_access(i.building_id))
    and (quantity < 0 or private.can_manage_building(building_id))  -- entradas solo admins
  );

-- ---------- supply_requests ----------
create policy "solicitudes: ver" on public.supply_requests for select to authenticated
  using (private.has_building_access(building_id));
create policy "solicitudes: crear" on public.supply_requests for insert to authenticated
  with check (private.has_building_access(building_id) and requested_by = (select auth.uid()) and status = 'pendiente');
create policy "solicitudes: gestionar" on public.supply_requests for update to authenticated
  using (
    private.can_manage_building(building_id)
    or (requested_by = (select auth.uid()) and status = 'pendiente')
  )
  with check (
    private.can_manage_building(building_id)
    or (requested_by = (select auth.uid()) and status = 'pendiente')
  );
create policy "solicitudes: borrar" on public.supply_requests for delete to authenticated
  using (private.can_manage_building(building_id) or (requested_by = (select auth.uid()) and status = 'pendiente'));

-- ---------- notifications ----------
create policy "notificaciones: ver propias" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notificaciones: marcar leídas" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notificaciones: borrar propias" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- push_subscriptions ----------
create policy "push: ver propias" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push: registrar" on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "push: actualizar" on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push: borrar" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Nadie anónimo toca nada
revoke all on all tables in schema public from anon;
