import { lazy, Suspense, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { BuildingProvider } from '@/context/BuildingContext'
import { ToastProvider } from '@/context/ToastContext'
import { NotificationsProvider } from '@/hooks/useNotifications'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageLoader } from '@/components/ui'
import type { Permiso } from '@/lib/permissions'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ChangePassword from '@/pages/auth/ChangePassword'
import Pending from '@/pages/auth/Pending'

const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))
const MyTasks = lazy(() => import('@/pages/dashboard/MyTasks'))
const Buildings = lazy(() => import('@/pages/buildings/Buildings'))
const BuildingDetail = lazy(() => import('@/pages/buildings/BuildingDetail'))
const Calendar = lazy(() => import('@/pages/calendar/Calendar'))
const Reservations = lazy(() => import('@/pages/reservations/Reservations'))
const ReservationDetail = lazy(() => import('@/pages/reservations/ReservationDetail'))
const Guests = lazy(() => import('@/pages/guests/Guests'))
const Rates = lazy(() => import('@/pages/rates/Rates'))
const Maintenance = lazy(() => import('@/pages/maintenance/Maintenance'))
const TicketDetail = lazy(() => import('@/pages/maintenance/TicketDetail'))
const Cleaning = lazy(() => import('@/pages/cleaning/Cleaning'))
const Inventory = lazy(() => import('@/pages/inventory/Inventory'))
const Finance = lazy(() => import('@/pages/finance/Finance'))
const Users = lazy(() => import('@/pages/users/Users'))
const Notifications = lazy(() => import('@/pages/notifications/Notifications'))
const Profile = lazy(() => import('@/pages/profile/Profile'))

function FullLoader() {
  return <div className="flex h-full items-center justify-center"><PageLoader /></div>
}

/** Exige sesión y cuenta aprobada; envuelve con los proveedores de datos. */
function Protected() {
  const { session, profile, loading, recovery } = useAuth()
  if (loading) return <FullLoader />
  if (!session) return <Navigate to="/login" replace />
  if (recovery) return <Navigate to="/cambiar-contrasena" replace />
  if (!profile || !profile.active || profile.role === 'sin_asignar') return <Pending />
  return (
    <BuildingProvider>
      <NotificationsProvider>
        <AppLayout />
      </NotificationsProvider>
    </BuildingProvider>
  )
}

function Guard({ permiso, children }: { permiso: Permiso; children: ReactElement }) {
  const { can } = useAuth()
  return can(permiso) ? children : <Navigate to="/" replace />
}

function Home() {
  const { can } = useAuth()
  return can('dashboard') ? <Dashboard /> : <MyTasks />
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Suspense fallback={<FullLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/recuperar" element={<ForgotPassword />} />
            <Route path="/cambiar-contrasena" element={<ChangePassword />} />
            <Route element={<Protected />}>
              <Route index element={<Home />} />
              <Route path="/edificios" element={<Guard permiso="edificios"><Buildings /></Guard>} />
              <Route path="/edificios/:id" element={<Guard permiso="edificios"><BuildingDetail /></Guard>} />
              <Route path="/calendario" element={<Guard permiso="calendario"><Calendar /></Guard>} />
              <Route path="/reservas" element={<Guard permiso="reservas"><Reservations /></Guard>} />
              <Route path="/reservas/:id" element={<Guard permiso="reservas"><ReservationDetail /></Guard>} />
              <Route path="/huespedes" element={<Guard permiso="huespedes"><Guests /></Guard>} />
              <Route path="/tarifas" element={<Guard permiso="tarifas"><Rates /></Guard>} />
              <Route path="/mantenimiento" element={<Guard permiso="mantenimiento"><Maintenance /></Guard>} />
              <Route path="/mantenimiento/:id" element={<Guard permiso="mantenimiento"><TicketDetail /></Guard>} />
              <Route path="/limpieza" element={<Guard permiso="limpieza"><Cleaning /></Guard>} />
              <Route path="/inventario" element={<Guard permiso="inventario"><Inventory /></Guard>} />
              <Route path="/finanzas" element={<Guard permiso="finanzas"><Finance /></Guard>} />
              <Route path="/usuarios" element={<Guard permiso="usuarios"><Users /></Guard>} />
              <Route path="/notificaciones" element={<Notifications />} />
              <Route path="/perfil" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  )
}
