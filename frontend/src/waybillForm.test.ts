import { describe, expect, it } from 'vitest'
import { buildWaybillPayload, initialWaybillFormState, netWeight, selectWaybillContainer, validateWaybillStep, type WaybillFormState } from './waybillForm'

const row = { containerId: 'container-1', grossWeight: '25000,125', tareWeight: 3200, etsngCodeId: 'cargo-1' }
const state: WaybillFormState = { ...initialWaybillFormState, etsngCodeId: 'cargo-1', departureStation: '100', destinationStation: '200', payer: ' P ', railwayCarriages: [{ key: 1, railwayCarriageId: 'carriage-1', containers: [row] }] }
describe('waybill masses', () => {
  it('sends the selected dangerous product separately from the source danger text', () => {
    const payload = buildWaybillPayload({ ...state, products: [{ etsngCodeId: 'cargo-1', weight: '1500', dangerProductId: 'danger-product', signDanger: '  Исходный текст  ' }] })
    expect(payload.products[0]).toEqual({ etsngCodeId: 'cargo-1', weight: '1500', dangerProductId: 'danger-product', signDanger: 'Исходный текст' })
    expect(payload.products[0]).not.toHaveProperty('hazardClassId')
  })

  it('sends the source owner as text without a client identifier', () => {
    const payload = buildWaybillPayload({ ...state, railwayCarriages: [{ ...state.railwayCarriages[0], containers: [{ ...row, owner: '  Произвольный собственник  ' }] }] })
    expect(payload.railwayCarriages[0].containers[0]).toHaveProperty('owner', 'Произвольный собственник')
    expect(payload.railwayCarriages[0].containers[0]).not.toHaveProperty('ownerClientId')
  })
  it('sends a manually entered number and leaves automatic numbering available', () => {
    expect(buildWaybillPayload({ ...state, number: '  AB-123  ' }).number).toBe('AB-123')
    expect(buildWaybillPayload(state).number).toBeUndefined()
  })
  it('keeps explicit net independent of the current reference tare', () => {
    expect(netWeight({ ...row, netWeightValue: '1500', tareWeight: 9999 })).toBe('1500.000')
    expect(netWeight({ ...row, netWeightValue: '30000' })).toBeNull()
  })
  it('permits several products only for one container', () => {
    const products = [{ etsngCodeId: 'cargo-1', weight: '600' }, { etsngCodeId: 'cargo-2', weight: '900' }]
    expect(validateWaybillStep({ ...state, products }, 4)).toEqual([])
    const two = { ...state, products, railwayCarriages: [{ ...state.railwayCarriages[0], containers: [row, { ...row, containerId: 'other' }] }] }
    expect(validateWaybillStep(two, 4).join()).toContain('ровно один КТК')
  })
  it('subtracts tare precisely including fractional kilograms', () => {
    expect(netWeight(row)).toBe('21800.125')
    expect(netWeight({ ...row, grossWeight: '3200.001' })).toBe('0.001')
    expect(netWeight({ ...row, grossWeight: '3200' })).toBe('0.000')
  })
  it('rejects gross below tare and excessive decimal precision', () => {
    for (const grossWeight of ['3199.999', '', '3200.0001', '-1', 'abc']) {
      expect(validateWaybillStep({ ...state, railwayCarriages: [{ ...state.railwayCarriages[0], containers: [{ ...row, grossWeight }] }] }, 3).length).toBeGreaterThan(0)
    }
  })
  it('requires cargo on the cargo step including empty waybills', () => {
    const withoutCargo = { ...state, etsngCodeId: '', railwayCarriages: [{ ...state.railwayCarriages[0], containers: [row] }] }
    expect(validateWaybillStep(withoutCargo, 3)).toEqual([])
    expect(validateWaybillStep(withoutCargo, 4).join()).toContain('выберите груз')
    expect(validateWaybillStep({ ...state, railwayCarriages: [{ ...state.railwayCarriages[0], containers: [{ ...row, grossWeight: '3200' }] }] }, 4)).toEqual([])
  })
  it('sends precise gross, frozen net and waybill products', () => {
    const payload = buildWaybillPayload(state)
    expect(payload.railwayCarriages[0].containers[0]).toEqual({ containerId: 'container-1', grossWeight: '25000.125', netWeight: '21800.125' })
    expect(payload.products).toEqual([{ etsngCodeId: 'cargo-1', weight: '21800.125' }])
    expect(payload.payer).toBe('P')
  })
  it('sends one waybill cargo and preserves individual gross weights', () => {
    const payload = buildWaybillPayload({ ...state, railwayCarriages: [{ ...state.railwayCarriages[0], containers: [row, { ...row, containerId: 'container-2', grossWeight: '7000' }] }] })
    expect(payload.railwayCarriages[0].containers.map(item => item.grossWeight)).toEqual(['25000.125', '7000'])
    expect(payload.products[0].etsngCodeId).toBe('cargo-1')
    expect(payload.railwayCarriages[0].containers.every(item => !('etsngCodeId' in item))).toBe(true)
  })
  it('preserves the mandatory cargo after every KTK becomes empty', () => {
    const empty = { ...state, railwayCarriages: [{ ...state.railwayCarriages[0], containers: [{ ...row, grossWeight: '3200' }] }] }
    expect(buildWaybillPayload(empty).products).toEqual([{ etsngCodeId: 'cargo-1', weight: '0.000' }])
    expect(validateWaybillStep(empty, 4)).toEqual([])
  })
  it('loads tare from the selected reference', () => {
    expect(selectWaybillContainer(row, { id: 'other', name: 'Other', tareWeight: 3400 }).tareWeight).toBe(3400)
  })
  it('rejects duplicate KTK across wagons', () => {
    expect(validateWaybillStep({ ...state, railwayCarriages: [...state.railwayCarriages, { key: 2, railwayCarriageId: 'carriage-2', containers: [row] }] }, 4)).toContain('КТК не может повторяться в накладной')
  })
})
