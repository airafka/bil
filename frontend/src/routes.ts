import type { TransportType } from './domain'

export type RouteType = 'RECEIVING' | 'SHIPPING'
export type RouteSummary = {
  id: string
  code: number
  routeType: RouteType
  departureAt: string
  terminalAreaId: string
  terminalAreaName: string
  transportType: TransportType
  carrier: string | null
  driverName: string | null
  vehicleNumber: string | null
  comment: string | null
  status: string
  orderCount: number
}
export type RouteOrder = { id: string; code: number; clientName: string; status: string }
export type RouteDetails = { route: RouteSummary; orders: RouteOrder[] }
export type CreateRoutePayload = {
  routeType: RouteType
  departureAt: string
  terminalAreaId: string
  transportType: TransportType
  carrier: string
  driverName: string
  vehicleNumber: string
  comment: string
  orderIds: string[]
}
export const routeTypeLabel = (type: RouteType) => type === 'RECEIVING' ? 'Поставка' : 'Вывоз'
export const routeDateLabel = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
