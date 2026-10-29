export type OrderKind = 'receiving' | 'shipping'

export type ReferenceOption = {
  id: string
  name: string
  type?: ContainerType | null
  tareWeight?: number
}

export type TransportType = 'VEHICLE' | 'RAILWAY'
export type FillingType = 'ALL' | 'RAILWAY_CARRIAGE' | 'CONTAINER' | 'NONE' | 'VEHICLE_UNNUMBERED'
export type ContainerType =
  | 'STANDARD_20'
  | 'STANDARD_40'

export const fillingTypeOptions: Array<{ value: FillingType; name: string }> = [
  { value: 'ALL', name: 'Заданы номера вагонов и КТК' },
  { value: 'RAILWAY_CARRIAGE', name: 'Заданы только номера вагонов' },
  { value: 'CONTAINER', name: 'Заданы только номера КТК' },
  { value: 'NONE', name: 'Не заданы номера вагонов и КТК' },
  { value: 'VEHICLE_UNNUMBERED', name: 'Безномерный вывоз по авто' },
]

export const fillingTypeLabel = (value: FillingType | null | undefined) =>
  fillingTypeOptions.find((option) => option.value === (value ?? 'ALL'))?.name ?? 'Заданы номера вагонов и КТК'

export const vehicleShippingTypeLabel = (value: FillingType | null | undefined) =>
  value === 'VEHICLE_UNNUMBERED' ? 'Номера КТК не известны' : 'Номера КТК известны'

export const vehicleShippingDataOptions: Array<{ value: 'ALL' | 'VEHICLE_UNNUMBERED'; name: string }> = [
  { value: 'ALL', name: 'Номера КТК известны' },
  { value: 'VEHICLE_UNNUMBERED', name: 'Номера КТК не известны' },
]

export const containerTypeOptions: Array<{ value: ContainerType; name: string }> = [
  { value: 'STANDARD_20', name: 'Стандартный 20' },
  { value: 'STANDARD_40', name: 'Стандартный 40' },
]

export const containerTypeLabel = (value: ContainerType) =>
  containerTypeOptions.find((option) => option.value === value)?.name ?? value

export type TerminalAreaOption = {
  id: string
  code: string
  name: string
}

export type TransportTypeOption = {
  value: TransportType
  name: string
}

export type CreatedWaybill = {
  id: string
  number: string
}

export type WaybillProductSummary = {
  id: string
  etsngCodeId: string
  code: string
  name: string
  weight: number | null
}

export type WaybillContainerSummary = {
  containerId: string; number: string; grossWeight: number; tareWeight: number; netWeight: number
  etsngCodeId?: string | null; etsngCodeName?: string | null
}

export type WaybillLink = {
  containers?: WaybillContainerSummary[]
  id: string
  number: string
  railwayCarriageCount: number
  containerCount: number
  products: WaybillProductSummary[]
}

export type GroupedWaybill = {
  groupKey: string
  departureStation: number
  destinationStation: number
  payer: string
  products: WaybillProductSummary[]
  railwayCarriageCount: number
  containerCount: number
  waybillCount: number
  waybills: WaybillLink[]
}

export type GroupedWaybillPage = {
  content: GroupedWaybill[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export type GroupedWaybillFilter = {
  departureStation?: number
  destinationStation?: number
  payer?: string
}

export type OrderSummary = {
  contractId: string | null
  contractName: string | null
  serviceOrderId: string | null
  sourceReceivingOrderId?: string | null
  id: string
  code: number
  clientId: string
  clientName: string
  terminalArea: TerminalAreaOption
  transportType: TransportType | null
  fillingType: FillingType
  status: string
}

export type PagedResponse<T> = {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type CreatedOrder = {
  id: string
  code: number
  status: string
}

export type OrderCargoDetails = {
  etsngCodeId: string
  etsngCodeName: string
  weight: number
}

export type OrderContainerDetails = {
  containerId: string
  containerName: string
  empty: boolean
  cargo: OrderCargoDetails | null
}

export type OrderWaybillContainerDetails = WaybillContainerSummary

export type OrderWaybillCarriageDetails = {
  id: string
  railwayCarriageId: string
  number: string
  containers: OrderWaybillContainerDetails[]
}

export type OrderWaybillProductDetails = {
  id: string
  etsngCodeId: string
  etsngCode: string
  weight: number | null
}

export type OrderWaybillDetails = {
  id: string
  number: string
  departureStation: number
  destinationStation: number
  payer: string
  railwayCarriages: OrderWaybillCarriageDetails[]
  products: OrderWaybillProductDetails[]
}

export type ShippingOrderRailwayCarriageDetails = {
  railwayCarriageId: string
  railwayCarriageCode: string
  containers: OrderContainerDetails[]
}

export type RailwayCarriageQuantityDetails = {
  id: string
  quantity: number
  typeId: string | null
  typeCode: string | null
  typeName: string | null
}

export type ContainerQuantityDetails = {
  id: string
  quantity: number
  type: ContainerType
  empty: boolean
  items: Array<{
    id: string
    etsngCodeId: string
    etsngCode: string
    weight: number
  }>
}

export type OrderDetails = {
  sourceShippingOrderId?: string | null
  returnOrders?: Array<{ id: string; code: number; status: string; containerNames: string[] }>
  routeId?: string | null
  contractId: string | null
  contractName: string | null
  serviceOrderId: string | null
  sourceReceivingOrderId?: string | null
  id: string
  code: number
  clientId: string
  clientName: string
  terminalArea: TerminalAreaOption
  transportType: TransportType | null
  fillingType: FillingType
  status: string
  containers: OrderContainerDetails[]
  waybills: OrderWaybillDetails[]
  railwayCarriages: ShippingOrderRailwayCarriageDetails[]
  railwayCarriageQuantities: RailwayCarriageQuantityDetails[]
  containerQuantities: ContainerQuantityDetails[]
}

export type OrderConfig = {
  kind: OrderKind
  title: string
  createTitle: string
  description: string
  listPath: string
  createPath: string
  apiPath: string
  successText: string
}

export const orderConfigs: Record<OrderKind, OrderConfig> = {
  receiving: {
    kind: 'receiving',
    title: 'Заявки на поставку',
    createTitle: 'Новая заявка на поставку',
    description: 'Приём КТК клиента на терминал',
    listPath: '/receiving-orders',
    createPath: '/receiving-orders/new',
    apiPath: '/api/receiving-orders',
    successText: 'Заявка на поставку создана',
  },
  shipping: {
    kind: 'shipping',
    title: 'Заявки на вывоз',
    createTitle: 'Новая заявка на вывоз',
    description: 'Выдача КТК клиента с терминала',
    listPath: '/shipping-orders',
    createPath: '/shipping-orders/new',
    apiPath: '/api/shipping-orders',
    successText: 'Заявка на вывоз создана',
  },
}

export function statusLabel(status: string) {
  return ({ DRAFT: 'Черновик', CONFIRMED: 'Подтверждено', COMPLETED: 'Выполнено' } as Record<string, string>)[status] ?? status
}

export function transportTypeLabel(transportType: TransportType | null) {
  if (transportType === 'VEHICLE') return 'Авто'
  if (transportType === 'RAILWAY') return 'ЖД'
  return '—'
}
