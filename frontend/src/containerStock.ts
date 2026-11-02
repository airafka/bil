export const containerStatusLabels: Record<string, string> = {
  EXPECTED: 'Ожидает поставки', ON_TERMINAL: 'В остатках', RESERVED_OUT: 'Ожидает вывоза', DEPARTED: 'Нет в остатках',
}
export const containerStatusLabel = (value: string | null) => value ? containerStatusLabels[value] ?? value : '—'
export type StockOwner = { id: string; containerId: string; containerName: string; containerType: string; clientId: string; clientName: string; status: string; receivingOrderId: string | null; shippingOrderId: string | null }
export type OwnerHistory = { id: string; containerId: string; oldClientName: string | null; newClientName: string | null; oldStatus: string | null; newStatus: string | null; orderId: string; orderType: string; orderNumber: number | null; createdAt: string }
export type OwnershipHeader = { id: string; number: number; clientId: string; clientName: string; service: 'CHANGE_OWNER'; comment: string | null; status: 'DRAFT' | 'DONE'; completionAt: string | null; containerQuantity: number }
export type OwnershipContainer = { id: string | null; containerOwnerId: string; containerId: string; containerName: string; containerType: string; clientId: string; clientName: string; status: string }
export type OwnershipDetails = { order: OwnershipHeader; containers: OwnershipContainer[] }
export function historyOrderPath(row: Pick<OwnerHistory, 'orderId' | 'orderType'>) {
  return (row.orderType === 'RECEIVING_ORDER' ? '/receiving-orders/' : row.orderType === 'SHIPPING_ORDER' ? '/shipping-orders/' : '/service-orders/') + row.orderId
}

export type ContainerStockLookup = { containerId: string; ownerClientId?: string | null; ownerClientName?: string | null; status?: string | null }
