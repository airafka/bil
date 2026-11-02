import type { ContractOption, ComprehensiveServiceOrderSummary, ComprehensiveServiceOrderDetails } from './comprehensiveServiceOrder'
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
import type { InvoiceCandidates, InvoiceDetails, InvoiceFilters, PaymentInvoice } from './invoices'

export function getPaymentInvoices(page = 0) {
  return request<PagedResponse<PaymentInvoice>>(`/api/payment-invoices?page=${page}`)
}
export function getInvoiceCandidates(filters: InvoiceFilters) {
  return request<InvoiceCandidates>(`/api/payment-invoices/available-charges?${new URLSearchParams(filters)}`)
}
export function createPaymentInvoice(filters: InvoiceFilters, chargeIds: string[], requestKey: string) {
  return request<InvoiceDetails>('/api/payment-invoices', { method: 'POST', body: JSON.stringify({ ...filters, chargeIds, requestKey }) })
}
export function getPaymentInvoice(id: string) {
  return request<InvoiceDetails>(`/api/payment-invoices/${id}`)
}
export function deletePaymentInvoice(id: string) {
  return request<void>(`/api/payment-invoices/${id}`, { method: 'DELETE' })
}

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

export function getReferenceOptions(resource: 'clients' | 'containers' | 'etsng-codes' | 'railway-carriages' | 'railway-carriage-types' | 'seal-types' | 'hazard-classes' | 'danger-products' | 'railway-carriage-models' | 'railway-carriage-kinds', query = '') {
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

export function updateOrderContainerAttributes(apiPath: string, id: string, containers: Array<import('./domain').ReceivingContainerAttributes & { containerId: string }>, defaultContainerOwnerId?: string, additions: Array<{container: CreateOrderPayload['containers'][number]; railwayCarriageId?: string}> = []) {
  return request<OrderDetails>(`${apiPath}/${id}/containers`, { method: 'PATCH', body: JSON.stringify({ containers, ...(defaultContainerOwnerId ? { defaultContainerOwnerId } : {}), ...(additions.length ? { additions } : {}) }) })
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
export function getComprehensiveServiceOrders(page = 0, query = '', status = '') { return request<PagedResponse<ComprehensiveServiceOrderSummary>>('/api/comprehensive-service-orders?page=' + page + '&size=20&query=' + encodeURIComponent(query) + '&status=' + encodeURIComponent(status)) }
export function getComprehensiveServiceOrder(id: string) { return request<ComprehensiveServiceOrderDetails>('/api/comprehensive-service-orders/' + id) }
export function createComprehensiveServiceOrder(payload: { clientId: string; contractId: string; waybillIds: string[]; defaultContainerOwnerId?: string }) {
  return request<ComprehensiveServiceOrderDetails>('/api/comprehensive-service-orders', { method: 'POST', body: JSON.stringify(payload) })
}
export function createServiceShippingOrder(serviceId: string, containerIds: string[]) {
  return request<ComprehensiveServiceOrderDetails>(`/api/comprehensive-service-orders/${serviceId}/shipping-orders`, {
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

export function getBillingCharges(comprehensiveServiceOrderId?: string, page = 0) {
  return request<import('./billing').BillingChargePage>(`/api/billing-charges?page=${page}&size=20${comprehensiveServiceOrderId ? `&comprehensiveServiceOrderId=${comprehensiveServiceOrderId}` : ''}`)
}

export function createServiceReturns(serviceId: string, shippingOrderIds: string[]) {
  return request<CreatedOrder[]>('/api/comprehensive-service-orders/' + serviceId + '/returns', { method: 'POST', body: JSON.stringify({ shippingOrderIds }) })
}

export function getRailwayCarriagePage(page: number) {
  return request<PagedResponse<import('./railwayCarriages').RailwayCarriage>>(`/api/references/railway-carriages/page?page=${page}&size=20`)
}
export function updateRailwayCarriage(id: string, value: import('./railwayCarriages').RailwayCarriagePatch) {
  return request<import('./railwayCarriages').RailwayCarriage>(`/api/references/railway-carriages/${id}`, { method: 'PATCH', body: JSON.stringify(value) })
}

export function updateContainerAttributes(id: string, tareWeight: string, loadCapacity: string | null) {
  return request<ReferenceOption>('/api/references/containers/' + id + '/attributes', { method: 'PATCH', body: JSON.stringify({ tareWeight, loadCapacity }) })
}

export function finishContainerOrder(apiPath: string, id: string) {
  return request<import('./domain').CreatedOrder>(apiPath + '/' + id + '/events', { method: 'POST', body: JSON.stringify({ eventCode: apiPath === '/api/receiving-orders' ? 'UNLOAD_FINISH' : 'LOAD_FINISH' }) })
}

export function getContainerStock(query = '', clientId = '', status = '', page = 0) {
  return request<PagedResponse<import('./containerStock').StockOwner>>('/api/container-owners?' + new URLSearchParams({ query, ...(clientId ? { clientId } : {}), ...(status ? { status } : {}), page: String(page) }))
}
export function getOwnerHistory(id: string, includeReservations = false) { return request<import('./containerStock').OwnerHistory[]>('/api/containers/' + id + '/owner-history?includeReservations=' + includeReservations) }
export function getOwnershipOrders(query = '', page = 0) { return request<PagedResponse<import('./containerStock').OwnershipHeader>>('/api/service-orders?' + new URLSearchParams({ query, page: String(page) })) }
export function getOwnershipOrder(id: string) { return request<import('./containerStock').OwnershipDetails>('/api/service-orders/' + id) }
export function createOwnershipOrder(clientId: string, comment: string) { return request<import('./containerStock').OwnershipDetails>('/api/service-orders', { method: 'POST', body: JSON.stringify({ clientId, service: 'CHANGE_OWNER', comment }) }) }
export function updateOwnershipOrder(id: string, comment: string) { return request<import('./containerStock').OwnershipDetails>('/api/service-orders/' + id, { method: 'PUT', body: JSON.stringify({ id, service: 'CHANGE_OWNER', comment }) }) }
export function getOwnershipAvailable(id: string, query = '', page = 0) { return request<PagedResponse<import('./containerStock').OwnershipContainer>>('/api/service-orders/' + id + '/containers/available?' + new URLSearchParams({ query, page: String(page) })) }
export function saveOwnershipSelection(id: string, containerOwnerIds: string[]) { return request<import('./containerStock').OwnershipDetails>('/api/service-orders/' + id + '/containers', { method: 'PUT', body: JSON.stringify(containerOwnerIds.map(containerOwnerId => ({ containerOwnerId }))) }) }
export function acceptOwnershipOrder(id: string) { return request<import('./containerStock').OwnershipDetails>('/api/service-orders/' + id + '/accept', { method: 'POST' }) }
export function deleteOwnershipOrder(id: string) { return request<void>('/api/service-orders/' + id, { method: 'DELETE' }) }

export function lookupContainerStock(containerIds: string[]) {
  return request<import('./containerStock').ContainerStockLookup[]>('/api/container-owners/lookup', { method: 'POST', body: JSON.stringify({ containerIds }) })
}
