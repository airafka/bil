import { describe, expect, it } from 'vitest'
import { validateServiceWaybills } from './serviceWaybillValidation'

const services = [
  { id: 'wagon', name: 'Повагонная услуга', minWaybillContainers: 1, maxWaybillContainers: 39 },
  { id: 'train', name: 'Услуга в составе поезда', minWaybillContainers: 40 },
]
const bill = (containerCount: number) => ({ number: String(containerCount), containerCount })
describe('service selection per waybill', () => {
  it.each([39, 40, 41])('validates the boundary at %s containers', count => {
    const accepted = count < 40 ? 'wagon' : 'train'
    const rejected = count < 40 ? 'train' : 'wagon'
    expect(validateServiceWaybills(services, accepted, [bill(count)])).toEqual([])
    const errors = validateServiceWaybills(services, rejected, [bill(count)])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(services.find(service => service.id === accepted)!.name)
    expect(errors[0]).toContain(count + ' КТК')
  })
  it('checks each waybill, without adding their container counts', () => {
    expect(validateServiceWaybills(services, 'wagon', [bill(20), bill(20)])).toEqual([])
    expect(validateServiceWaybills(services, 'train', [bill(20), bill(20)])).toHaveLength(2)
    expect(validateServiceWaybills(services, 'train', [bill(39), bill(40)])).toHaveLength(1)
    expect(validateServiceWaybills(services, 'wagon', [bill(39), bill(40)])).toHaveLength(1)
  })
  it('uses catalog limits and current names, not hardcoded service titles', () => {
    expect(validateServiceWaybills(services.map(s => ({...s, name: 'Новое имя ' + s.id})), 'wagon', [bill(40)])[0]).toContain('Новое имя train')
  })
})
