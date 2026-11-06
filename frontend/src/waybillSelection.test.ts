import { describe, expect, it } from 'vitest'
import { changeWaybillStation, validateWaybillSelection, waybillSelectionChoices } from './waybillSelection'

const options = [
  { departureStation: 1001, destinationStation: 2001, payer: 'ФИТ' },
  { departureStation: 1001, destinationStation: 2001, payer: 'Другой плательщик' },
  { departureStation: 1002, destinationStation: 2001, payer: 'ООО "СКЛ"' },
  { departureStation: 1001, destinationStation: 9999, payer: 'Особый плательщик' },
]
describe('railway waybill selection', () => {
  it('limits payers to the exact station pair and deduplicates choices', () => {
    const choices = waybillSelectionChoices([...options, options[0]], { departureStation: 1001, destinationStation: 2001 })
    expect(choices.payers).toEqual(['Другой плательщик', 'ФИТ'])
    expect(choices.departures).toHaveLength(2)
    expect(choices.destinations.find(item => item.value === '9999')?.label).toBe('9999')
    expect(choices.departures.find(item => item.value === '1001')?.label).toBe('Владивосток')
  })
  it('does not offer a payer before both stations or for an empty combination', () => {
    expect(waybillSelectionChoices(options, { departureStation: 1001 }).payers).toEqual([])
    expect(waybillSelectionChoices(options, { departureStation: 1002, destinationStation: 9999 }).payers).toEqual([])
  })
  it('clears the payer when either station changes or is cleared', () => {
    const selected = { departureStation: 1001, destinationStation: 2001, payer: 'ФИТ' }
    expect(changeWaybillStation(selected, 'departureStation', '1002')).toEqual({ departureStation: 1002, destinationStation: 2001, payer: undefined })
    expect(changeWaybillStation(selected, 'destinationStation', '')).toEqual({ departureStation: 1001, destinationStation: undefined, payer: undefined })
  })
  it('requires all three filters before proceeding', () => {
    expect(validateWaybillSelection({})).toHaveLength(3)
    expect(validateWaybillSelection({ departureStation: 1001, destinationStation: 2001 })).toEqual(['Выберите плательщика.'])
    expect(validateWaybillSelection(options[0])).toEqual([])
  })
})
