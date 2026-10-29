import type { CreatedOrder, OrderDetails } from './domain'

export type ContractOption = { id: string; clientId: string; name: string }
export type ServiceOrderSummary = {
  id: string; code: number; clientId: string; clientName: string
  contractId: string; contractName: string; status: string; shippingOrderCount: number
}
export type ServiceOrderDetails = {
  order: ServiceOrderSummary; receivingOrder: OrderDetails; shippingOrders: Array<CreatedOrder & { containerNames: string[]; returnReceivingOrderId: string | null }>; selectableContainers: Array<{ containerId: string; containerName: string; type: string }>; returnOrders: Array<{ id: string; code: number; status: string; containerNames: string[] }>
}
