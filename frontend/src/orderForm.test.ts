import { describe, expect, it } from 'vitest'
import type { OrderFormState, SelectedContainer, SelectedWaybill } from './orderForm'
import type { GroupedWaybill, ReferenceOption, TerminalAreaOption, TransportTypeOption } from './domain'
import { transportTypeLabel } from './domain'
import {
  buildPayload,
  canAddWaybill,
  filterTransportTypes,
  findContainerArea,
  initialOrderFormState,
  setContainerCargo,
  setContainerEmpty,
  selectedWaybillTotals,
  setVehicleShippingMode,
  toSelectedWaybill,
  toggleContainer,
  validateStep,
} from './orderForm'

const coal = { id: 'product-1', etsngCodeId: 'etsng-1', code: '211009', name: 'Уголь', weight: 666 }
const metal = { id: 'product-2', etsngCodeId: 'etsng-2', code: '324116', name: 'Металлопрокат', weight: null }

const groupedWaybill: GroupedWaybill = {
  groupKey: '1001|2001|payer',
  departureStation: 1001,
  destinationStation: 2001,
  payer: 'payer',
  products: [coal, metal],
  railwayCarriageCount: 2,
  containerCount: 2,
  waybillCount: 2,
  waybills: [
    { id: 'waybill-1', number: '1743125934', railwayCarriageCount: 1, containerCount: 1, products: [coal] },
    { id: 'waybill-2', number: '1743125935', railwayCarriageCount: 1, containerCount: 1, products: [metal] },
  ],
}

const container: ReferenceOption = { id: 'container-1', name: 'KTK-0001' }
const waybill: SelectedWaybill = {
  id: 'waybill-1',
  number: 'НКЛ-001',
  groupKey: '1001|2001|ФИТ',
  departureStation: 1001,
  destinationStation: 2001,
  payer: 'ФИТ',
  railwayCarriageCount: 2,
  containerCount: 4,
  products: [],
}

function validMainState(transportType: 'VEHICLE' | 'RAILWAY' = 'VEHICLE'): OrderFormState {
  return {
    ...initialOrderFormState,
    clientId: 'client-1',
    contractId: 'contract-1',
    terminalAreaId: 'area-from-api',
    transportType,
  }
}

describe('order dates and cargo parties', () => {
  const metadata = {
    arrivalAt: '2026-10-29T10:45', consignor: '  ООО Отправитель  ',
    departureAt: '2026-10-30T15:20', consignee: '  ООО Получатель  ',
  }

  it('sends receiving fields without shifting the local time or leaking shipping fields', () => {
    const payload = buildPayload({ ...validMainState(), ...metadata }, 'receiving')
    expect(payload).toMatchObject({ arrivalAt: '2026-10-29T10:45', consignor: 'ООО Отправитель' })
    expect(payload).not.toHaveProperty('departureAt')
    expect(payload).not.toHaveProperty('consignee')
  })

  it('sends shipping fields for railway as well as vehicle orders', () => {
    for (const transport of ['VEHICLE', 'RAILWAY'] as const) {
      const payload = buildPayload({ ...validMainState(transport), ...metadata }, 'shipping')
      expect(payload).toMatchObject({ departureAt: '2026-10-30T15:20', consignee: 'ООО Получатель' })
      expect(payload).not.toHaveProperty('arrivalAt')
      expect(payload).not.toHaveProperty('consignor')
    }
  })

  it('keeps the previous payload when optional fields are empty', () => {
    for (const kind of ['receiving', 'shipping'] as const) {
      const payload = buildPayload({ ...validMainState(), consignor: '  ', consignee: '  ' }, kind)
      for (const field of ['arrivalAt', 'consignor', 'departureAt', 'consignee']) {
        expect(payload).not.toHaveProperty(field)
      }
    }
  })
})

function withLoadedContainer(state: OrderFormState): OrderFormState {
  let next = toggleContainer(state, container)
  next = setContainerCargo(next, container.id, 'etsngCodeId', 'cargo-1')
  return setContainerCargo(next, container.id, 'weight', '24500.125')
}

describe('order form state', () => {
  it('selects the container area by code instead of a hardcoded UUID', () => {
    const areas: TerminalAreaOption[] = [
      { id: 'warehouse-id', code: 'WAREHOUSE', name: 'Склад' },
      { id: 'api-container-id', code: 'CONTAINER', name: 'Контейнерная площадка' },
    ]

    expect(findContainerArea(areas)).toEqual(areas[1])
    expect(findContainerArea(areas)?.id).toBe('api-container-id')
  })

  it('keeps only Auto and Railway transport options', () => {
    const options = [
      { value: 'VEHICLE', name: 'Авто' },
      { value: 'RAILWAY', name: 'ЖД' },
    ] satisfies TransportTypeOption[]

    expect(filterTransportTypes(options)).toEqual(options)
    expect(transportTypeLabel('VEHICLE')).toBe('Авто')
    expect(transportTypeLabel('RAILWAY')).toBe('ЖД')
  })

  it('requires client, terminal area and transport on the main step', () => {
    expect(validateStep(initialOrderFormState, 1)).toEqual([
      'Выберите клиента',
      'Выберите договор',
      'Контейнерная площадка недоступна',
      'Выберите тип транспорта',
    ])
  })

  it('supports both transport types and keeps values between steps', () => {
    const vehicle = withLoadedContainer(validMainState('VEHICLE'))
    const railway = { ...validMainState('RAILWAY'), waybills: [waybill] }

    expect(validateStep(vehicle, 3)).toEqual([])
    expect(validateStep(railway, 2)).toEqual([])
    expect(railway.terminalAreaId).toBe('area-from-api')
    expect(railway.transportType).toBe('RAILWAY')
  })

  it('clears cargo when a container becomes empty', () => {
    let state = withLoadedContainer(validMainState())
    state = setContainerEmpty(state, container.id, true)

    expect(state.containers[0]).toMatchObject({ empty: true, etsngCodeId: '', weight: '' })
    expect(validateStep(state, 3)).toEqual([])
  })

  it('switches vehicle shipping to the unnumbered mode and clears numbered data', () => {
    const numbered = withLoadedContainer(validMainState('VEHICLE'))
    const unnumbered = setVehicleShippingMode(numbered, 'UNNUMBERED')

    expect(unnumbered.fillingType).toBe('VEHICLE_UNNUMBERED')
    expect(unnumbered.containers).toEqual([])
    expect(unnumbered.containerQuantities).toEqual([{
      key: 1,
      quantity: '',
      type: '',
      empty: true,
      items: [],
    }])
    expect(validateStep(unnumbered, 2, 'shipping')).toContain('Выберите типоразмер КТК')

    const numberedAgain = setVehicleShippingMode({
      ...unnumbered,
      containerQuantities: [{ ...unnumbered.containerQuantities[0], type: 'STANDARD_40' }],
    }, 'NUMBERED')
    expect(numberedAgain.fillingType).toBe('ALL')
    expect(numberedAgain.containerQuantities).toEqual([])
  })

  it('builds an unnumbered vehicle shipping payload without KTK number or cargo', () => {
    const state = {
      ...setVehicleShippingMode(validMainState('VEHICLE'), 'UNNUMBERED'),
      containerQuantities: [{
        key: 1,
        quantity: '3',
        type: 'STANDARD_40' as const,
        empty: true,
        items: [],
      }],
    }

    expect(validateStep(state, 2, 'shipping')).toEqual([])
    expect(buildPayload(state, 'shipping')).toMatchObject({
      transportType: 'VEHICLE',
      fillingType: 'VEHICLE_UNNUMBERED',
      containers: [],
      railwayCarriages: [],
      railwayCarriageQuantities: [],
      containerQuantities: [{
        quantity: 3,
        type: 'STANDARD_40',
        empty: true,
        items: [],
      }],
    })
  })

  it('validates containers, cargo and positive weight', () => {
    let state = validMainState()
    expect(validateStep(state, 2)).toContain('Выберите хотя бы один КТК')
    state = toggleContainer(state, container)
    state = setContainerCargo(state, container.id, 'etsngCodeId', 'cargo-1')
    state = setContainerCargo(state, container.id, 'weight', '0')

    expect(validateStep(state, 3).join(' ')).toContain('положительную массу')
  })

  it('includes terminal area and transport in payload', () => {
    let state = withLoadedContainer(validMainState('VEHICLE'))
    const emptyContainer: SelectedContainer = {
      id: 'container-2',
      name: 'KTK-0002',
      empty: true,
      etsngCodeId: '',
      weight: '',
    }
    state = { ...state, containers: [...state.containers, emptyContainer] }

    expect(buildPayload(state)).toEqual({
      clientId: 'client-1',
    contractId: 'contract-1',
      terminalAreaId: 'area-from-api',
      transportType: 'VEHICLE',
      containers: [
        {
          containerId: 'container-1',
          empty: false,
          cargo: { etsngCodeId: 'cargo-1', weight: 24500.125 },
        },
        { containerId: 'container-2', empty: true, cargo: null },
      ],
      waybillIds: [],
      railwayCarriages: [],
      fillingType: 'ALL',
      railwayCarriageQuantities: [],
      containerQuantities: [],
    })
  })

  it('builds a railway payload without manual containers', () => {
    const state = {
      ...validMainState('RAILWAY'),
      containers: [withLoadedContainer(validMainState()).containers[0]],
      waybills: [waybill],
    }

    expect(buildPayload(state)).toEqual({
      clientId: 'client-1',
    contractId: 'contract-1',
      terminalAreaId: 'area-from-api',
      transportType: 'RAILWAY',
      containers: [],
      waybillIds: ['waybill-1'],
      railwayCarriages: [],
      fillingType: 'ALL',
      railwayCarriageQuantities: [],
      containerQuantities: [],
    })
  })

  it('validates and builds a nested railway shipping payload', () => {
    const loaded: SelectedContainer = {
      id: 'container-1',
      name: 'TKRU4468123',
      empty: false,
      etsngCodeId: 'cargo-1',
      weight: '24500.125',
    }
    const empty: SelectedContainer = {
      id: 'container-2',
      name: 'AKMU4002966',
      empty: true,
      etsngCodeId: '',
      weight: '',
    }
    const state: OrderFormState = {
      ...validMainState('RAILWAY'),
      railwayCarriages: [
        { key: 1, railwayCarriageId: 'carriage-1', containers: [loaded, empty] },
        { key: 2, railwayCarriageId: 'carriage-2', containers: [{ ...loaded, id: 'container-3', name: 'TKRU4694223' }] },
      ],
    }

    expect(validateStep(state, 4, 'shipping')).toEqual([])
    expect(buildPayload(state, 'shipping')).toEqual({
      clientId: 'client-1',
    contractId: 'contract-1',
      terminalAreaId: 'area-from-api',
      transportType: 'RAILWAY',
      containers: [],
      waybillIds: [],
      railwayCarriages: [
        {
          railwayCarriageId: 'carriage-1',
          containers: [
            { containerId: 'container-1', empty: false, cargo: { etsngCodeId: 'cargo-1', weight: 24500.125 } },
            { containerId: 'container-2', empty: true, cargo: null },
          ],
        },
        {
          railwayCarriageId: 'carriage-2',
          containers: [
            { containerId: 'container-3', empty: false, cargo: { etsngCodeId: 'cargo-1', weight: 24500.125 } },
          ],
        },
      ],
      fillingType: 'ALL',
      railwayCarriageQuantities: [],
      containerQuantities: [],
    })
  })

  it('builds RAILWAY_CARRIAGE with numbered wagons and container quantities', () => {
    const state: OrderFormState = {
      ...validMainState('RAILWAY'),
      fillingType: 'RAILWAY_CARRIAGE',
      railwayCarriages: [{ key: 1, railwayCarriageId: 'carriage-1', containers: [] }],
      containerQuantities: [{
        key: 1,
        quantity: '2',
        type: 'STANDARD_40',
        empty: false,
        items: [{ key: 1, etsngCodeId: 'cargo-1', weight: '30000.000' }],
      }],
    }

    expect(validateStep(state, 4, 'shipping')).toEqual([])
    expect(buildPayload(state, 'shipping')).toMatchObject({
      fillingType: 'RAILWAY_CARRIAGE',
      containers: [],
      railwayCarriages: [{ railwayCarriageId: 'carriage-1', containers: [] }],
      railwayCarriageQuantities: [],
      containerQuantities: [{
        quantity: 2,
        type: 'STANDARD_40',
        empty: false,
        items: [{ etsngCodeId: 'cargo-1', weight: 30000 }],
      }],
    })
  })

  it('builds CONTAINER with carriage quantities and numbered containers', () => {
    const state: OrderFormState = {
      ...withLoadedContainer(validMainState('RAILWAY')),
      fillingType: 'CONTAINER',
      railwayCarriageQuantities: [{ key: 1, quantity: '4', typeId: '' }],
    }

    expect(validateStep(state, 4, 'shipping')).toEqual([])
    expect(buildPayload(state, 'shipping')).toMatchObject({
      fillingType: 'CONTAINER',
      containers: [{ containerId: 'container-1' }],
      railwayCarriages: [],
      railwayCarriageQuantities: [{ quantity: 4, typeId: null }],
      containerQuantities: [],
    })
  })

  it('builds NONE and rejects invalid quantity or missing cargo', () => {
    const invalid: OrderFormState = {
      ...validMainState('RAILWAY'),
      fillingType: 'NONE',
      railwayCarriageQuantities: [{ key: 1, quantity: '0', typeId: '' }],
      containerQuantities: [{ key: 1, quantity: '1', type: 'STANDARD_20', empty: false, items: [] }],
    }
    expect(validateStep(invalid, 2, 'shipping').join(' ')).toContain('больше нуля')
    expect(validateStep(invalid, 2, 'shipping').join(' ')).not.toContain('Добавьте груз')
    expect(validateStep(invalid, 4, 'shipping').join(' ')).toContain('Добавьте груз')

    const valid: OrderFormState = {
      ...invalid,
      railwayCarriageQuantities: [{ key: 1, quantity: '3', typeId: '' }],
      containerQuantities: [{ key: 1, quantity: '1', type: 'STANDARD_20', empty: true, items: [] }],
    }
    expect(validateStep(valid, 4, 'shipping')).toEqual([])
    expect(buildPayload(valid, 'shipping')).toMatchObject({
      fillingType: 'NONE',
      railwayCarriageQuantities: [{ quantity: 3, typeId: null }],
      containerQuantities: [{ quantity: 1, type: 'STANDARD_20', empty: true, items: [] }],
    })
  })

  it('rejects duplicate or unselected KTK in railway shipping', () => {
    const duplicate: SelectedContainer = {
      id: 'container-1',
      name: 'TKRU4468123',
      empty: true,
      etsngCodeId: '',
      weight: '',
    }
    const state: OrderFormState = {
      ...validMainState('RAILWAY'),
      railwayCarriages: [
        { key: 1, railwayCarriageId: 'carriage-1', containers: [duplicate] },
        {
          key: 2,
          railwayCarriageId: 'carriage-2',
          containers: [duplicate, { ...duplicate, id: '', name: '' }],
        },
      ],
    }

    expect(validateStep(state, 2, 'shipping')).toEqual([])
    const errors = validateStep(state, 3, 'shipping').join(' ')
    expect(errors).toContain('уже выбран на другом вагоне')
    expect(errors).toContain('Выберите КТК 2 на вагоне 2')
  })

  it('validates railway shipping entities on their sequential steps', () => {
    const state: OrderFormState = {
      ...validMainState('RAILWAY'),
      railwayCarriages: [{
        key: 1,
        railwayCarriageId: 'carriage-1',
        containers: [{ id: '', name: '', empty: false, etsngCodeId: '', weight: '' }],
      }],
    }

    expect(validateStep(state, 2, 'shipping')).toEqual([])
    expect(validateStep(state, 3, 'shipping')).toContain('Выберите КТК 1 на вагоне 1')

    const selected: OrderFormState = {
      ...state,
      railwayCarriages: [{
        ...state.railwayCarriages[0],
        containers: [{ id: 'container-1', name: 'TKRU4468123', empty: false, etsngCodeId: '', weight: '' }],
      }],
    }
    expect(validateStep(selected, 3, 'shipping')).toEqual([])
    expect(validateStep(selected, 4, 'shipping').join(' ')).toContain('Выберите груз')
  })

  it('allows waybills only from one group and counts their composition', () => {
    const sameGroup = { ...waybill, id: 'waybill-2', number: 'НКЛ-002', railwayCarriageCount: 1, containerCount: 2 }
    const otherGroup = { ...waybill, id: 'waybill-3', groupKey: '1002|2001|ФИТ' }

    expect(canAddWaybill([waybill], sameGroup)).toBe(true)
    expect(canAddWaybill([waybill], otherGroup)).toBe(false)
    expect(selectedWaybillTotals([waybill, sameGroup])).toEqual({
      waybills: 2,
      railwayCarriages: 3,
      containers: 6,
    })
  })

  it('keeps only the products of the selected waybill', () => {
    const selected = toSelectedWaybill(groupedWaybill, groupedWaybill.waybills[0])

    expect(selected.products).toEqual([coal])
    expect(selected.products).not.toContain(metal)
  })
})

describe('contract selection', () => {
  it('requires a contract before leaving the main step', () => {
    expect(validateStep({ ...validMainState(), contractId: '' }, 1)).toEqual(['Выберите договор'])
  })
  it('submits the selected contract without removed vehicle details', () => {
    const payload = buildPayload(withLoadedContainer(validMainState()))
    expect(payload.contractId).toBe('contract-1')
    expect(payload).not.toHaveProperty('driverFullName')
    expect(payload).not.toHaveProperty('vehicleNumber')
  })
})
