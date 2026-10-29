export type WaybillSelectOption = {
  value: string
  label: string
}

export const WAYBILL_PAYERS = [
  'ФИТ',
  'ООО "Логопер"',
  'ООО "СКЛ"',
] as const

export const WAYBILL_DEPARTURE_STATIONS: WaybillSelectOption[] = [
  { value: '1001', label: 'Владивосток' },
  { value: '1002', label: 'Пермь' },
  { value: '1003', label: 'Казань' },
  { value: '1004', label: 'Муром-1' },
  { value: '1005', label: 'Орудьево' },
]

export const WAYBILL_DESTINATION_STATIONS: WaybillSelectOption[] = [
  { value: '2001', label: 'Круглое поле' },
]

const stationNames = new Map(
  [...WAYBILL_DEPARTURE_STATIONS, ...WAYBILL_DESTINATION_STATIONS]
    .map((station) => [Number(station.value), station.label]),
)

export function getWaybillStationName(station: number) {
  return stationNames.get(station) ?? String(station)
}
