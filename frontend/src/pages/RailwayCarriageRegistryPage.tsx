import { useEffect, useState } from 'react'
import { getRailwayCarriagePage, getReferenceOptions, updateRailwayCarriage } from '../api'
import type { ReferenceOption } from '../domain'
import type { RailwayCarriage, RailwayCarriagePatch } from '../railwayCarriages'
import { RowActions } from '../components/RowActions'
import { UiInput, UiSelect } from '../components/FormControls'

export function RailwayCarriageRegistryPage() {
  const [rows, setRows] = useState<RailwayCarriage[]>([])
  const [models, setModels] = useState<ReferenceOption[]>([])
  const [kinds, setKinds] = useState<ReferenceOption[]>([])
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(0)
  const [loadedPage, setLoadedPage] = useState(-1)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([getRailwayCarriagePage(page), getReferenceOptions('railway-carriage-models'), getReferenceOptions('railway-carriage-kinds')])
      .then(([result, modelOptions, typeOptions]) => {
        if (!active) return
        setRows(result.items); setPages(result.totalPages); setModels(modelOptions); setKinds(typeOptions); setError('')
      }).catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : 'Ошибка загрузки вагонов'); setRows([]) } })
      .finally(() => { if (active) setLoadedPage(page) })
    return () => { active = false }
  }, [page])
  const loading = loadedPage !== page
  return <section className="registry-page">
    <div className="page-header"><h1>Справочник вагонов</h1></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="table-card"><div className="table-wrap"><table aria-label="Справочник вагонов">
      <thead><tr><th>№</th><th>Номер вагона</th><th>Модель вагона</th><th>Грузоподъёмность, кг</th><th>Дата следующего ДР</th><th>Род вагона</th><th aria-label="Действия" /></tr></thead>
      <tbody>{loading ? <tr><td colSpan={7}>Загружаем вагоны…</td></tr> : rows.length ? rows.map((row, index) =>
        <CarriageRow key={row.id} initial={row} index={page * 20 + index + 1} models={models} kinds={kinds} />
      ) : <tr><td colSpan={7}>Вагоны не найдены</td></tr>}</tbody>
    </table></div></div>
    <div className="pagination"><button className="secondary-button" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Назад</button><span>Страница {page + 1} из {Math.max(pages, 1)}</span><button className="secondary-button" disabled={loading || page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Далее</button></div>
  </section>
}

const toDraft = (row: RailwayCarriage): RailwayCarriagePatch => ({ modelId: row.modelId, loadCapacity: row.loadCapacity == null ? null : String(row.loadCapacity), nextDepotRepairDate: row.nextDepotRepairDate, carriageTypeId: row.carriageTypeId })
function CarriageRow({ initial, index, models, kinds }: { initial: RailwayCarriage; index: number; models: ReferenceOption[]; kinds: ReferenceOption[] }) {
  const [row, setRow] = useState(initial)
  const [draft, setDraft] = useState(() => toDraft(initial))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    const capacity = draft.loadCapacity?.trim().replace(',', '.') || null
    if (capacity !== null && (!/^\d{1,12}(\.\d{1,3})?$/.test(capacity) || Number(capacity) <= 0)) {
      setError('Укажите положительную грузоподъёмность: до 12 цифр и 3 знаков после запятой'); return
    }
    setSaving(true); setError('')
    try { const result = await updateRailwayCarriage(row.id, { ...draft, loadCapacity: capacity }); setRow(result); setDraft(toDraft(result)); setEditing(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка сохранения') }
    finally { setSaving(false) }
  }
  const select = (key: 'modelId' | 'carriageTypeId', label: string, options: ReferenceOption[]) => <UiSelect aria-label={label + ' — ' + row.name} value={draft[key] ?? ''} disabled={saving} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value || null }))}>
    <option value="">{options.length ? 'Не указан' : 'Справочник пуст'}</option>
    {options.map(option => <option value={option.id} key={option.id}>{option.name}</option>)}
  </UiSelect>
  return <tr><td>{index}</td><td>{row.name}</td>
    <td>{editing ? select('modelId', 'Модель вагона', models) : row.modelName || '—'}</td>
    <td>{editing ? <UiInput aria-label={'Грузоподъёмность — ' + row.name} inputMode="decimal" value={draft.loadCapacity ?? ''} disabled={saving} onChange={e => setDraft(d => ({ ...d, loadCapacity: e.target.value || null }))} /> : row.loadCapacity?.toLocaleString('ru-RU') ?? '—'}</td>
    <td>{editing ? <UiInput aria-label={'Дата следующего ДР — ' + row.name} type="date" value={draft.nextDepotRepairDate ?? ''} disabled={saving} onChange={e => setDraft(d => ({ ...d, nextDepotRepairDate: e.target.value || null }))} /> : row.nextDepotRepairDate?.split('-').reverse().join('.') || '—'}</td>
    <td>{editing ? select('carriageTypeId', 'Род вагона', kinds) : row.carriageTypeName || '—'}</td>
    <td>{editing ? <><button className="primary-button" disabled={saving} onClick={save}>Сохранить</button><button className="secondary-button" disabled={saving} onClick={() => { setDraft(toDraft(row)); setError(''); setEditing(false) }}>Отмена</button></> : <RowActions label={'Действия с вагоном ' + row.name} actions={[{ label: 'Редактировать', onClick: () => setEditing(true) }]} />}{error && <div role="alert">{error}</div>}</td>
  </tr>
}
