import { UiInput } from './FormControls'
import { useEffect, useState } from 'react'
import { getGroupedWaybills } from '../api'
import type { GroupedWaybill, GroupedWaybillPage, WaybillLink } from '../domain'
import { canAddWaybill, toSelectedWaybill, type SelectedWaybill } from '../orderForm'
import { getWaybillStationName } from '../waybillOptions'

type Props = {
  selected: SelectedWaybill[]
  onConfirm: (waybills: SelectedWaybill[]) => void
  onClose: () => void
}

export function WaybillSelectionModal({ selected, onConfirm, onClose }: Props) {
  const [draft, setDraft] = useState<SelectedWaybill[]>(selected)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<GroupedWaybillPage | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getGroupedWaybills({}, page, 10, true)
      .then((response) => active && setData(response))
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить накладные')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [page])

  const selectedIds = new Set(draft.map((waybill) => waybill.id))
  const selectedGroupKey = draft[0]?.groupKey

  const toggleOne = (group: GroupedWaybill, waybill: WaybillLink) => {
    if (selectedIds.has(waybill.id)) {
      setDraft((current) => current.filter((item) => item.id !== waybill.id))
      return
    }
    const candidate = toSelectedWaybill(group, waybill)
    if (canAddWaybill(draft, candidate)) setDraft((current) => [...current, candidate])
  }

  const toggleGroup = (group: GroupedWaybill) => {
    const allSelected = group.waybills.every((waybill) => selectedIds.has(waybill.id))
    if (allSelected) {
      setDraft((current) => current.filter((waybill) => waybill.groupKey !== group.groupKey))
      return
    }
    if (selectedGroupKey && selectedGroupKey !== group.groupKey) return
    setDraft((current) => {
      const currentIds = new Set(current.map((waybill) => waybill.id))
      return [
        ...current,
        ...group.waybills
          .filter((waybill) => !currentIds.has(waybill.id))
          .map((waybill) => toSelectedWaybill(group, waybill)),
      ]
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="waybill-picker" role="dialog" aria-modal="true" aria-labelledby="waybill-picker-title">
        <header className="waybill-picker-header">
          <div><h2 id="waybill-picker-title">Выбор накладных</h2><p>Доступны только накладные, ещё не включённые в заявку.</p></div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Закрыть">×</button>
        </header>

        {error && <div className="notice error" role="alert">{error}</div>}
        {selectedGroupKey && <div className="picker-group-hint">Выбрана одна группа. Очистите выбор, чтобы перейти к другому маршруту.</div>}

        <div className="waybill-picker-list">
          {loading && <div className="table-message">Загружаем свободные накладные…</div>}
          {!loading && data?.content.length === 0 && <div className="inline-empty">Свободных накладных не найдено</div>}
          {!loading && data?.content.map((group) => {
            const groupDisabled = Boolean(selectedGroupKey && selectedGroupKey !== group.groupKey)
            const allSelected = group.waybills.length > 0 && group.waybills.every((waybill) => selectedIds.has(waybill.id))
            const isExpanded = expanded.has(group.groupKey)
            return (
              <article className={`picker-group ${groupDisabled ? 'disabled' : ''}`} key={group.groupKey}>
                <div className="picker-group-row">
                  <UiInput type="checkbox" checked={allSelected} disabled={groupDisabled} onChange={() => toggleGroup(group)} aria-label={`Выбрать группу ${group.groupKey}`} />
                  <button type="button" className="expand-button" onClick={() => setExpanded((current) => {
                    const next = new Set(current)
                    if (next.has(group.groupKey)) next.delete(group.groupKey); else next.add(group.groupKey)
                    return next
                  })}><span>{isExpanded ? '⌄' : '›'}</span>{getWaybillStationName(group.departureStation)} → {getWaybillStationName(group.destinationStation)}</button>
                  <span>{group.payer}</span>
                  <span>{group.waybillCount} накл.</span>
                  <span>{group.railwayCarriageCount} ваг. / {group.containerCount} КТК</span>
                </div>
                {isExpanded && (
                  <div className="picker-waybills">
                    {group.waybills.map((waybill) => (
                      <label key={waybill.id} className="picker-waybill-row">
                        <UiInput type="checkbox" checked={selectedIds.has(waybill.id)} disabled={groupDisabled} onChange={() => toggleOne(group, waybill)} />
                        <strong>{waybill.number}</strong>
                        <span>{waybill.railwayCarriageCount} вагонов</span>
                        <span>{waybill.containerCount} КТК</span>
                      </label>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>

        <footer className="waybill-picker-footer">
          <div className="pagination compact-pagination">
            <button disabled={page === 0 || loading} onClick={() => { setLoading(true); setError(''); setPage((current) => current - 1) }}>Назад</button>
            <span>Страница {page + 1}{data?.totalPages ? ` из ${data.totalPages}` : ''}</span>
            <button disabled={loading || page + 1 >= (data?.totalPages ?? 0)} onClick={() => { setLoading(true); setError(''); setPage((current) => current + 1) }}>Далее</button>
          </div>
          <div className="picker-actions"><span>Выбрано: {draft.length}</span><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button type="button" className="primary-button" onClick={() => onConfirm(draft)}>Добавить</button></div>
        </footer>
      </section>
    </div>
  )
}
