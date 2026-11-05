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

export type SelectedContainerCargo = { etsngCodeId: string; weight: string }

export type SelectedContainer = import('./domain').ReceivingContainerAttributes & {
  id: string
  name: string
  empty: boolean
  cargoItems?: SelectedContainerCargo[]
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

export function toSelectedWaybill(group: Pick<GroupedWaybill, 'groupKey' | 'departureStation' | 'destinationStation' | 'payer'>, waybill: WaybillLink): SelectedWaybill {
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
  defaultContainerOwnerId?: string
  arrivalAt: string
  authorizedRepresentative: string
  phone: string
  email: string
  transportWaybillNumber: string
  comment: string
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
  defaultContainerOwnerId?: string
  arrivalAt?: string
  authorizedRepresentative?: string
  phone?: string
  email?: string
  transportWaybillNumber?: string
  comment?: string
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
    cargoItems?: Array<{ etsngCodeId: string; weight: number }>
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
  defaultContainerOwnerId: '',
  arrivalAt: '',
  consignor: '',
  authorizedRepresentative: '',
  phone: '',
  email: '',
  transportWaybillNumber: '',
  comment: '',
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
            ...(empty ? { cargoItems: undefined } : {}),
          }
        : container,
    ),
  }
}

export function containerCargoItems(container: SelectedContainer): SelectedContainerCargo[] {
  return container.cargoItems ?? [{ etsngCodeId: container.etsngCodeId, weight: container.weight }]
}

export function setContainerCargoItems(state: OrderFormState, containerId: string, items: SelectedContainerCargo[]): OrderFormState {
  return {
    ...state,
    containers: state.containers.map(container => container.id === containerId
      ? { ...container, cargoItems: items, etsngCodeId: items[0]?.etsngCodeId ?? '', weight: items[0]?.weight ?? '' }
      : container),
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
      container.id === containerId ? { ...container, [field]: value, cargoItems: undefined } : container,
    ),
  }
}

export function validateStep(state: OrderFormState, step: number, kind: OrderKind = 'receiving'): string[] {
  const errors: string[] = []
  if (state.fillingType !== 'ALL' || state.railwayCarriageQuantities.length || state.containerQuantities.length) {
    return ['В MVP доступны только заявки с номерами КТК и, для ЖД, вагонов']
  }
  if (step >= 1 && !state.clientId) errors.push('Выберите клиента')
  if (step >= 1 && !state.contractId) errors.push('Выберите договор')
  if (step >= 1 && kind === 'receiving' && !state.defaultContainerOwnerId) errors.push('Выберите собственника КТК по умолчанию')
  if (step >= 1 && !state.terminalAreaId) errors.push('Контейнерная площадка недоступна')
  if (step >= 1 && !state.transportType) errors.push('Выберите тип транспорта')

  if (step >= 2 && state.transportType === 'VEHICLE' && state.containers.length === 0) {
    errors.push('Выберите хотя бы один КТК')
  }

  if (step >= 2 && state.transportType === 'RAILWAY' && kind === 'receiving' && state.waybills.length === 0) {
    errors.push('Выберите хотя бы одну накладную')
  }
  if (step >= 2 && kind === 'receiving' && state.transportType === 'RAILWAY'
    && state.waybills.some(w => !w.railwayCarriageCount || !w.containerCount)) {
    errors.push('В каждой накладной должны быть указаны вагоны и КТК в них')
  }
  if (state.transportType === 'RAILWAY' && kind === 'shipping') {
    if (step >= 2) validateShippingRailwayCarriages(state, errors)
    if (step >= 3) validateShippingRailwayContainers(state, errors)
    if (step >= 4) validateShippingRailwayCargo(state, errors)
  }

  if (step >= 3 && state.transportType === 'VEHICLE') {
    validateContainerCargo(state.containers, errors)
  }
  return errors
}

export function buildPayload(
  state: OrderFormState,
  kind: OrderKind = 'receiving',
): CreateOrderPayload {
  if (!state.transportType) throw new Error('Тип транспорта обязателен')
  if (state.fillingType !== 'ALL' || state.railwayCarriageQuantities.length || state.containerQuantities.length) {
    throw new Error('В MVP доступны только заявки с номерами КТК и, для ЖД, вагонов')
  }
  return {
    clientId: state.clientId,
    contractId: state.contractId,
      ...Object.fromEntries(['authorizedRepresentative', 'phone', 'email', 'comment', 'transportWaybillNumber'].flatMap(key => {
        const value = state[key as 'authorizedRepresentative' | 'phone' | 'email' | 'comment' | 'transportWaybillNumber'].trim()
        return value ? [[key, value]] : []
      })),

    ...(kind === 'receiving' ? {
      defaultContainerOwnerId: state.defaultContainerOwnerId,
      ...(state.arrivalAt ? { arrivalAt: state.arrivalAt } : {}),
      ...(state.consignor.trim() ? { consignor: state.consignor.trim() } : {}),
    } : {
      ...(state.departureAt ? { departureAt: state.departureAt } : {}),
      ...(state.consignee.trim() ? { consignee: state.consignee.trim() } : {}),
    }),
    ...(state.routeId ? { routeId: state.routeId } : {}),
    terminalAreaId: state.terminalAreaId,
    transportType: state.transportType,
    fillingType: 'ALL',
    containers: state.transportType === 'VEHICLE' ? state.containers.map(containerPayload) : [],
    waybillIds: state.transportType === 'RAILWAY' && kind === 'receiving' ? state.waybills.map(w => w.id) : [],
    railwayCarriages: state.transportType === 'RAILWAY' && kind === 'shipping'
      ? state.railwayCarriages.map(carriage => ({ railwayCarriageId: carriage.railwayCarriageId, containers: carriage.containers.map(containerPayload) })) : [],
    railwayCarriageQuantities: [],
    containerQuantities: [],
  }
}





export function containerPayload(container: SelectedContainer) {
  return {
    containerId: container.id,
    ...(container.ownerClientId ? { ownerClientId: container.ownerClientId } : {}),
    ...(container.sealNumbers?.trim() ? { sealNumbers: container.sealNumbers.trim() } : {}),
    ...(container.sealTypeId ? { sealTypeId: container.sealTypeId } : {}),
    ...(container.hazardClassId ? { hazardClassId: container.hazardClassId } : {}),
    ...(container.cargoItems !== undefined ? { cargoItems: container.empty ? [] : container.cargoItems.map(item => ({
      etsngCodeId: item.etsngCodeId, weight: Number(item.weight.replace(',', '.')),
    })) } : {}),
    empty: container.empty,
    cargo: container.empty
      ? null
      : {
          etsngCodeId: container.etsngCodeId,
          weight: Number(container.weight.replace(',', '.')),
        },
  }
}

export function validateContainerCargo(containers: SelectedContainer[], errors: string[]) {
  containers.filter((container) => !container.empty).forEach((container) => {
    const items = containerCargoItems(container)
    if (!items.length) errors.push(`Выберите груз для ${container.name}`)
    items.forEach(item => {
    if (!item.etsngCodeId) errors.push(`Выберите груз для ${container.name}`)
    const normalizedWeight = item.weight.replace(',', '.')
    if (!/^\d+(\.\d{1,3})?$/.test(normalizedWeight) || Number(normalizedWeight) <= 0) {
      errors.push(`Укажите положительную массу до трёх знаков после запятой для ${container.name}`)
    }
    })
  })
}



function validateShippingRailwayCarriages(state: OrderFormState, errors: string[]) {

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
  state.railwayCarriages.forEach(carriage => validateContainerCargo(carriage.containers.filter(c => Boolean(c.id)), errors))
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
