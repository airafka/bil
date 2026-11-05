import { Notification } from './Notification'
import { useEffect, useRef, useState } from 'react'
import { getAvailableWaybills, type AvailableWaybillPage, type AvailableWaybillRow } from '../api'
import { canAddWaybill, toSelectedWaybill, type SelectedWaybill } from '../orderForm'
import { UiInput } from './FormControls'

export function WaybillSelectionTable({ selected, onChange, disabled = false }: {
  selected: SelectedWaybill[]; onChange: (rows: SelectedWaybill[]) => void; disabled?: boolean
}) {
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<AvailableWaybillPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const allCheckbox = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let active = true
    getAvailableWaybills(page).then(value => { if (active) setData(value) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить накладные') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, attempt])
  const rows = data?.content ?? []
  const ids = new Set(selected.map(row => row.id))
  const group = selected[0]?.groupKey ?? rows[0]?.groupKey
  const selectable = rows.filter(row => row.groupKey === group)
  const allSelected = selectable.length > 0 && selectable.every(row => ids.has(row.waybill.id))
  const someSelected = selectable.some(row => ids.has(row.waybill.id))
  useEffect(() => { if (allCheckbox.current) allCheckbox.current.indeterminate = someSelected && !allSelected }, [someSelected, allSelected])
  const busy = disabled || loading || !!error
  const changePage = (value: number) => { setLoading(true); setError(''); setPage(value) }
  const toggle = (row: AvailableWaybillRow) => {
    if (ids.has(row.waybill.id)) onChange(selected.filter(item => item.id !== row.waybill.id))
    else { const item = toSelectedWaybill(row, row.waybill); if (canAddWaybill(selected, item)) onChange([...selected, item]) }
  }
  const togglePage = () => {
    const pageIds = new Set(selectable.map(row => row.waybill.id))
    onChange(allSelected ? selected.filter(row => !pageIds.has(row.id))
      : [...selected, ...selectable.filter(row => !ids.has(row.waybill.id)).map(row => toSelectedWaybill(row, row.waybill))])
  }
  return <section className="form-section waybill-selection-section" aria-label="Выбор накладных ЭТРАН">
    {error && <Notification kind="error">{error} <button type="button" className="secondary-button" onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>Повторить</button></Notification>}
    <div className="table-wrap order-composition-wrap"><table className="waybill-selection-table" aria-label="Свободные накладные ЭТРАН" aria-busy={loading}>
      <thead><tr><th scope="col" className="composition-index"><input ref={allCheckbox} className="ui-choice" type="checkbox" checked={allSelected} disabled={busy || !selectable.length} onChange={togglePage} aria-label="Выбрать доступные накладные на странице" /></th><th scope="col">Номер накладной</th><th scope="col">Дата создания в ЭТРАН</th><th scope="col">Вид отправки</th><th scope="col">Статус</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={5}>Загружаем накладные…</td></tr> : error ? <tr><td colSpan={5}>Накладные не загружены</td></tr> : rows.length ? rows.map(row => {
        const bill = row.waybill, checked = ids.has(bill.id), blocked = !!selected[0] && selected[0].groupKey !== row.groupKey
        const toggleLabel = checked ? 'Снять выбор' : 'Выбрать'
        return <tr key={bill.id}>
          <td className="composition-index"><UiInput type="checkbox" aria-label={toggleLabel + ' накладную ' + bill.number} checked={checked} disabled={disabled || blocked} onChange={() => toggle(row)} /></td>
          <td>{bill.number}</td>
          <td>{bill.createdAt ? new Date(bill.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Не указана'}</td>
          <td>{bill.shipmentType === 'CONTAINER' ? 'Контейнерная' : bill.shipmentType || 'Не указан'}</td>
          <td><span className="status-badge waybill-transit-status">{bill.status === 'IN_TRANSIT' ? 'В пути' : bill.status || 'Не указан'}</span></td>
        </tr>
      }) : <tr><td colSpan={5}>Свободных накладных нет</td></tr>}</tbody>
    </table></div>
    <div className="waybill-selection-footer">
      {(data?.totalPages ?? 0) > 1 && <div className="pagination compact-pagination"><button type="button" disabled={busy || page === 0} onClick={() => changePage(page - 1)}>Назад</button><span>Страница {page + 1} из {data?.totalPages}</span><button type="button" disabled={busy || page + 1 >= (data?.totalPages ?? 0)} onClick={() => changePage(page + 1)}>Далее</button></div>}
    </div>
  </section>
}
