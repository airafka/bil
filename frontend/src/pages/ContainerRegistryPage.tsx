import { UiInput } from '../components/FormControls'
import { useEffect, useState } from 'react'
import { getReferenceOptions, updateContainerTare } from '../api'
import type { ReferenceOption } from '../domain'
import { containerTypeLabel } from '../domain'
import { massInGrams } from '../waybillForm'

export function ContainerRegistryPage() {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<ReferenceOption[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getReferenceOptions('containers', query).then(value => { if (active) setRows(value) })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Ошибка загрузки КТК') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])
  return <section className="registry-page">
    <div className="page-header"><h1>Справочник КТК</h1></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <label className="field"><span>Поиск по номеру КТК</span><UiInput value={query} onChange={e => { setQuery(e.target.value); setLoading(true); setError('') }} placeholder="Введите номер" /></label>
    <div className="table-card"><div className="table-toolbar"><strong>Контейнеры</strong><span>Масса тары в килограммах</span></div><div className="table-wrap"><table><thead><tr><th>Номер КТК</th><th>Типоразмер</th><th>Масса тары, кг</th><th /></tr></thead><tbody>
      {loading && <tr><td colSpan={4} className="table-message">Загружаем КТК…</td></tr>}
      {!loading && rows.length === 0 && <tr><td colSpan={4} className="table-message">КТК не найдены</td></tr>}
      {!loading && rows.map(row => <ContainerRow key={row.id} row={row} />)}
    </tbody></table></div></div>
  </section>
}
function ContainerRow({ row }: { row: ReferenceOption }) {
  const [tare, setTare] = useState(String(row.tareWeight ?? ''))
  const [savedTare, setSavedTare] = useState(String(row.tareWeight ?? ''))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const save = async () => {
    const value = massInGrams(tare)
    if (value === null || value <= 0n) { setMessage('Укажите положительную массу до трёх знаков после запятой'); return }
    setSaving(true); setMessage('')
    try { await updateContainerTare(row.id, tare.replace(',', '.')); setSavedTare(tare); setMessage('Сохранено') }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Ошибка сохранения') }
    finally { setSaving(false) }
  }
  return <tr><td>{row.name}</td><td>{row.type ? containerTypeLabel(row.type) : '—'}</td><td><label className="field"><UiInput aria-label={'Масса тары ' + row.name} inputMode="decimal" value={tare} onChange={e => { setTare(e.target.value); setMessage('') }} />{message && <small className={message === 'Сохранено' ? 'saved-feedback' : ''} role="status">{message}</small>}</label></td><td><button className="secondary-button" disabled={saving || tare === savedTare} onClick={save}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></td></tr>
}

