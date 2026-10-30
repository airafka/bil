import type {
  ReferenceOption,
  ContainerType,
  FillingType,
  GroupedWaybill,
  OrderKind,
  TerminalAreaOption,
  TransportType,
  TransportTypeOption,
  WaybillLink,
  WaybillProductSummary,
  WaybillContainerSummary,
  WaybillCarriageSummary,
} from './domain'

export type SelectedContainer = import('./domain').ReceivingContainerAttributes & {
  id: string
  name: string
  empty: boolean
  etsngCodeId: string
  weight: string
}

export type SelectedWaybill = {
  containers?: WaybillContainerSummary[]
  railwayCarriages?: WaybillCarriageSummary[]
  id: string
  number: string
  groupKey: string
  departureStation: number
  destinationStation: number
  payer: string
  railwayCarriageCount: number
  containerCount: number
  products: WaybillProductSummary[]
}

export function toSelectedWaybill(group: GroupedWaybill, waybill: WaybillLink): SelectedWaybill {
  return {
    id: waybill.id,
    number: waybill.number,
    groupKey: group.groupKey,
    departureStation: group.departureStation,
    destinationStation: group.destinationStation,
    payer: group.payer,
    railwayCarriageCount: waybill.railwayCarriageCount,
    containerCount: waybill.containerCount,
    products: waybill.products,
    containers: waybill.containers,
    railwayCarriages: waybill.railwayCarriages,
  }
}

export type SelectedRailwayCarriage = {
  key: number
  railwayCarriageId: string
  containers: SelectedContainer[]
}

export type SelectedRailwayCarriageQuantity = {
  key: number
  quantity: string
  typeId: string
}

export type SelectedQuantityCargo = {
  key: number
  etsngCodeId: string
  weight: string
}

export type SelectedContainerQuantity = {
  key: number
  quantity: string
  type: ContainerType | ''
  empty: boolean
  items: SelectedQuantityCargo[]
}

export type OrderFormState = {
  arrivalAt: string
  consignor: string
  departureAt: string
  consignee: string
  contractId: string
  routeId: string
  clientId: string
  terminalAreaId: string
  transportType: TransportType | ''
  containers: SelectedContainer[]
  waybills: SelectedWaybill[]
  railwayCarriages: SelectedRailwayCarriage[]
  fillingType: FillingType
  railwayCarriageQuantities: SelectedRailwayCarriageQuantity[]
  containerQuantities: SelectedContainerQuantity[]
}

export type CreateOrderPayload = {
  arrivalAt?: string
  consignor?: string
  departureAt?: string
  consignee?: string
  routeId?: string
  contractId: string
  clientId: string
  terminalAreaId: string
  transportType: TransportType
  containers: Array<import('./domain').ReceivingContainerAttributes & {
    containerId: string
    empty: boolean
    cargo: null | {
      etsngCodeId: string
      weight: number
    }
  }>
  waybillIds: string[]
  railwayCarriages: Array<{
    railwayCarriageId: string
    containers: Array<{
      containerId: string
      empty: boolean
      cargo: null | {
        etsngCodeId: string
        weight: number
      }
    }>
  }>
  fillingType: FillingType
  railwayCarriageQuantities: Array<{ quantity: number; typeId: string | null }>
  containerQuantities: Array<{
    quantity: number
    type: ContainerType
    empty: boolean
    items: Array<{ etsngCodeId: string; weight: number }>
  }>
}

export const initialOrderFormState: OrderFormState = {
  arrivalAt: '',
  consignor: '',
  departureAt: '',
  consignee: '',
  clientId: '',
  contractId: '',
  routeId: '',
  terminalAreaId: '',
  transportType: '',
  containers: [],
  waybills: [],
  railwayCarriages: [],
  fillingType: 'ALL',
  railwayCarriageQuantities: [],
  containerQuantities: [],
}

export function findContainerArea(options: TerminalAreaOption[]) {
  return options.find((area) => area.code === 'CONTAINER') ?? null
}

export function filterTransportTypes(options: TransportTypeOption[]) {
  return options.filter((option) => option.value === 'VEHICLE' || option.value === 'RAILWAY')
}

export function toggleContainer(state: OrderFormState, option: ReferenceOption): OrderFormState {
  const selected = state.containers.some((container) => container.id === option.id)
  return {
    ...state,
    containers: selected
      ? state.containers.filter((container) => container.id !== option.id)
      : [
          ...state.containers,
          { id: option.id, name: option.name, empty: false, etsngCodeId: '', weight: '' },
        ],
  }
}

export function setContainerEmpty(
  state: OrderFormState,
  containerId: string,
  empty: boolean,
): OrderFormState {
  return {
    ...state,
    containers: state.containers.map((container) =>
      container.id === containerId
        ? {
            ...container,
            empty,
            etsngCodeId: empty ? '' : container.etsngCodeId,
            weight: empty ? '' : container.weight,
          }
        : container,
    ),
  }
}

export function setContainerCargo(
  state: OrderFormState,
  containerId: string,
  field: 'etsngCodeId' | 'weight',
  value: string,
): OrderFormState {
  return {
    ...state,
    containers: state.containers.map((container) =>
      container.id === containerId ? { ...container, [field]: value } : container,
    ),
  }
}

export function validateStep(state: OrderFormState, step: number, kind: OrderKind = 'receiving'): string[] {
  const errors: string[] = []
  if (step >= 1 && !state.clientId) errors.push('Выберите клиента')
  if (step >= 1 && !state.contractId) errors.push('Выберите договор')
  if (step >= 1 && !state.terminalAreaId) errors.push('Контейнерная площадка недоступна')
  if (step >= 1 && !state.transportType) errors.push('Выберите тип транспорта')

  const isUnnumberedVehicleShipping = kind === 'shipping'
    && state.transportType === 'VEHICLE'
    && state.fillingType === 'VEHICLE_UNNUMBERED'
  if (step >= 2 && state.transportType === 'VEHICLE' && !isUnnumberedVehicleShipping && state.containers.length === 0) {
    errors.push('Выберите хотя бы один КТК')
  }
  if (step >= 2 && isUnnumberedVehicleShipping) {
    validateUnnumberedVehicleShipping(state, errors)
  }
  if (step >= 2 && state.transportType === 'RAILWAY' && kind === 'receiving' && state.waybills.length === 0) {
    errors.push('Выберите хотя бы одну накладную')
  }
  if (state.transportType === 'RAILWAY' && kind === 'shipping') {
    if (step >= 2) validateShippingRailwayCarriages(state, errors)
    if (step >= 3) validateShippingRailwayContainers(state, errors)
    if (step >= 4) validateShippingRailwayCargo(state, errors)
  }

  if (step >= 3 && state.transportType === 'VEHICLE' && !isUnnumberedVehicleShipping) {
    validateContainerCargo(state.containers, errors)
  }
  return errors
}

export function buildPayload(
  state: OrderFormState,
  kind: OrderKind = 'receiving',
): CreateOrderPayload {
  if (!state.transportType) throw new Error('Тип транспорта обязателен')
  const isUnnumberedVehicleShipping = kind === 'shipping'
    && state.transportType === 'VEHICLE'
    && state.fillingType === 'VEHICLE_UNNUMBERED'
  return {
    clientId: state.clientId,
    contractId: state.contractId,
    ...(kind === 'receiving' ? {
      ...(state.arrivalAt ? { arrivalAt: state.arrivalAt } : {}),
      ...(state.consignor.trim() ? { consignor: state.consignor.trim() } : {}),
    } : {
      ...(state.departureAt ? { departureAt: state.departureAt } : {}),
      ...(state.consignee.trim() ? { consignee: state.consignee.trim() } : {}),
    }),
    ...(state.routeId ? { routeId: state.routeId } : {}),
    terminalAreaId: state.terminalAreaId,
    transportType: state.transportType,
    fillingType: (state.transportType === 'RAILWAY' && kind === 'shipping') || isUnnumberedVehicleShipping
      ? state.fillingType
      : 'ALL',
    containers: (state.transportType === 'VEHICLE' && !isUnnumberedVehicleShipping)
      || (state.transportType === 'RAILWAY' && kind === 'shipping' && state.fillingType === 'CONTAINER')
      ? state.containers.map(containerPayload)
      : [],
    waybillIds: state.transportType === 'RAILWAY' && kind === 'receiving'
      ? state.waybills.map((waybill) => waybill.id)
      : [],
    railwayCarriages: state.transportType === 'RAILWAY' && kind === 'shipping'
      && (state.fillingType === 'ALL' || state.fillingType === 'RAILWAY_CARRIAGE')
      ? state.railwayCarriages.map((carriage) => ({
          railwayCarriageId: carriage.railwayCarriageId,
          containers: state.fillingType === 'ALL' ? carriage.containers.map(containerPayload) : [],
        }))
      : [],
    railwayCarriageQuantities: state.transportType === 'RAILWAY' && kind === 'shipping'
      && (state.fillingType === 'CONTAINER' || state.fillingType === 'NONE')
      ? state.railwayCarriageQuantities.map((row) => ({
          quantity: Number(row.quantity),
          typeId: row.typeId || null,
        }))
      : [],
    containerQuantities: isUnnumberedVehicleShipping
      || (state.transportType === 'RAILWAY' && kind === 'shipping'
      && (state.fillingType === 'RAILWAY_CARRIAGE' || state.fillingType === 'NONE'))
      ? state.containerQuantities.map((row) => ({
          quantity: Number(row.quantity),
          type: row.type as ContainerType,
          empty: row.empty,
          items: row.empty ? [] : row.items.map((item) => ({
            etsngCodeId: item.etsngCodeId,
            weight: Number(item.weight.replace(',', '.')),
          })),
        }))
      : [],
  }
}

export function setVehicleShippingMode(
  state: OrderFormState,
  mode: 'NUMBERED' | 'UNNUMBERED',
): OrderFormState {
  if (mode === 'UNNUMBERED') {
    return {
      ...state,
      fillingType: 'VEHICLE_UNNUMBERED',
      containers: [],
      railwayCarriages: [],
      railwayCarriageQuantities: [],
      containerQuantities: [{
        key: 1,
        quantity: '',
        type: '',
        empty: true,
        items: [],
      }],
    }
  }
  return {
    ...state,
    fillingType: 'ALL',
    containers: [],
    containerQuantities: [],
  }
}



function containerPayload(container: SelectedContainer) {
  return {
    containerId: container.id,
    ...(container.ownerClientId ? { ownerClientId: container.ownerClientId } : {}),
    ...(container.sealNumbers?.trim() ? { sealNumbers: container.sealNumbers.trim() } : {}),
    ...(container.sealTypeId ? { sealTypeId: container.sealTypeId } : {}),
    ...(container.hazardClassId ? { hazardClassId: container.hazardClassId } : {}),
    empty: container.empty,
    cargo: container.empty
      ? null
      : {
          etsngCodeId: container.etsngCodeId,
          weight: Number(container.weight.replace(',', '.')),
        },
  }
}

function validateContainerCargo(containers: SelectedContainer[], errors: string[]) {
  containers.filter((container) => !container.empty).forEach((container) => {
    if (!container.etsngCodeId) errors.push(`Выберите груз для ${container.name}`)
    const normalizedWeight = container.weight.replace(',', '.')
    if (!/^\d+(\.\d{1,3})?$/.test(normalizedWeight) || Number(normalizedWeight) <= 0) {
      errors.push(`Укажите положительную массу до трёх знаков после запятой для ${container.name}`)
    }
  })
}

function validateUnnumberedVehicleShipping(state: OrderFormState, errors: string[]) {
  if (state.containers.length > 0) errors.push('Для безномерного вывоза номер КТК не указывается')
  if (state.containerQuantities.length !== 1) {
    errors.push('Для безномерного вывоза должна быть указана одна строка КТК')
    return
  }
  const row = state.containerQuantities[0]
  if (!/^\d+$/.test(row.quantity) || Number(row.quantity) <= 0) {
    errors.push('Укажите целое количество КТК больше нуля')
  }
  if (!row.type) errors.push('Выберите типоразмер КТК')
  if (!row.empty) errors.push('Безномерный вывоз разрешён только для порожнего КТК')
  if (row.items.length > 0) errors.push('Для безномерного вывоза сведения о грузе не указываются')
}

function validateShippingRailwayCarriages(state: OrderFormState, errors: string[]) {
  if (state.fillingType === 'CONTAINER' || state.fillingType === 'NONE') {
    validateRailwayCarriageQuantities(state, errors)
    return
  }
  if (state.railwayCarriages.length === 0) {
    errors.push('Добавьте хотя бы один вагон')
    return
  }
  const carriageIds = new Set<string>()
  state.railwayCarriages.forEach((carriage, carriageIndex) => {
    if (!carriage.railwayCarriageId) errors.push(`Выберите вагон ${carriageIndex + 1}`)
    if (carriage.railwayCarriageId && carriageIds.has(carriage.railwayCarriageId)) {
      errors.push('Один вагон нельзя добавить дважды')
    }
    carriageIds.add(carriage.railwayCarriageId)
  })
}

function validateShippingRailwayContainers(state: OrderFormState, errors: string[]) {
  if (state.fillingType === 'CONTAINER') {
    if (state.containers.length === 0) errors.push('Выберите хотя бы один номерной КТК')
    validateContainerSelection(state.containers, errors)
    return
  }
  if (state.fillingType === 'RAILWAY_CARRIAGE' || state.fillingType === 'NONE') {
    validateContainerQuantityComposition(state, errors)
    return
  }

  const containerIds = new Set<string>()
  state.railwayCarriages.forEach((carriage, carriageIndex) => {
    if (carriage.containers.length === 0) {
      errors.push(`Добавьте хотя бы один КТК на вагон ${carriageIndex + 1}`)
    }
    carriage.containers.forEach((container, containerIndex) => {
      if (!container.id) {
        errors.push(`Выберите КТК ${containerIndex + 1} на вагоне ${carriageIndex + 1}`)
        return
      }
      if (containerIds.has(container.id)) errors.push(`КТК ${container.name} уже выбран на другом вагоне`)
      containerIds.add(container.id)
    })
  })
}

function validateShippingRailwayCargo(state: OrderFormState, errors: string[]) {
  if (state.fillingType === 'ALL') {
    state.railwayCarriages.forEach((carriage) => {
      validateContainerCargo(carriage.containers.filter((container) => Boolean(container.id)), errors)
    })
    return
  }
  if (state.fillingType === 'CONTAINER') {
    validateContainerCargo(state.containers, errors)
    return
  }
  validateContainerQuantityCargo(state, errors)
}

function validateContainerSelection(containers: SelectedContainer[], errors: string[]) {
  const containerIds = new Set<string>()
  containers.forEach((container, index) => {
    if (!container.id) {
      errors.push(`Выберите КТК ${index + 1}`)
      return
    }
    if (containerIds.has(container.id)) errors.push(`КТК ${container.name} уже выбран`)
    containerIds.add(container.id)
  })
}

function validateRailwayCarriageQuantities(state: OrderFormState, errors: string[]) {
  if (state.railwayCarriageQuantities.length === 0) {
    errors.push('Добавьте хотя бы одну строку количества вагонов')
    return
  }
  const typeIds = new Set<string>()
  state.railwayCarriageQuantities.forEach((row, index) => {
    if (!/^\d+$/.test(row.quantity) || Number(row.quantity) <= 0) {
      errors.push(`Укажите целое количество вагонов больше нуля в строке ${index + 1}`)
    }
    const typeKey = row.typeId || '__UNKNOWN__'
    if (typeIds.has(typeKey)) errors.push('Один тип вагона нельзя добавить дважды')
    typeIds.add(typeKey)
  })
}

function validateContainerQuantityComposition(state: OrderFormState, errors: string[]) {
  if (state.containerQuantities.length === 0) {
    errors.push('Добавьте хотя бы одну количественную группу КТК')
    return
  }
  state.containerQuantities.forEach((row, rowIndex) => {
    if (!/^\d+$/.test(row.quantity) || Number(row.quantity) <= 0) {
      errors.push(`Укажите целое количество КТК больше нуля в группе ${rowIndex + 1}`)
    }
    if (!row.type) errors.push(`Выберите тип КТК в группе ${rowIndex + 1}`)
    if (row.empty && row.items.length > 0) errors.push(`Удалите груз у порожней группы ${rowIndex + 1}`)
  })
}

function validateContainerQuantityCargo(state: OrderFormState, errors: string[]) {
  const rowKeys = new Set<string>()
  state.containerQuantities.forEach((row, rowIndex) => {
    if (!row.empty && row.items.length === 0) errors.push(`Добавьте груз в группу ${rowIndex + 1}`)
    row.items.forEach((item, itemIndex) => {
      if (!item.etsngCodeId) errors.push(`Выберите ЕТСНГ для груза ${itemIndex + 1} в группе ${rowIndex + 1}`)
      const weight = item.weight.replace(',', '.')
      if (!/^\d+(\.\d{1,3})?$/.test(weight) || Number(weight) <= 0) {
        errors.push(`Укажите положительную массу на один КТК для груза ${itemIndex + 1} в группе ${rowIndex + 1}`)
      }
    })
    const itemKey = row.items
      .map((item) => `${item.etsngCodeId}:${item.weight.replace(',', '.')}`)
      .sort()
      .join('|')
    const rowKey = `${row.quantity}:${row.type}:${row.empty}:${itemKey}`
    if (rowKeys.has(rowKey)) errors.push('Полностью одинаковую группу КТК нельзя добавить дважды')
    rowKeys.add(rowKey)
  })
}

export function canAddWaybill(current: SelectedWaybill[], candidate: SelectedWaybill) {
  return current.length === 0 || current[0].groupKey === candidate.groupKey
}

export function selectedWaybillTotals(waybills: SelectedWaybill[]) {
  return waybills.reduce(
    (totals, waybill) => ({
      waybills: totals.waybills + 1,
      railwayCarriages: totals.railwayCarriages + waybill.railwayCarriageCount,
      containers: totals.containers + waybill.containerCount,
    }),
    { waybills: 0, railwayCarriages: 0, containers: 0 },
  )
}
