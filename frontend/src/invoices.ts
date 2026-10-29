export type InvoiceFilters = { clientId: string; contractId: string; period: string }
export type InvoiceLine = {
  id: string; performedAt: string; serviceOrderId: string; serviceOrderCode: number
  containerName: string; serviceName: string; amountWithoutVat: number; amountWithVat: number
}
export type PaymentInvoice = InvoiceFilters & {
  id: string; code: number; clientName: string; contractName: string; timeZone: string
  status: 'DRAFT'; currency: string; amountWithoutVat: number; amountWithVat: number; createdAt: string
}
export type InvoiceDetails = { invoice: PaymentInvoice; items: InvoiceLine[] }
export type InvoiceCandidates = { items: InvoiceLine[]; timeZone: string }

export const invoiceMoney = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const invoiceDate = (value: string, timeZone: string) => new Date(value).toLocaleDateString('ru-RU', { timeZone })
export const invoicePeriod = (period: string) => new Date(`${period}-01T12:00:00Z`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function selectedInvoiceTotals(items: InvoiceLine[], selected: Set<string>) {
  // Sum displayed decimal amounts in kopecks; authoritative totals are calculated by the server.
  let withoutVat = 0, withVat = 0, count = 0
  for (const item of items) if (selected.has(item.id)) {
    withoutVat += Math.round(item.amountWithoutVat * 100)
    withVat += Math.round(item.amountWithVat * 100)
    count++
  }
  return { count, withoutVat: withoutVat / 100, withVat: withVat / 100, vat: (withVat - withoutVat) / 100 }
}
