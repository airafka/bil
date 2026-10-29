import { describe, expect, it } from 'vitest'
import { buildWaybillPayload, initialWaybillFormState, netWeight, selectWaybillContainer, validateWaybillStep, type WaybillFormState } from './waybillForm'

const row = { containerId: 'container-1', grossWeight: '25000,125', tareWeight: 3200, etsngCodeId: 'cargo-1' }
const state: WaybillFormState = { ...initialWaybillFormState, etsngCodeId: 'cargo-1', departureStation: '100', destinationStation: '200', payer: ' P ', railwayCarriages: [{ key: 1, railwayCarriageId: 'carriage-1', containers: [row] }] }
describe('waybill masses', () => {
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
  it('requires cargo only on the cargo step and only for loaded containers', () => {
    const withoutCargo = { ...state, etsngCodeId: '', railwayCarriages: [{ ...state.railwayCarriages[0], containers: [{ ...row, etsngCodeId: '' }] }] }
    expect(validateWaybillStep(withoutCargo, 3)).toEqual([])
    expect(validateWaybillStep(withoutCargo, 4).join()).toContain('выберите груз')
    expect(validateWaybillStep({ ...state, railwayCarriages: [{ ...state.railwayCarriages[0], containers: [{ ...row, grossWeight: '3200', etsngCodeId: '' }] }] }, 4)).toEqual([])
  })
  it('sends gross as an exact decimal and omits client-supplied tare/net and manual product weights', () => {
    const payload = buildWaybillPayload(state)
    expect(payload.railwayCarriages[0].containers[0]).toEqual({ containerId: 'container-1', grossWeight: '25000.125', etsngCodeId: 'cargo-1' })
    expect(payload).not.toHaveProperty('products')
    expect(payload.payer).toBe('P')
  })
  it('applies the waybill cargo to every loaded KTK regardless of previous row cargo', () => {
    const payload = buildWaybillPayload({ ...state, railwayCarriages: [{ ...state.railwayCarriages[0], containers: [row, { ...row, containerId: 'container-2', etsngCodeId: 'old-cargo' }] }] })
    expect(payload.railwayCarriages[0].containers.map(item => item.etsngCodeId)).toEqual(['cargo-1', 'cargo-1'])
  })
  it('loads tare from the selected reference', () => {
    expect(selectWaybillContainer(row, { id: 'other', name: 'Other', tareWeight: 3400 }).tareWeight).toBe(3400)
  })
  it('rejects duplicate KTK across wagons', () => {
    expect(validateWaybillStep({ ...state, railwayCarriages: [...state.railwayCarriages, { key: 2, railwayCarriageId: 'carriage-2', containers: [row] }] }, 4)).toContain('КТК не может повторяться в накладной')
  })
})
