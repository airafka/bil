import { ContainerStatusBadge } from '../components/ContainerStatusBadge'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getReferenceOptions, getOwnershipOrders, getOwnershipOrder, createOwnershipOrder, updateOwnershipOrder, getOwnershipAvailable, saveOwnershipSelection, acceptOwnershipOrder, deleteOwnershipOrder } from '../api'
import { type OwnershipContainer, type OwnershipDetails, type OwnershipHeader } from '../containerStock'
import type { PagedResponse, ReferenceOption } from '../domain'
import { UiInput, UiSelect } from '../components/FormControls'

export function OwnershipOrderRegistryPage() {
  const [data, setData] = useState<PagedResponse<OwnershipHeader> | null>(null), [page, setPage] = useState(0), [query, setQuery] = useState(''), [error, setError] = useState('')
  useEffect(() => { let active = true; getOwnershipOrders(query, page).then(v => { if (active) setData(v) }).catch(e => { if (active) setError(String(e)) }); return () => { active = false } }, [query, page])
  return <section className="registry-page"><div className="page-header"><h1>Заявки на смену собственника</h1><Link className="primary-button" to="/service-orders/new">Создать заявку</Link></div>
    <UiInput aria-label="Поиск заявки на смену собственника" placeholder="Номер, клиент или комментарий" value={query} onChange={e => { setQuery(e.target.value); setPage(0); setData(null) }} />{error && <div className="notice error" role="alert">{error}</div>}
    <div className="table-card"><div className="table-wrap"><table><thead><tr><th>Номер</th><th>Новый собственник</th><th>КТК</th><th>Статус</th><th>Выполнена</th></tr></thead><tbody>
      {!data && !error && <tr><td colSpan={5}>Загружаем заявки…</td></tr>}{data?.items.length === 0 && <tr><td colSpan={5}>Заявок пока нет</td></tr>}
      {data?.items.map(row => <tr key={row.id}><td><Link to={'/service-orders/' + row.id}>{row.number}</Link></td><td>{row.clientName}</td><td>{row.containerQuantity}</td><td>{row.status === 'DONE' ? 'Выполнена' : 'Черновик'}</td><td>{row.completionAt ? new Date(row.completionAt + 'Z').toLocaleString('ru-RU') : '—'}</td></tr>)}
    </tbody></table></div>{data && data.totalPages > 1 && <div className="pagination"><button disabled={!page} onClick={() => { setPage(page - 1); setData(null) }}>Назад</button><span>{page + 1} / {data.totalPages}</span><button disabled={page + 1 >= data.totalPages} onClick={() => { setPage(page + 1); setData(null) }}>Далее</button></div>}</div></section>
}

export function OwnershipOrderCreatePage() {
  const [clients, setClients] = useState<ReferenceOption[]>([]), [client, setClient] = useState(''), [comment, setComment] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const lock = useRef(false), navigate = useNavigate()
  useEffect(() => { let active = true; getReferenceOptions('clients').then(v => { if (active) setClients(v) }).catch(e => { if (active) setError(String(e)) }); return () => { active = false } }, [])
  async function create() { if (lock.current || !client) return; lock.current = true; setBusy(true); setError(''); try { const result = await createOwnershipOrder(client, comment); navigate('/service-orders/' + result.order.id) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { lock.current = false; setBusy(false) } }
  return <section className="form-page"><div className="page-header"><h1>Смена собственника КТК</h1><Link to="/service-orders">К реестру</Link></div><div className="form-section"><label className="field"><span>Новый собственник *</span><UiSelect value={client} onChange={e => setClient(e.target.value)}><option value="">Выберите клиента</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</UiSelect></label><label className="field"><span>Услуга</span><UiInput value="Смена собственника" readOnly /></label><label className="field"><span>Комментарий</span><UiInput maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} /></label><p>КТК выбираются из регистра собственников после создания черновика.</p>{error && <div className="notice error" role="alert">{error}</div>}<button className="primary-button" disabled={busy || !client} onClick={create}>{busy ? 'Сохраняем…' : 'Создать черновик'}</button></div></section>
}

export function OwnershipOrderViewPage() {
  const { ownershipOrderId = '' } = useParams(), navigate = useNavigate()
  const [data, setData] = useState<OwnershipDetails | null>(null), [comment, setComment] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(0)
  const [available, setAvailable] = useState<PagedResponse<OwnershipContainer> | null>(null), [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const lock = useRef(false)
  useEffect(() => { let active = true; getOwnershipOrder(ownershipOrderId).then(v => { if (active) { setData(v); setComment(v.order.comment || ''); setSelected(new Set(v.containers.map(c => c.containerOwnerId))) } }).catch(e => { if (active) setError(String(e)) }); return () => { active = false } }, [ownershipOrderId, revision])
  const draft = data?.order.status === 'DRAFT'
  useEffect(() => { if (!draft) return; let active = true; getOwnershipAvailable(ownershipOrderId, query, page).then(v => { if (active) setAvailable(v) }).catch(e => { if (active) setError(String(e)) }); return () => { active = false } }, [ownershipOrderId, draft, query, page, revision])
  async function save(accept: boolean) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('')
    try { await updateOwnershipOrder(ownershipOrderId, comment); await saveOwnershipSelection(ownershipOrderId, [...selected]); const result = accept ? await acceptOwnershipOrder(ownershipOrderId) : await getOwnershipOrder(ownershipOrderId); setData(result); setRevision(v => v + 1); setMessage(accept ? 'Собственник изменён. Заявка выполнена.' : 'Заявка сохранена') } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { lock.current = false; setBusy(false) }
  }
  async function remove() { if (lock.current) return; lock.current = true; setBusy(true); try { await deleteOwnershipOrder(ownershipOrderId); navigate('/service-orders') } catch (e) { setError(String(e)); lock.current = false; setBusy(false) } }
  if (!data) return <div role={error ? 'alert' : 'status'}>{error || 'Загружаем заявку…'}</div>
  const rows = draft ? available?.items ?? [] : data.containers
  return <section className="form-page"><div className="page-header"><h1>Смена собственника № {data.order.number}</h1><Link to="/service-orders">К реестру</Link></div><div className="form-section"><dl className="details-grid"><div><dt>Новый собственник</dt><dd>{data.order.clientName}</dd></div><div><dt>Статус</dt><dd>{draft ? 'Черновик' : 'Выполнена'}</dd></div><div><dt>Время выполнения</dt><dd>{data.order.completionAt ? new Date(data.order.completionAt + 'Z').toLocaleString('ru-RU') : '—'}</dd></div></dl><label className="field"><span>Комментарий</span><UiInput readOnly={!draft} value={comment} maxLength={1000} onChange={e => setComment(e.target.value)} /></label></div>
    {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice" role="status">{message}</div>}
    {draft && <><p>Выбрано КТК: {selected.size}. Доступны КТК другого собственника, не выбранные в других черновиках.</p>{data.containers.length > 0 && <div className="form-section"><strong>Сохранённый выбор</strong>{data.containers.map(c => <label className="field" key={c.id}><span><input type="checkbox" checked={selected.has(c.containerOwnerId)} disabled={busy} onChange={e => setSelected(previous => { const next = new Set(previous); if (e.target.checked) next.add(c.containerOwnerId); else next.delete(c.containerOwnerId); return next })} /> {c.containerName} · {c.clientName}</span></label>)}</div>}<UiInput aria-label="Поиск доступных КТК" placeholder="Номер КТК или собственник" value={query} onChange={e => { setQuery(e.target.value); setPage(0); setAvailable(null) }} /></>}
    <div className="table-card"><div className="table-wrap"><table><thead><tr>{draft && <th>Выбрать</th>}<th>Номер КТК</th><th>Текущий собственник</th><th>Состояние</th><th>История</th></tr></thead><tbody>
      {draft && !available && <tr><td colSpan={5}>Загружаем доступные КТК…</td></tr>}{rows.length === 0 && (!draft || available) && <tr><td colSpan={draft ? 5 : 4}>Доступных КТК нет</td></tr>}
      {rows.map(row => <tr key={row.containerId}>{draft && <td><input aria-label={'Выбрать КТК ' + row.containerName} type="checkbox" disabled={busy} checked={selected.has(row.containerOwnerId)} onChange={e => setSelected(current => { const next = new Set(current); if (e.target.checked) next.add(row.containerOwnerId); else next.delete(row.containerOwnerId); return next })} /></td>}<td>{row.containerName}</td><td>{row.clientName || '—'}</td><td><ContainerStatusBadge status={row.status} /></td><td><Link to={'/container-owners/' + row.containerId + '/history'}>История</Link></td></tr>)}
    </tbody></table></div>{draft && available && available.totalPages > 1 && <div className="pagination"><button disabled={!page} onClick={() => { setPage(page - 1); setAvailable(null) }}>Назад</button><span>{page + 1} / {available.totalPages}</span><button disabled={page + 1 >= available.totalPages} onClick={() => { setPage(page + 1); setAvailable(null) }}>Далее</button></div>}</div>
    {draft && <div className="form-footer"><button className="secondary-button" disabled={busy} onClick={remove}>Удалить черновик</button><button className="secondary-button" disabled={busy} onClick={() => save(false)}>Сохранить</button><button className="primary-button" disabled={busy || selected.size === 0} onClick={() => save(true)}>{busy ? 'Сохраняем…' : 'Выполнить смену собственника'}</button></div>}
  </section>
}
