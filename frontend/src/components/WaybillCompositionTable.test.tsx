import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WaybillCompositionTable, type CompositionWaybill } from './WaybillCompositionTable'
import { toSelectedWaybill } from '../orderForm'
import type { GroupedWaybill } from '../domain'

const container = { containerId: 'c1', number: 'TEST0000001', grossWeight: 3200, tareWeight: 3200, netWeight: 0 }
const bill: CompositionWaybill = {
  id: 'b1', number: '12345', departureStation: 1001, destinationStation: 2001,
  railwayCarriages: [{ id: 'w1', number: '91635193', containers: [container] }],
  products: [{ id: 'p1', etsngCodeId: 'e1', etsngCode: '011005 — Пшеница', weight: null }],
}

describe('Состав накладных в заявке', () => {
  it('сохраняет связь накладная → вагон → КТК при выборе для создания', () => {
    const group: GroupedWaybill = {
      groupKey: 'g1', departureStation: 1001, destinationStation: 2001, payer: 'ФИТ', products: [],
      railwayCarriageCount: 1, containerCount: 1, waybillCount: 1,
      waybills: [{ id: 'b1', number: '12345', railwayCarriageCount: 1, containerCount: 1, products: [],
        containers: [container], railwayCarriages: bill.railwayCarriages }],
    }
    const selected = toSelectedWaybill(group, group.waybills[0])
    expect(selected.railwayCarriages?.[0].containers[0].containerId).toBe('c1')
    const html = renderToStaticMarkup(<WaybillCompositionTable waybills={[selected]} tab="containers" draft />)
    expect(html.indexOf('Накладная № 12345')).toBeLessThan(html.indexOf('Вагон № 91635193'))
    expect(html.indexOf('Вагон № 91635193')).toBeLessThan(html.indexOf('TEST0000001'))
    expect(html).not.toContain('Масса груза, кг')
    expect(html).toContain('Грузоподъёмность, кг')
  })
  it('не объединяет одинаковый груз из разных накладных и сохраняет неизвестную массу', () => {
    const html = renderToStaticMarkup(<WaybillCompositionTable waybills={[bill, { ...bill, id: 'b2', number: '67890' }]} tab="cargo" />)
    expect(html.match(/>Пшеница</g)).toHaveLength(2)
    expect(html.match(/>Не указана</g)).toHaveLength(2)
    expect(html).toContain('Накладная № 12345')
    expect(html).toContain('Накладная № 67890')
  })
  it('показывает существующий счётчик, когда старый ответ API ещё не содержит детализацию', () => {
    const html = renderToStaticMarkup(<WaybillCompositionTable waybills={[{ ...bill, railwayCarriages: undefined, railwayCarriageCount: 3 }]} tab="wagons" draft />)
    expect(html).toContain('Вагонов: 3. Детальный состав недоступен.')
    expect(html).not.toContain('Вагонов нет')
  })
})

it('shows capacity, type and gross weight, and cargo hazard without net weight', () => {
  const fixture: CompositionWaybill = { ...bill, railwayCarriages: [{ id: 'w1', number: '91635193', containers: [{ ...container, type: 'STANDARD_40', loadCapacity: 25000 }] }], products: [{ id: 'p', etsngCodeId: 'e', code: '011005', name: 'Пшеница', weight: 1800, grossWeight: 5000, hazardClassName: 'TEST HAZARD' }] }
  const containers = renderToStaticMarkup(<WaybillCompositionTable waybills={[fixture]} tab="containers" />)
  expect(containers).toContain('Стандартный 40')
  expect(containers).toContain('Грузоподъёмность, кг')
  expect(containers).not.toContain('Масса груза')
  const cargo = renderToStaticMarkup(<WaybillCompositionTable waybills={[fixture]} tab="cargo" />)
  expect(cargo).toContain('TEST HAZARD')
  expect(cargo).toContain('Масса брутто, кг')
  expect(cargo).not.toContain('1 800')
})
