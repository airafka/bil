import { useEffect, useState } from 'react'
import { getWaybillSelectionOptions } from '../api'
import type { GroupedWaybillFilter } from '../domain'
import { changeWaybillStation, waybillSelectionChoices, type WaybillSelectionOption } from '../waybillSelection'
import { UiSelect } from './FormControls'
import { Notification } from './Notification'

export function WaybillFilterFields({ value, onChange, disabled = false }: {
  value: GroupedWaybillFilter; onChange: (value: GroupedWaybillFilter) => void; disabled?: boolean
}) {
  const [options, setOptions] = useState<WaybillSelectionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    getWaybillSelectionOptions().then(rows => { if (active) setOptions(rows) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить станции и плательщиков') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])
  const choices = waybillSelectionChoices(options, value)
  const busy = disabled || loading || !!error
  return <>
    <div className="form-section-heading ui-section-divider"><h2>Отбор накладных ЭТРАН</h2></div>
    {error && <Notification kind="error">{error} <button type="button" className="secondary-button" disabled={disabled} onClick={() => { setError(''); setLoading(true); setAttempt(current => current + 1) }}>Повторить</button></Notification>}
    <div className="form-fields-grid waybill-filter-fields">
      <div className="form-fields-column">
        <label className="field horizontal-field"><span>Станция отправления:<b>*</b></span><UiSelect aria-label="Станция отправления" required disabled={busy} value={value.departureStation ?? ''} onChange={event => onChange(changeWaybillStation(value, 'departureStation', event.target.value))}>
          <option value="">Выберите станцию</option>{choices.departures.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </UiSelect></label>
        <label className="field horizontal-field"><span>Станция назначения:<b>*</b></span><UiSelect aria-label="Станция назначения" required disabled={busy} value={value.destinationStation ?? ''} onChange={event => onChange(changeWaybillStation(value, 'destinationStation', event.target.value))}>
          <option value="">Выберите станцию</option>{choices.destinations.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </UiSelect></label>
      </div>
      <div className="form-fields-column">
        <label className="field horizontal-field"><span>Плательщик:<b>*</b></span><span className="field-control"><UiSelect aria-label="Плательщик" required disabled={busy || value.departureStation === undefined || value.destinationStation === undefined || !choices.payers.length} value={value.payer ?? ''} onChange={event => onChange({ ...value, payer: event.target.value || undefined })}>
          <option value="">Выберите плательщика</option>{choices.payers.map(payer => <option key={payer} value={payer}>{payer}</option>)}
        </UiSelect>{!busy && value.departureStation !== undefined && value.destinationStation !== undefined && !choices.payers.length && <small>Для выбранных станций нет свободных накладных.</small>}</span></label>
      </div>
    </div>
    {!busy && !options.length && <div className="inline-empty">Свободных накладных нет.</div>}
  </>
}
