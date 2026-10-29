import { describe, expect, it } from 'vitest'
import type { InvoiceLine } from './invoices'
import { invoiceDate, invoicePeriod, selectedInvoiceTotals } from './invoices'

const lines: InvoiceLine[] = [
  { id: 'charge-1', performedAt: '2026-05-02T10:00:00Z', serviceOrderId: 's1', serviceOrderCode: 1, containerName: 'SAME1234567', serviceName: 'Первая услуга', amountWithoutVat: 0.1, amountWithVat: 0.12 },
  { id: 'charge-2', performedAt: '2026-05-02T10:00:00Z', serviceOrderId: 's1', serviceOrderCode: 1, containerName: 'SAME1234567', serviceName: 'Вторая услуга', amountWithoutVat: 0.2, amountWithVat: 0.24 },
]
describe('payment invoice selection', () => {
  it('selects charges individually even when the container and service order are the same', () => {
    expect(selectedInvoiceTotals(lines, new Set(['charge-2']))).toEqual({ count: 1, withoutVat: 0.2, withVat: 0.24, vat: 0.04 })
    expect(selectedInvoiceTotals(lines, new Set(['charge-1', 'charge-2']))).toEqual({ count: 2, withoutVat: 0.3, withVat: 0.36, vat: 0.06 })
  })
  it('ignores ids absent from the refreshed candidate list', () => {
    expect(selectedInvoiceTotals(lines, new Set(['reserved-charge']))).toEqual({ count: 0, withoutVat: 0, withVat: 0, vat: 0 })
  })
  it('uses the billing time zone at midnight and month boundaries', () => {
    expect(invoiceDate('2026-04-30T21:15:00Z', 'Europe/Moscow')).toBe('01.05.2026')
    expect(invoiceDate('2026-05-31T20:59:59Z', 'Europe/Moscow')).toBe('31.05.2026')
    expect(invoiceDate('2026-05-31T21:00:00Z', 'Europe/Moscow')).toBe('01.06.2026')
    expect(invoicePeriod('2026-05')).toContain('май')
  })
})
