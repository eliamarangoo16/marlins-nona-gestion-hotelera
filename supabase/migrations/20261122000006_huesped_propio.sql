-- Quien creó un huésped puede borrarlo mientras no tenga reservas
-- (evita huéspedes huérfanos cuando falla el alta de una reserva)
create policy "huespedes: borrar propios sin reservas" on public.guests for delete to authenticated
  using (
    created_by = (select auth.uid())
    and not exists (select 1 from public.reservations r where r.guest_id = guests.id)
  );
