import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReceivingContainerAttributes } from './ReceivingContainerAttributes'
import { OrderStatusAction } from './OrderStatusAction'
import { historyOrderPath } from '../containerStock'

describe('учёт собственников и ручные движения', () => {
  it('показывает собственника вывоза без возможности выбрать другого клиента', () => {
    const html = renderToStaticMarkup(<ReceivingContainerAttributes ownerReadOnly containers={[{ id: 'c', name: 'KTK', ownerClientId: 'owner', ownerClientName: 'Текущий собственник' }]} onChange={() => {}} />)
    expect(html).toContain('Текущий собственник')
    expect(html).not.toContain('aria-label="Собственник КТК — KTK"')
    expect(html).toContain('aria-label="Тип ЗПУ — KTK"')
  })
  it('подтверждение транспортных заявок доступно только через рейс', () => {
    for (const apiPath of ['/api/receiving-orders', '/api/shipping-orders']) {
      expect(renderToStaticMarkup(<OrderStatusAction apiPath={apiPath} id="test" status="DRAFT" onChanged={() => {}} />)).not.toContain('<button')
      expect(renderToStaticMarkup(<OrderStatusAction apiPath={apiPath} id="test" status="COMPLETED" onChanged={() => {}} />)).not.toContain('<button')
    }
  })
  it('предлагает вручную завершить разгрузку и погрузку подтверждённых заявок', () => {
    expect(renderToStaticMarkup(<OrderStatusAction apiPath="/api/receiving-orders" id="r" status="CONFIRMED" onChanged={() => {}} />)).toContain('Выполнить')
    expect(renderToStaticMarkup(<OrderStatusAction apiPath="/api/shipping-orders" id="s" status="CONFIRMED" onChanged={() => {}} />)).toContain('Выполнить')
  })
  it('открывает для истории SERVICE_ORDER процесс смены собственника', () => {
    expect(historyOrderPath({ orderId: 'id', orderType: 'SERVICE_ORDER' })).toBe('/service-orders/id')
  })
})
