import { describe, expect, it } from 'vitest'
import {
  getWaybillStationName,
  WAYBILL_DEPARTURE_STATIONS,
  WAYBILL_DESTINATION_STATIONS,
  WAYBILL_PAYERS,
} from './waybillOptions'

describe('waybill select options', () => {
  it('contains the configured payers and stations', () => {
    expect(WAYBILL_PAYERS).toEqual(['ФИТ', 'ООО "Логопер"', 'ООО "СКЛ"'])
    expect(WAYBILL_DEPARTURE_STATIONS.map((station) => station.label)).toEqual([
      'Владивосток', 'Пермь', 'Казань', 'Муром-1', 'Орудьево',
    ])
    expect(WAYBILL_DESTINATION_STATIONS.map((station) => station.label)).toEqual(['Круглое поле'])
  })

  it('shows a station name and preserves unknown legacy identifiers', () => {
    expect(getWaybillStationName(1001)).toBe('Владивосток')
    expect(getWaybillStationName(2001)).toBe('Круглое поле')
    expect(getWaybillStationName(999999)).toBe('999999')
  })
})
