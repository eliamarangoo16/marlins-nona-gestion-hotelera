# Marlins & Nona · Plataforma de gestión hotelera

Plataforma para administrar edificios de departamentos en renta vacacional (Airbnb), escalable a más edificios.

## Stack
- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS + React Router + PWA (instalable en celular, notificaciones push).
- **Backend:** Supabase (proyecto `fjnkjlrbxunaflwdjlvp`, región us-east-1): Postgres + Auth + RLS + Realtime + Edge Functions.
- **Push:** Web Push (VAPID). Llaves guardadas en Supabase Vault; la pública también va en `VITE_VAPID_PUBLIC_KEY`.

## Roles
| Rol | Qué puede hacer |
|---|---|
| `developer` | Todo, incluida la gestión de usuarios y otros developers. Se asigna automáticamente a `aramueliam16@gmail.com` al registrarse. |
| `admin_universal` | Todo en todos los edificios; crea usuarios y asigna roles (excepto developer). |
| `admin_edificio` | Todo dentro de los edificios que se le asignen (departamentos, reservas, tarifas, huéspedes, gastos, inventario, tickets, limpiezas). |
| `mantenimiento` | Ve departamentos de sus edificios, crea y atiende tickets, registra consumo de inventario y pide insumos. |
| `limpieza` | Ve departamentos de sus edificios, atiende tareas de limpieza, reporta fallas, registra consumo y pide insumos. |
| `sin_asignar` | Cuenta recién creada sin acceso. |

La asignación de edificios vive en `building_assignments`. Toda la seguridad está en RLS (ver `supabase/migrations/…_seguridad_rls.sql`), el frontend solo oculta lo que el rol no puede usar.

## Modelo de datos (schema `public`)
- `profiles` — usuario + rol.
- `buildings`, `units` (departamentos), `building_assignments`.
- `guests`, `reservations` (con restricción que impide reservas traslapadas por departamento; `net_amount` = total − comisión − impuestos).
- `rates` (tarifas por temporada), `calendar_blocks` (bloqueos de calendario).
- `maintenance_tickets`, `cleaning_tasks`.
- `inventory_items`, `inventory_movements` (consumo/entradas; actualizan existencias por trigger), `supply_requests` (pedidos de insumos).
- `expenses` (gastos para estado de resultados).
- `notifications`, `push_subscriptions`.

`building_id` en reservas, tarifas, bloqueos, limpiezas y movimientos se calcula por trigger a partir del departamento/artículo (el frontend puede mandarlo pero se sobreescribe).

## Notificaciones
Triggers en la base crean filas en `notifications` para todos los administradores del edificio (developer, admin_universal y admin_edificio asignado), excluyendo a quien hizo el cambio:
- Reserva nueva, cancelada o con cambio de fechas.
- Ticket de mantenimiento nuevo, cambio de estado, escalado a urgente; aviso al asignado.
- Limpieza asignada (al asignado) y terminada (a admins).
- Solicitud de insumo (a admins) y su resolución (al solicitante).
- Stock por debajo del mínimo.

Cada notificación nueva llama vía `pg_net` a la Edge Function `send-push`, que manda el push a todos los dispositivos suscritos del usuario y marca `pushed_at`. La campanita in‑app usa Realtime.

En iPhone, las notificaciones push funcionan si la app se agrega a la pantalla de inicio (iOS 16.4+). En Android funcionan desde Chrome directamente.

## Edge Functions
- `send-push` (sin JWT): recibe `{ notification_id }`, solo envía notificaciones existentes no enviadas.
- `admin-users` (con JWT): crear usuario con contraseña temporal, cambiar rol, asignar edificios, activar/desactivar. Solo `developer` y `admin_universal`.
