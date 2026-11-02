import { describe, expect, it } from 'vitest'
import { buildPayload, initialOrderFormState } from './orderForm'
import { buildWaybillPayload, initialWaybillFormState } from './waybillForm'

describe('Container attributes', () => {
  it('preserves seal numbers including leading zeros in receiving and shipping', () => {
    const attributes = { ownerClientId: 'owner', sealNumbers: '  0001, 0023  ', sealTypeId: 'seal', hazardClassId: 'hazard' }
    const form = { ...initialOrderFormState, transportType: 'VEHICLE' as const,
      containers: [{ id: 'c', name: 'KTK', empty: true, etsngCodeId: '', weight: '', ...attributes }] }
    expect(buildPayload(form).containers[0]).toMatchObject({ ...attributes, sealNumbers: '0001, 0023', cargo: null })
    expect(buildPayload(form, 'shipping').containers[0]).toHaveProperty('ownerClientId', 'owner')
    expect(buildPayload(form, 'shipping').containers[0]).toHaveProperty('sealNumbers', '0001, 0023')
  })
  it('keeps distinct attributes per waybill container and the common cargo', () => {
    const form = { ...initialWaybillFormState, etsngCodeId: 'cargo', railwayCarriages: [{ key: 1, railwayCarriageId: 'w', containers: [
      { containerId: 'c1', grossWeight: '5000', tareWeight: 3200, owner: 'Владелец из накладной', sealNumbers: '  001  ', sealTypeId: 'seal' },
      { containerId: 'c2', grossWeight: '3200', tareWeight: 3200, owner: 'Произвольное название' },
    ] }] }
    const result = buildWaybillPayload(form)
    expect(result.products[0].etsngCodeId).toBe('cargo')
    expect(result.railwayCarriages[0].containers).toEqual([
      { containerId: 'c1', grossWeight: '5000', netWeight: '1800.000', owner: 'Владелец из накладной', sealNumbers: '001', sealTypeId: 'seal' },
      { containerId: 'c2', grossWeight: '3200', netWeight: '0.000', owner: 'Произвольное название' },
    ])
  })
})
