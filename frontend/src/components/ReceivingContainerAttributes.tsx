import { useEffect, useState } from 'react'
import type { ReceivingContainerAttributes as Attributes, ReferenceOption } from '../domain'
import { getReferenceOptions } from '../api'
import { UiInput, UiSelect } from './FormControls'

type Row = Attributes & { id: string; name: string; empty?: boolean }
export function ReceivingContainerAttributes({ containers, onChange, includeHazardClass = true, showState = false, vehicleReceiving = false }: {
  vehicleReceiving?: boolean
  showState?: boolean
  includeHazardClass?: boolean
  containers: Row[]
  onChange?: (id: string, change: Attributes) => void
}) {
  const editing = !!onChange
  const [references, setReferences] = useState<ReferenceOption[][]>([[], [], []])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!editing) return
    let active = true
    Promise.all([getReferenceOptions('clients'), getReferenceOptions('seal-types'), includeHazardClass ? getReferenceOptions('hazard-classes') : Promise.resolve([])])
      .then(value => { if (active) setReferences(value) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить справочники') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [editing, includeHazardClass])
  if (!containers.length) return null
  const select = (row: Row, key: 'ownerClientId' | 'sealTypeId' | 'hazardClassId', label: string, options: ReferenceOption[], name?: string | null) =>
    <UiSelect aria-label={label + ' — ' + row.name} value={row[key] ?? ''} disabled={loading || !!error}
      onChange={event => onChange?.(row.id, { [key]: event.target.value || null })}>
      <option value="">{loading ? 'Загрузка…' : options.length ? 'Не указан' : 'Справочник пуст'}</option>
      {row[key] && !options.some(option => option.id === row[key]) && <option value={row[key]}>{name || row[key]}</option>}
      {options.map(option => <option value={option.id} key={option.id}>{option.name}</option>)}
    </UiSelect>
  return <div className={`receiving-container-attributes ${vehicleReceiving ? "vehicle-receiving-table" : ""}`}>
    {editing && error && <div className="notice error" role="alert">{error}</div>}
    <div className="table-wrap"><table aria-label="Реквизиты КТК">
      <thead><tr>{showState && <th>№</th>}<th>Номер КТК</th>{showState && !vehicleReceiving && <th>Порожний</th>}<th>Собственник КТК</th><th>Номера ЗПУ</th><th>Тип ЗПУ</th>{showState && vehicleReceiving && <th className="empty-state-column">Порожний</th>}{includeHazardClass && <th>{vehicleReceiving ? "Класс опасности груза" : "Класс опасности"}</th>}</tr></thead>
      <tbody>{containers.map((row, index) => <tr key={row.id}>
        {showState && <td>{index + 1}</td>}<td>{row.name}</td>
        {showState && !vehicleReceiving && <td><span className={`readonly-checkbox ${row.empty ? 'checked' : ''}`} aria-label={row.empty ? 'Порожний' : 'Гружёный'}>{row.empty && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span></td>}
        <td>{editing ? select(row, 'ownerClientId', 'Собственник КТК', references[0], row.ownerClientName) : row.ownerClientName || '—'}</td>
        <td>{editing ? <UiInput aria-label={'Номера ЗПУ — ' + row.name} maxLength={1000} value={row.sealNumbers ?? ''}
          onChange={event => onChange?.(row.id, { sealNumbers: event.target.value })} placeholder="Номера через запятую" /> : row.sealNumbers ? (vehicleReceiving ? <span className="seal-pills">{row.sealNumbers.split(/[,;\n]+/).map((seal, i) => seal.trim() && <span className="seal-pill" key={i}>{seal.trim()}</span>)}</span> : row.sealNumbers) : '—'}</td>
        <td>{editing ? select(row, 'sealTypeId', 'Тип ЗПУ', references[1], row.sealTypeName) : row.sealTypeName || '—'}</td>
        {showState && vehicleReceiving && <td className="empty-state-column"><svg role="img" aria-label={row.empty ? 'Порожний' : 'Гружёный'} className={row.empty ? 'container-empty-icon' : 'container-loaded-icon'} width="20" height="20" viewBox="0 0 20 20" fill="none"><path d={row.empty ? 'M3 10 8 15 17 5' : 'M3 3 17 17 M17 3 3 17'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></td>}
        {includeHazardClass && <td>{editing ? select(row, 'hazardClassId', 'Класс опасности', references[2], row.hazardClassName) : row.hazardClassName || '—'}</td>}
      </tr>)}</tbody>
    </table></div>
  </div>
}
