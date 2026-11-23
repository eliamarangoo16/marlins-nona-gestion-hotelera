import type { Tables } from './database'

export type Building = Tables<'buildings'>
export type Unit = Tables<'units'>
export type Guest = Tables<'guests'>
export type Reservation = Tables<'reservations'>
export type Rate = Tables<'rates'>
export type Block = Tables<'calendar_blocks'>
export type Ticket = Tables<'maintenance_tickets'>
export type CleaningTask = Tables<'cleaning_tasks'>
export type InvItem = Tables<'inventory_items'>
export type InvMovement = Tables<'inventory_movements'>
export type SupplyRequest = Tables<'supply_requests'>
export type Expense = Tables<'expenses'>
export type Profile = Tables<'profiles'>

type UnitRef = { name: string; building_id: string; buildings: { name: string } | null } | null

export type ReservationFull = Reservation & { units: UnitRef; guests: { full_name: string; phone: string | null; email: string | null } | null }
export type TicketFull = Ticket & { units: { name: string } | null; buildings: { name: string } | null; assignee: { full_name: string | null } | null; reporter: { full_name: string | null } | null }
export type CleaningFull = CleaningTask & { units: { name: string } | null; buildings: { name: string } | null; assignee: { full_name: string | null } | null }
export type SupplyFull = SupplyRequest & { buildings: { name: string } | null; requester: { full_name: string | null } | null }
export type MovementFull = InvMovement & { inventory_items: { name: string; unit_of_measure: string } | null; creator: { full_name: string | null } | null }
export type ExpenseFull = Expense & { buildings: { name: string } | null; units: { name: string } | null }
