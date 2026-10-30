import { RowActions } from '../components/RowActions'
import { UiInput } from '../components/FormControls'
import { useEffect, useState } from 'react'
import { getReferenceOptions, updateContainerAttributes } from '../api'
import type { ReferenceOption } from '../domain'
import { containerTypeLabel } from '../domain'
import { massInGrams } from '../waybillForm'

export function ContainerRegistryPage() {
  const [rows, setRows] = useState<ReferenceOption[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getReferenceOptions('containers').then(value => { if (active) setRows(value) })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Ошибка загрузки КТК') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return <section className="registry-page">
    <div className="page-header"><h1>Справочник КТК</h1></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="table-card"><div className="table-wrap"><table><thead><tr><th className="registry-index" scope="col">№</th><th>Номер КТК</th><th>Типоразмер</th><th>Масса тары, кг</th><th>Грузоподъёмность, кг</th><th className="registry-actions" scope="col" aria-label="Действия" /></tr></thead><tbody>
      {loading && <tr><td colSpan={6} className="table-message">Загружаем КТК…</td></tr>}
      {!loading && rows.length === 0 && <tr><td colSpan={6} className="table-message">КТК не найдены</td></tr>}
      {!loading && rows.map((row, index) => <ContainerRow key={row.id} row={row} index={index} />)}
    </tbody></table></div></div>
  </section>
}
function ContainerRow({ row, index }: { row: ReferenceOption; index: number }) {
  const [editing, setEditing] = useState(false)
  const [tare, setTare] = useState(String(row.tareWeight ?? ''))
  const [savedTare, setSavedTare] = useState(String(row.tareWeight ?? ''))
  const [capacity, setCapacity] = useState(String(row.loadCapacity ?? ''))
  const [savedCapacity, setSavedCapacity] = useState(String(row.loadCapacity ?? ''))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const save = async () => {
    const value = massInGrams(tare)
    if (value === null || value <= 0n) { setMessage('Укажите положительную массу до трёх знаков после запятой'); return }
    if (capacity.trim() && (massInGrams(capacity) === null || massInGrams(capacity)! <= 0n || capacity.split(/[.,]/)[0].length > 12)) { setMessage('Укажите положительную грузоподъёмность до трёх знаков после запятой'); return }
    setSaving(true); setMessage('')
    try { await updateContainerAttributes(row.id, tare.replace(',', '.'), capacity.trim() ? capacity.replace(',', '.') : null); setSavedTare(tare); setSavedCapacity(capacity); setMessage('Сохранено'); setEditing(false) }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Ошибка сохранения') }
    finally { setSaving(false) }
  }
  return <tr><td className="registry-index">{index + 1}</td><td>{row.name}</td><td>{row.type ? containerTypeLabel(row.type) : '—'}</td><td>
    {editing ? <div className="container-tare-editor"><UiInput aria-label={'Масса тары ' + row.name} inputMode="decimal" value={tare} disabled={saving} onChange={e => { setTare(e.target.value); setMessage('') }} /><button type="button" className="primary-button" disabled={saving || (tare === savedTare && capacity === savedCapacity)} onClick={save}>{saving ? 'Сохраняем…' : 'Сохранить'}</button><button type="button" className="secondary-button" disabled={saving} onClick={() => { setTare(savedTare); setCapacity(savedCapacity); setMessage(''); setEditing(false) }}>Отмена</button></div> : <span>{savedTare ? Number(savedTare.replace(',', '.')).toLocaleString('ru-RU', { maximumFractionDigits: 3 }) : '—'}</span>}
    {message && <small className={message === 'Сохранено' ? 'saved-feedback' : ''} role="status">{message}</small>}
    </td><td>{editing ? <UiInput aria-label={'Грузоподъёмность ' + row.name} inputMode="decimal" value={capacity} disabled={saving} onChange={e => { setCapacity(e.target.value); setMessage('') }} /> : savedCapacity ? Number(savedCapacity.replace(',', '.')).toLocaleString('ru-RU') : '—'}</td><td className="registry-actions"><RowActions label={'Действия с КТК ' + row.name} disabled={editing} actions={[{ label: 'Редактировать', onClick: () => { setMessage(''); setEditing(true) } }]} /></td></tr>
}
