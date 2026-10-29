export type BillingCharge = {
  id: string; performedAt: string; clientName: string; contractName: string
  serviceOrderId: string; serviceOrderCode: number; containerName: string; serviceName: string; family: string
  receivingOrderId: string; receivingOrderCode: number; shippingOrderId: string; shippingOrderCode: number
  amountWithoutVat: number; amountWithVat: number; currency: string
}
export type BillingChargePage = {
  items: BillingCharge[]; totalWithoutVat: number; totalWithVat: number; total: number; page: number; size: number
}
