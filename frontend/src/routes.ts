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
  carrierId?: string | null
  driverId?: string | null
  vehicleId?: string | null
  phoneNumber?: string | null
  poaNumber?: string | null
  poaValidTo?: string | null
  insuranceNumber?: string | null
  withTrailer?: boolean | null
  trailerNumber?: string | null
  carrier: string | null
  driverName: string | null
  vehicleNumber: string | null
  comment: string | null
  status: string
  orderNumbers?: number[]
  orderCount: number
}
export type RouteOrder = { id: string; code: number; clientName: string; status: string }
export type RouteDetails = { route: RouteSummary; orders: RouteOrder[] }
export type CreateRoutePayload = {
  routeType: RouteType
  departureAt: string
  terminalAreaId: string
  transportType: TransportType
  carrierId: string | null
  driverId: string | null
  vehicleId: string | null
  comment: string
  orderIds: string[]
}
export const routeTypeLabel = (type: RouteType) => type === 'RECEIVING' ? 'Поставка' : 'Вывоз'
export const routeDateLabel = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const date = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' })
const time = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })

// The documented UI interval ends one hour after route.data_time.
export function routeIntervalLabel(value: string) {
  const start = new Date(value)
  if (Number.isNaN(start.getTime())) return '—'
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const endDate = date.format(start) === date.format(end) ? '' : date.format(end) + ' '
  return `${date.format(start)} ${time.format(start)} – ${endDate}${time.format(end)}`
}
