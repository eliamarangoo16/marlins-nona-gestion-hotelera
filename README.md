# Marlins & Nona · Gestión

Plataforma de gestión hotelera para departamentos en renta vacacional (Airbnb), pensada para administrar varios edificios y departamentos. Es una PWA instalable en el celular, con notificaciones push.

## Qué incluye

- Dashboard con ocupación, ADR, RevPAR, ingresos, comisiones, gastos y utilidad; gráfica de 6 meses y alertas operativas.
- Edificios y departamentos, calendario (reservas y bloqueos), reservas, huéspedes y tarifas por temporada.
- Mantenimiento (tickets), limpieza (tareas por fecha), inventario (consumo, entradas, solicitudes de insumos) y finanzas (gastos y estado de resultados con CSV).
- Usuarios y roles (Edge Function `admin-users`), notificaciones en la app (Realtime) y push (Edge Function `send-push`).

## Stack

Vite + React 18 + TypeScript (strict) · Tailwind CSS 3 · react-router-dom 6 · Supabase (Postgres, Auth, RLS, Realtime, Edge Functions) · date-fns · lucide-react · recharts · vite-plugin-pwa (`injectManifest` con `src/sw.ts`).

## Correr en local

```bash
npm i
cp .env.example .env     # ya trae las variables del proyecto; ajusta si hace falta
npm run dev
```

Otros scripts: `npm run typecheck`, `npm run build`, `npm run preview`, `npm run icons` (regenera los PNG de la PWA desde `public/icon.svg`).

Variables de entorno:

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Llave publicable (anon) |
| `VITE_VAPID_PUBLIC_KEY` | Llave pública VAPID para Web Push |

## Desplegar en Vercel

1. Importa el repositorio en Vercel (framework: Vite; build `npm run build`, salida `dist`).
2. Agrega las tres variables de entorno anteriores.
3. `vercel.json` ya incluye el rewrite SPA. Para Netlify se usa `public/_redirects`.
4. En Supabase, en Authentication > URL Configuration, agrega la URL de producción como Site URL y en Redirect URLs (necesario para confirmar correo y recuperar contraseña: `https://TU-DOMINIO/cambiar-contrasena`).

Las Edge Functions están en `supabase/functions/` (`send-push` con `verify_jwt=false`, `admin-users` con `verify_jwt=true`) y se despliegan por separado desde Supabase.

## Primer acceso

1. Entra a `/registro` y crea tu cuenta con **aramueliam16@gmail.com**: la base de datos le asigna automáticamente el rol **developer**.
2. Crea los edificios y departamentos en **Edificios**.
3. En **Usuarios** crea al resto del equipo: se genera una contraseña temporal que se muestra una sola vez para compartirla. Una cuenta que se registra sola queda "sin asignar" hasta que un administrador le dé rol.

## Roles

| Rol | Alcance |
|---|---|
| `developer` | Todo, incluida la gestión de usuarios y de otros developers |
| `admin_universal` | Todo en todos los edificios; crea usuarios (no developers) |
| `admin_edificio` | Todo dentro de sus edificios asignados |
| `mantenimiento` | Atiende tickets, reporta fallas, registra consumo y pide insumos |
| `limpieza` | Atiende limpiezas, reporta fallas, registra consumo y pide insumos |
| `sin_asignar` | Sin acceso hasta que se le asigne rol |

La seguridad real vive en las políticas RLS de la base; el frontend solo oculta lo que cada rol no puede usar (`src/lib/permissions.ts`).

## Activar notificaciones push

- **Android (Chrome):** entra a la app, ve a **Mi perfil > Notificaciones en este celular** y pulsa **Activar**; acepta el permiso. Opcionalmente instala la app desde el menú de Chrome.
- **iPhone / iPad (iOS 16.4 o superior):** abre la app en **Safari**, toca **Compartir > Agregar a pantalla de inicio**, abre la app desde el nuevo ícono y luego activa las notificaciones en **Mi perfil**. Sin instalarla en la pantalla de inicio, iOS no permite push.

Para desactivarlas en un dispositivo, usa el mismo botón (ahora dirá **Desactivar**).
