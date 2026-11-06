import type { GroupedWaybillFilter } from './domain'
import { getWaybillStationName } from './waybillOptions'

export type WaybillSelectionOption = Required<GroupedWaybillFilter>

export function waybillSelectionChoices(rows: WaybillSelectionOption[], filter: GroupedWaybillFilter) {
  const stations = (field: 'departureStation' | 'destinationStation') => [...new Set(rows.map(row => row[field]))]
    .map(value => ({ value: String(value), label: getWaybillStationName(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  return {
    departures: stations('departureStation'), destinations: stations('destinationStation'),
    payers: [...new Set(rows.filter(row => row.departureStation === filter.departureStation
      && row.destinationStation === filter.destinationStation).map(row => row.payer))].sort((a, b) => a.localeCompare(b, 'ru')),
  }
}

export function changeWaybillStation(filter: GroupedWaybillFilter, field: 'departureStation' | 'destinationStation', value: string): GroupedWaybillFilter {
  return { ...filter, [field]: value ? Number(value) : undefined, payer: undefined }
}

export function validateWaybillSelection(filter: GroupedWaybillFilter) {
  return [
    filter.departureStation === undefined ? 'Выберите станцию отправления.' : '',
    filter.destinationStation === undefined ? 'Выберите станцию назначения.' : '',
    !filter.payer ? 'Выберите плательщика.' : '',
  ].filter(Boolean)
}
