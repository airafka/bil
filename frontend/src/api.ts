import type { ContractOption, ServiceOrderSummary, ServiceOrderDetails } from './serviceOrder'
import type {
  CreatedOrder,
  CreatedWaybill,
  GroupedWaybillFilter,
  GroupedWaybillPage,
  OrderDetails,
  OrderSummary,
  PagedResponse,
  ReferenceOption,
  TerminalAreaOption,
  TransportTypeOption,
} from './domain'
import type { CreateOrderPayload } from './orderForm'
import type { RouteType, RouteSummary, RouteOrder, RouteDetails, CreateRoutePayload } from './routes'
import type { CreateWaybillPayload } from './waybillForm'
import type { ComplexService, ComplexServiceDetails, ComplexServicePayload, ComplexServiceTariffPayload } from './complexService'

type ApiProblem = {
  detail?: string
  title?: string
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function sendRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ApiProblem
    throw new ApiError(problem.detail ?? problem.title ?? 'Не удалось выполнить запрос')
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

// Share concurrent reads (including StrictMode effects), never cache settled data.
const pendingGets = new Map<string, Promise<unknown>>()
function request<T>(url: string, options?: RequestInit): Promise<T> {
  if (options?.method && options.method !== 'GET') return sendRequest<T>(url, options)
  const existing = pendingGets.get(url)
  if (existing) return existing as Promise<T>
  const pending = sendRequest<T>(url, options).finally(() => pendingGets.delete(url))
  pendingGets.set(url, pending)
  return pending
}

export function getReferenceOptions(resource: 'clients' | 'containers' | 'etsng-codes' | 'railway-carriages' | 'railway-carriage-types', query = '') {
  return request<ReferenceOption[]>(`/api/references/${resource}?limit=100&q=${encodeURIComponent(query)}`)
}

export function getTerminalAreas() {
  return request<TerminalAreaOption[]>('/api/references/terminal-areas')
}

export function getTransportTypes() {
  return request<TransportTypeOption[]>('/api/references/transport-types')
}

export function getOrders(apiPath: string, page: number, size = 20, query = '', status = '') {
  return request<PagedResponse<OrderSummary>>(`${apiPath}?page=${page}&size=${size}&query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`)
}

export function getOrder(apiPath: string, id: string) {
  return request<OrderDetails>(`${apiPath}/${id}`)
}

export function createOrder(apiPath: string, payload: CreateOrderPayload) {
  return request<CreatedOrder>(apiPath, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createWaybill(payload: CreateWaybillPayload) {
  return request<CreatedWaybill>('/api/waybills', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getGroupedWaybills(
  filter: GroupedWaybillFilter,
  page: number,
  size = 20,
  availableForReceivingOrderOnly = false,
) {
  return request<GroupedWaybillPage>('/api/waybills/grouped/page', {
    method: 'POST',
    body: JSON.stringify({
      filter,
      pageInfo: { page, size },
      sortingColumn: 'departureStation',
      sortingDirection: 'ASC',
      availableForReceivingOrderOnly,
    }),
  })
}


export function getContracts() { return request<ContractOption[]>('/api/references/contracts') }
export function getServiceOrders(page = 0, query = '', status = '') { return request<PagedResponse<ServiceOrderSummary>>('/api/service-orders?page=' + page + '&size=20&query=' + encodeURIComponent(query) + '&status=' + encodeURIComponent(status)) }
export function getServiceOrder(id: string) { return request<ServiceOrderDetails>('/api/service-orders/' + id) }
export function createServiceOrder(payload: { clientId: string; contractId: string; waybillIds: string[] }) {
  return request<ServiceOrderDetails>('/api/service-orders', { method: 'POST', body: JSON.stringify(payload) })
}
export function createServiceShippingOrder(serviceId: string, containerIds: string[]) {
  return request<ServiceOrderDetails>(`/api/service-orders/${serviceId}/shipping-orders`, {
    method: 'POST', body: JSON.stringify({ containerIds }),
  })
}
export function createReturnReceivingOrder(shippingId: string, payload: { containerIds: string[] }) {
  return request<CreatedOrder>(`/api/shipping-orders/${shippingId}/returns`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateContainerTare(id: string, tareWeight: string) {
  return request<ReferenceOption>('/api/references/containers/' + id + '/tare-weight', { method: 'PATCH', body: JSON.stringify({ tareWeight }) })
}

export function changeOrderStatus(apiPath: string, id: string, expectedStatus: string, status: string) {
  return request<CreatedOrder>(`${apiPath}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ expectedStatus, status }) })
}

export function getRoutes() { return request<RouteSummary[]>('/api/routes') }
export function getRoute(id: string) { return request<RouteDetails>('/api/routes/' + id) }
export function getAvailableRouteOrders(routeType: RouteType, transportType: string, terminalAreaId: string) {
  return request<RouteOrder[]>(`/api/routes/available-orders?routeType=${routeType}&transportType=${transportType}&terminalAreaId=${terminalAreaId}`)
}
export function createRoute(payload: CreateRoutePayload) {
  return request<RouteDetails>('/api/routes', { method: 'POST', body: JSON.stringify(payload) })
}

export function assignRouteOrders(id: string, orderIds: string[]) {
  return request<RouteDetails>('/api/routes/' + id + '/orders', { method: 'POST', body: JSON.stringify({ orderIds }) })
}

export function getComplexServices() { return request<ComplexService[]>('/api/complex-services') }
export function getComplexService(id: string) { return request<ComplexServiceDetails>(`/api/complex-services/${id}`) }
export function createComplexService(payload: ComplexServicePayload) {
  return request<ComplexServiceDetails>('/api/complex-services', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateComplexService(id: string, payload: ComplexServicePayload) {
  return request<ComplexServiceDetails>(`/api/complex-services/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function deleteComplexService(id: string) {
  return request<void>(`/api/complex-services/${id}`, { method: 'DELETE' })
}
export function saveComplexServiceTariff(id: string, payload: ComplexServiceTariffPayload) {
  return request<ComplexServiceDetails>(`/api/complex-services/${id}/tariffs`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function deleteComplexServiceTariff(id: string, contractId: string) {
  return request<void>(`/api/complex-services/${id}/tariffs/${contractId}`, { method: 'DELETE' })
}

export function getBillingCharges(serviceOrderId?: string, page = 0) {
  return request<import('./billing').BillingChargePage>(`/api/billing-charges?page=${page}&size=20${serviceOrderId ? `&serviceOrderId=${serviceOrderId}` : ''}`)
}

export function createServiceReturns(serviceId: string, shippingOrderIds: string[]) {
  return request<CreatedOrder[]>('/api/service-orders/' + serviceId + '/returns', { method: 'POST', body: JSON.stringify({ shippingOrderIds }) })
}
