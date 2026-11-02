import type { RouteSummary, RouteType } from './routes'
import { routeDateLabel } from './routes'
import type { TransportType } from './domain'

export function matchingRoutes(routes: RouteSummary[], routeType: RouteType, transportType: TransportType, area: string, search: string) {
  const query=search.trim().toLocaleLowerCase('ru-RU')
  return routes.filter(route => route.status==='DRAFT' && route.routeType===routeType && route.transportType===transportType && route.terminalAreaId===area
    && (!query || [route.code,(route.orderNumbers ?? []).join(', '),route.carrier,routeDateLabel(route.departureAt),route.vehicleNumber,route.driverName,route.comment].join(' ').toLocaleLowerCase('ru-RU').includes(query)))
}
