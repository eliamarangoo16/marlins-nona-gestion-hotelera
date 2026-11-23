-- =====================================================================
-- Marlins & Nona · Gestión hotelera
-- Migración 1: extensiones, tipos y tablas
-- =====================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_net;

create schema if not exists private;

-- ---------- Tipos ----------
create type public.app_role as enum (
  'developer',        -- dueño técnico del sistema (Eliam)
  'admin_universal',  -- administra todos los edificios
  'admin_edificio',   -- administra solo los edificios asignados
  'mantenimiento',
  'limpieza',
  'sin_asignar'       -- cuenta creada sin permisos todavía
);
create type public.unit_status as enum ('disponible','ocupado','limpieza','mantenimiento','bloqueado');
create type public.reservation_status as enum ('pendiente','confirmada','en_curso','finalizada','cancelada');
create type public.booking_channel as enum ('airbnb','directo','booking','vrbo','otro');
create type public.ticket_priority as enum ('baja','media','alta','urgente');
create type public.ticket_status as enum ('abierto','en_progreso','en_espera','resuelto','cancelado');
create type public.task_status as enum ('pendiente','en_progreso','terminada','cancelada');
create type public.supply_status as enum ('pendiente','aprobada','comprada','entregada','rechazada');
create type public.urgency_level as enum ('baja','normal','alta','urgente');

-- ---------- Usuarios ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role public.app_role not null default 'sin_asignar',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Correos que reciben el rol developer al registrarse
create table private.bootstrap_developers (
  email text primary key
);
insert into private.bootstrap_developers(email) values ('aramueliam16@gmail.com');

-- ---------- Edificios y departamentos ----------
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  city text,
  state text,
  postal_code text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.building_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, building_id)
);
create index building_assignments_building_idx on public.building_assignments(building_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  floor int,
  bedrooms int not null default 1,
  bathrooms numeric(3,1) not null default 1,
  max_guests int not null default 2,
  base_rate numeric(12,2) not null default 0,
  cleaning_fee numeric(12,2) not null default 0,
  status public.unit_status not null default 'disponible',
  airbnb_listing_url text,
  ical_import_url text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, name)
);
create index units_building_idx on public.units(building_id);

-- ---------- Huéspedes y reservas ----------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  country text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guests_created_by_idx on public.guests(created_by);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete restrict,
  building_id uuid not null references public.buildings(id) on delete cascade, -- se llena por trigger
  guest_id uuid references public.guests(id) on delete set null,
  check_in date not null,
  check_out date not null,
  status public.reservation_status not null default 'confirmada',
  channel public.booking_channel not null default 'airbnb',
  external_ref text,
  guests_count int not null default 1,
  nightly_rate numeric(12,2),
  total_amount numeric(12,2) not null default 0,   -- lo que paga el huésped (incluye limpieza)
  cleaning_fee numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,   -- comisión Airbnb/Booking
  taxes numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  net_amount numeric(12,2) generated always as (total_amount - platform_fee - taxes) stored,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_dates_chk check (check_out > check_in),
  constraint reservations_no_overlap exclude using gist (
    unit_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status <> 'cancelada')
);
create index reservations_unit_idx on public.reservations(unit_id);
create index reservations_building_dates_idx on public.reservations(building_id, check_in, check_out);
create index reservations_guest_idx on public.reservations(guest_id);
create index reservations_created_by_idx on public.reservations(created_by);

-- ---------- Tarifas y calendario ----------
create table public.rates (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade, -- trigger
  name text,
  start_date date not null,
  end_date date not null,
  nightly_rate numeric(12,2) not null,
  min_nights int not null default 1,
  created_at timestamptz not null default now(),
  constraint rates_dates_chk check (end_date >= start_date)
);
create index rates_unit_dates_idx on public.rates(unit_id, start_date, end_date);
create index rates_building_idx on public.rates(building_id);

create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade, -- trigger
  start_date date not null,
  end_date date not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint calendar_blocks_dates_chk check (end_date > start_date)
);
create index calendar_blocks_unit_dates_idx on public.calendar_blocks(unit_id, start_date, end_date);
create index calendar_blocks_building_idx on public.calendar_blocks(building_id);
create index calendar_blocks_created_by_idx on public.calendar_blocks(created_by);

-- ---------- Operación: mantenimiento y limpieza ----------
create table public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  title text not null,
  description text,
  priority public.ticket_priority not null default 'media',
  status public.ticket_status not null default 'abierto',
  assigned_to uuid references public.profiles(id) on delete set null,
  reported_by uuid references public.profiles(id) on delete set null default auth.uid(),
  cost numeric(12,2) not null default 0,
  due_date date,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index maintenance_building_status_idx on public.maintenance_tickets(building_id, status);
create index maintenance_unit_idx on public.maintenance_tickets(unit_id);
create index maintenance_assigned_idx on public.maintenance_tickets(assigned_to);
create index maintenance_reported_idx on public.maintenance_tickets(reported_by);

create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade, -- trigger
  reservation_id uuid references public.reservations(id) on delete set null,
  scheduled_date date not null,
  status public.task_status not null default 'pendiente',
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cleaning_building_date_idx on public.cleaning_tasks(building_id, scheduled_date);
create index cleaning_unit_idx on public.cleaning_tasks(unit_id);
create index cleaning_reservation_idx on public.cleaning_tasks(reservation_id);
create index cleaning_assigned_idx on public.cleaning_tasks(assigned_to);
create index cleaning_created_by_idx on public.cleaning_tasks(created_by);

-- ---------- Inventario ----------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  category text not null default 'limpieza', -- limpieza, amenidades, blancos, mantenimiento, cocina, otro
  unit_of_measure text not null default 'pieza',
  current_stock numeric(12,2) not null default 0,
  min_stock numeric(12,2) not null default 0,
  unit_cost numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, name)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade, -- trigger
  quantity numeric(12,2) not null check (quantity <> 0), -- positivo = entrada, negativo = salida
  reason text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index inventory_movements_item_idx on public.inventory_movements(item_id);
create index inventory_movements_building_idx on public.inventory_movements(building_id);
create index inventory_movements_created_by_idx on public.inventory_movements(created_by);

create table public.supply_requests (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_of_measure text,
  urgency public.urgency_level not null default 'normal',
  status public.supply_status not null default 'pendiente',
  notes text,
  requested_by uuid references public.profiles(id) on delete set null default auth.uid(),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supply_requests_building_status_idx on public.supply_requests(building_id, status);
create index supply_requests_item_idx on public.supply_requests(item_id);
create index supply_requests_requested_idx on public.supply_requests(requested_by);
create index supply_requests_resolved_idx on public.supply_requests(resolved_by);

-- ---------- Finanzas ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  category text not null, -- mantenimiento, limpieza, servicios, insumos, impuestos, comisiones, nomina, otro
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index expenses_building_date_idx on public.expenses(building_id, expense_date);
create index expenses_unit_idx on public.expenses(unit_id);
create index expenses_created_by_idx on public.expenses(created_by);

-- ---------- Notificaciones ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index notifications_building_idx on public.notifications(building_id);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
