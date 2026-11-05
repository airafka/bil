import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { RecordRow } from '../components/RecordRow'
import { Notification } from '../components/Notification'
import { ActionIcon } from '../components/ActionIcon'
import { RowActions } from '../components/RowActions'
import { UiInput, UiSelect, UiTextarea } from '../components/FormControls'
import { getReferenceOptions, getOwnershipOrders, getOwnershipOrder, createOwnershipOrder, updateOwnershipOrder, getOwnershipAvailable, getOwnershipAvailableForCreate, saveOwnershipSelection, acceptOwnershipOrder, deleteOwnershipOrder } from '../api'
import type { OwnershipContainer, OwnershipDetails, OwnershipHeader } from '../containerStock'
import { containerTypeLabel, type PagedResponse, type ReferenceOption } from '../domain'
import { ContainerStatusBadge } from '../components/ContainerStatusBadge'
import '../ownership-order.css'

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
const completedAt = (value: string | null) => value ? new Date(value + 'Z').toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) : '—'
function OwnershipStatus({ status }: { status: string }) {
  return <span className={'ownership-status ' + (status === 'DONE' ? 'ownership-status-done' : '')}>{status === 'DONE' ? 'Выполнено' : 'Черновик'}</span>
}
function CloseLink() {
  return <Link className="close-button" to="/service-orders" aria-label="Закрыть" title="Закрыть"><ActionIcon name="close" /></Link>
}
function OwnershipTabs({ tab, change, disabled = false }: { tab: string; change: (tab: 'main' | 'containers') => void; disabled?: boolean }) {
  return <div className="stepper view-tabs" role="tablist" aria-label="Разделы смены собственника КТК">
    <button type="button" role="tab" aria-selected={tab === 'main'} className={'step ' + (tab === 'main' ? 'current' : '')} disabled={disabled} onClick={() => change('main')}>Основное</button>
    <button type="button" role="tab" aria-selected={tab === 'containers'} className={'step ' + (tab === 'containers' ? 'current' : '')} disabled={disabled} onClick={() => change('containers')}>КТК</button>
  </div>
}
function Pagination({ data, change }: { data: PagedResponse<unknown>; change: (page: number) => void }) {
  return data.totalPages > 1 && <div className="pagination"><button disabled={!data.page} onClick={() => change(data.page - 1)}>Назад</button><span>{data.page + 1} / {data.totalPages}</span><button disabled={data.page + 1 >= data.totalPages} onClick={() => change(data.page + 1)}>Далее</button></div>
}

export function OwnershipOrderRegistryPage() {
  const [data, setData] = useState<PagedResponse<OwnershipHeader> | null>(null)
  const [page, setPage] = useState(0), [query, setQuery] = useState(''), [error, setError] = useState('')
  const [deleting, setDeleting] = useState<OwnershipHeader | null>(null), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const [message, setMessage] = useState('')
  useEffect(() => { let active = true; getOwnershipOrders(query, page).then(v => { if (active) setData(v) }).catch(e => { if (active) setError(errorText(e)) }); return () => { active = false } }, [query, page, revision])
  async function remove() {
    if (!deleting || busy) return
    setBusy(true); setError('')
    try { await deleteOwnershipOrder(deleting.id); setDeleting(null); setData(null); setPage(0); setRevision(v => v + 1); setMessage('Заявка удалена') }
    catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return <section className="registry-page ownership-page">
    <div className="page-header"><h1>Смена собственника КТК</h1><Link className="primary-button create-action-button" to="/service-orders/new"><ActionIcon name="plus" /> Создать</Link></div>
    {error && <Notification kind="error">{error}</Notification>}{message && <Notification kind="success">{message}</Notification>}
    <div className="table-card"><div className="ownership-toolbar"><UiInput aria-label="Поиск заявки на смену собственника" placeholder="Поиск" value={query} onChange={e => { setQuery(e.target.value); setPage(0); setData(null) }} /></div>
      <div className="table-wrap"><table className="ownership-registry-table"><thead><tr><th className="registry-index">№</th><th>Номер заявки</th><th>Новый собственник</th><th>Количество КТК</th><th>Статус</th><th>Дата выполнения</th><th>Комментарий</th><th className="registry-actions" aria-label="Действия" /></tr></thead><tbody>
        {!data && !error && <tr><td colSpan={8}>Загружаем заявки…</td></tr>}{data?.items.length === 0 && <tr><td colSpan={8}>Заявок пока нет</td></tr>}
        {data?.items.map((row, index) => <RecordRow to={'/service-orders/' + row.id} key={row.id}><td className="registry-index">{data.page * data.size + index + 1}</td><td><Link className="order-code" to={'/service-orders/' + row.id}>{row.number}</Link></td><td>{row.clientName}</td><td>{row.containerQuantity}</td><td><OwnershipStatus status={row.status} /></td><td>{completedAt(row.completionAt)}</td><td>{row.comment || '—'}</td><td className="registry-actions"><RowActions label={'Действия с заявкой ' + row.number} disabled={busy} actions={[{ label: 'Открыть', to: '/service-orders/' + row.id }, ...(row.status === 'DRAFT' ? [{ label: 'Изменить', to: '/service-orders/' + row.id + '?edit=1' }, { label: 'Удалить', onClick: () => setDeleting(row) }] : [])]} /></td></RecordRow>)}
      </tbody></table></div>{data && <Pagination data={data} change={value => { setPage(value); setData(null) }} />}
    </div>
    {deleting && <div className="modal-backdrop"><div className="complex-service-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ownership-delete-title"><h2 id="ownership-delete-title">Удалить заявку {deleting.number}?</h2><p>Черновик будет удалён, выбранные КТК освободятся для других заявок.</p><div className="complex-service-dialog-actions"><button className="secondary-button" disabled={busy} onClick={() => setDeleting(null)}>Отмена</button><button className="primary-button" disabled={busy} onClick={remove}>{busy ? 'Удаляем…' : 'Удалить'}</button></div></div></div>}
  </section>
}

export function OwnershipOrderCreatePage() {
  const [clients, setClients] = useState<ReferenceOption[]>([]), [client, setClient] = useState(''), [comment, setComment] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'main' | 'containers'>('main')
  const [query, setQuery] = useState(''), [page, setPage] = useState(0)
  const [available, setAvailable] = useState<PagedResponse<OwnershipContainer> | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  useEffect(() => { if (!client) return; let active = true; getOwnershipAvailableForCreate(client, query, page).then(value => { if (active) setAvailable(value) }).catch(e => { if (active) setError(errorText(e)) }); return () => { active = false } }, [client, query, page])
  function changeTab(value: 'main' | 'containers') { if (value === 'containers' && !client) { setError('Выберите нового собственника КТК'); return }; setTab(value) }
  const lock = useRef(false), navigate = useNavigate()
  useEffect(() => { let active = true; getReferenceOptions('clients').then(v => { if (active) setClients(v) }).catch(e => { if (active) setError(errorText(e)) }); return () => { active = false } }, [])
  async function create() {
    if (lock.current) return
    if (!client) { setError('Выберите нового собственника КТК'); return }
    if (!selected.size) { setError('Выберите хотя бы один КТК'); setTab('containers'); return }
    lock.current = true; setBusy(true); setError('')
    try { const result = await createOwnershipOrder(client, comment, [...selected]); navigate('/service-orders/' + result.order.id) }
    catch (e) { setError(errorText(e)) } finally { lock.current = false; setBusy(false) }
  }
  return <section className="form-page ownership-page"><div className="page-header"><h1>Новая смена собственника КТК</h1><div className="header-actions"><CloseLink /><button className={tab === 'main' ? 'primary-button' : 'secondary-button'} disabled={busy} onClick={() => changeTab(tab === 'main' ? 'containers' : 'main')}>{tab === 'main' ? 'Далее →' : '← Назад'}</button>{tab === 'containers' && <button className="primary-button" disabled={busy} onClick={create}>{busy ? 'Сохраняем…' : 'Создать'}</button>}</div></div>
    {error && <Notification kind="error">{error}</Notification>}
    <div className="form-workspace"><div className="ownership-tabs-toolbar"><OwnershipTabs tab={tab} change={changeTab} disabled={busy} />{tab === 'containers' && <UiInput aria-label="Поиск доступных КТК" placeholder="Поиск" value={query} onChange={e => { setQuery(e.target.value); setPage(0); setAvailable(null) }} />}</div>
      {tab === 'main' && <>
      <section className="form-section ui-form-section"><div className="form-section-heading"><h2>Основная информация</h2></div>
        <div className="form-fields-grid"><div className="form-fields-column">
          <label className="field horizontal-field"><span>Номер заявки</span><UiInput value="" readOnly /></label>
          <label className="field horizontal-field"><span>Количество КТК</span><UiInput value={selected.size} readOnly /></label>
          <label className="field horizontal-field"><span>Новый собственник <b>*</b></span><UiSelect disabled={busy} value={client} onChange={e => { setClient(e.target.value); setSelected(new Set()); setAvailable(null); setQuery(''); setPage(0); setError('') }}><option value="" hidden disabled />{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</UiSelect></label>
          <label className="field horizontal-field"><span>Услуга</span><UiInput value="Смена собственника КТК" readOnly /></label>
        </div><div className="form-fields-column"><div className="field horizontal-field"><span>Статус</span><div className="ownership-status-field"><OwnershipStatus status="DRAFT" /></div></div></div></div>
      </section>
      <section className="form-section ui-form-section"><div className="form-section-heading"><h2>Дополнительная информация</h2></div><label className="field horizontal-field ownership-comment"><span>Комментарий</span><UiTextarea disabled={busy} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} placeholder="Введите комментарий" /></label></section>
      </>}
      {tab === 'containers' && <><OwnershipContainerTable rows={available?.items ?? []} loading={!available} selected={selected} busy={busy} onToggle={(id, checked) => setSelected(previous => { const next = new Set(previous); if (checked) next.add(id); else next.delete(id); return next })} />{available && <Pagination data={available} change={value => { setPage(value); setAvailable(null) }} />}</>}
    </div>
  </section>
}

export function OwnershipOrderViewPage() {
  const { ownershipOrderId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const editingRequested = params.get('edit') === '1'
  const tab = params.get('tab') === 'containers' ? 'containers' : 'main'
  const [data, setData] = useState<OwnershipDetails | null>(null), [comment, setComment] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(0)
  const [available, setAvailable] = useState<PagedResponse<OwnershipContainer> | null>(null), [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const lock = useRef(false)
  function apply(value: OwnershipDetails) { setData(value); setComment(value.order.comment || ''); setSelected(new Set(value.containers.map(c => c.containerOwnerId))) }
  useEffect(() => { let active = true; getOwnershipOrder(ownershipOrderId).then(v => { if (active) apply(v) }).catch(e => { if (active) setError(errorText(e)) }); return () => { active = false } }, [ownershipOrderId])
  const draft = data?.order.status === 'DRAFT', editing = draft && editingRequested
  useEffect(() => { if (!editing) return; let active = true; getOwnershipAvailable(ownershipOrderId, query, page).then(v => { if (active) setAvailable(v) }).catch(e => { if (active) setError(errorText(e)) }); return () => { active = false } }, [ownershipOrderId, editing, query, page, revision])
  function changeTab(value: 'main' | 'containers') { setParams({ ...(editing ? { edit: '1' } : {}), ...(value === 'containers' ? { tab: value } : {}) }, { replace: true }) }
  function finishEditing() { setParams(tab === 'containers' ? { tab } : {}, { replace: true }); setAvailable(null); setQuery(''); setPage(0) }
  async function save(accept: boolean) {
    if (lock.current) return
    if (editing && !selected.size) { setError('Выберите хотя бы один КТК'); return }
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      if (editing) { await updateOwnershipOrder(ownershipOrderId, comment); await saveOwnershipSelection(ownershipOrderId, [...selected]) }
      const result = accept ? await acceptOwnershipOrder(ownershipOrderId) : await getOwnershipOrder(ownershipOrderId)
      apply(result); finishEditing(); setRevision(v => v + 1); setMessage(accept ? 'Собственник изменён. Заявка выполнена.' : 'Заявка сохранена')
    } catch (e) { setError(errorText(e)) } finally { lock.current = false; setBusy(false) }
  }
  function toggle(id: string, checked: boolean) { setSelected(previous => { const next = new Set(previous); if (checked) next.add(id); else next.delete(id); return next }) }
  if (!data) return <section className="form-page"><div className="page-header"><h1>Смена собственника КТК</h1><CloseLink /></div>{error ? <Notification kind="error">{error}</Notification> : <p role="status">Загружаем заявку…</p>}</section>
  const rows = editing ? available?.items ?? [] : data.containers
  return <section className="form-page ownership-page"><div className="page-header"><h1>Смена собственника КТК №{data.order.number}</h1><div className="header-actions">
    {editing ? <><button className="secondary-button" disabled={busy} onClick={() => { apply(data); finishEditing(); setError('') }}>Отмена</button>{tab === 'containers' && <button className="secondary-button" disabled={busy} onClick={() => changeTab('main')}>← Назад</button>}<button className="primary-button" disabled={busy} onClick={() => save(false)}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>{tab === 'main' && <button className="primary-button" disabled={busy} onClick={() => changeTab('containers')}>Далее →</button>}</> : draft && <><button type="button" className="secondary-button icon-button" aria-label="Редактировать" title="Редактировать" disabled={busy} onClick={() => { setParams({ edit: '1', ...(tab === 'containers' ? { tab } : {}) }, { replace: true }); setMessage('') }}><ActionIcon name="edit" /></button><button className="primary-button" disabled={busy || !data.containers.length} onClick={() => save(true)}>{busy ? 'Подтверждаем…' : 'Подтвердить'}</button></>}
    <CloseLink />
  </div></div>
    {error && <Notification kind="error">{error}</Notification>}{message && <Notification kind="success">{message}</Notification>}
    <div className="form-workspace"><div className="ownership-tabs-toolbar"><OwnershipTabs tab={tab} change={changeTab} disabled={busy} />{tab === 'containers' && editing && <UiInput aria-label="Поиск доступных КТК" placeholder="Поиск" value={query} disabled={busy} onChange={e => { setQuery(e.target.value); setPage(0); setAvailable(null) }} />}</div>
      {tab === 'main' && <><section className="form-section ui-form-section"><div className="form-section-heading"><h2>Основная информация</h2></div><dl className="details-grid">
        <div><dt>Номер заявки</dt><dd>{data.order.number}</dd></div><div><dt>Статус</dt><dd><OwnershipStatus status={data.order.status} /></dd></div>
        <div><dt>Количество КТК</dt><dd>{editing ? selected.size : data.order.containerQuantity}</dd></div><div><dt>Дата выполнения</dt><dd>{completedAt(data.order.completionAt)}</dd></div>
        <div><dt>Новый собственник</dt><dd>{data.order.clientName}</dd></div><div className="ownership-service-field"><dt>Услуга</dt><dd>Смена собственника КТК</dd></div>
      </dl></section><section className="form-section ui-form-section"><div className="form-section-heading"><h2>Дополнительная информация</h2></div>{editing ? <label className="field horizontal-field ownership-comment"><span>Комментарий</span><UiTextarea disabled={busy} value={comment} maxLength={1000} onChange={e => setComment(e.target.value)} placeholder="Введите комментарий" /></label> : <dl className="details-grid"><div className="details-wide"><dt>Комментарий</dt><dd className="ownership-comment-text">{data.order.comment || '—'}</dd></div></dl>}</section></>}
      {tab === 'containers' && <><OwnershipContainerTable rows={rows} loading={Boolean(editing && !available)} selected={editing ? selected : undefined} busy={busy} onToggle={editing ? toggle : undefined} />{editing && available && <Pagination data={available} change={value => { setPage(value); setAvailable(null) }} />}</>}
    </div>

  </section>
}

function OwnershipContainerTable({ rows, loading, selected, busy, onToggle }: { rows: OwnershipContainer[]; loading: boolean; selected?: Set<string>; busy: boolean; onToggle?: (id: string, checked: boolean) => void }) {
  const previewDialog = useRef<HTMLDialogElement>(null)
  const [preview, setPreview] = useState<OwnershipContainer | null>(null)
  function showPreview(row: OwnershipContainer) { setPreview(row); previewDialog.current?.showModal() }
  const selectable = Boolean(onToggle)
  return <><div className="table-wrap"><table className="ownership-container-table"><thead><tr><th className="registry-index">{selectable ? '' : '№'}</th><th>КТК</th><th>Текущий собственник</th><th className="registry-actions" aria-label="Действия" /></tr></thead><tbody>
        {selectable && loading && <tr><td colSpan={4}>Загружаем доступные КТК…</td></tr>}{rows.length === 0 && (!loading) && <tr><td colSpan={4}>{selectable ? 'Доступных КТК не найдено' : 'КТК не выбраны'}</td></tr>}
        {rows.map((row, index) => <tr key={row.containerId}><td className="registry-index">{selectable ? <UiInput aria-label={'Выбрать КТК ' + row.containerName} type="checkbox" disabled={busy} checked={selected?.has(row.containerOwnerId)} onChange={e => onToggle?.(row.containerOwnerId, e.target.checked)} /> : index + 1}</td><td><button type="button" className="link-button" onClick={() => showPreview(row)}>{row.containerName}</button></td><td>{row.clientName || '—'}</td><td className="registry-actions"><RowActions label={'Действия с КТК ' + row.containerName} actions={[{ label: 'Предпросмотр', onClick: () => showPreview(row) }, { label: 'История собственников', to: '/container-owners/' + row.containerId + '/history' }]} /></td></tr>)}
      </tbody></table></div>
    <dialog ref={previewDialog} className="ownership-preview" aria-labelledby="ownership-preview-title">
      <div className="page-header"><h2 id="ownership-preview-title">КТК {preview?.containerName}</h2><button type="button" className="close-button" aria-label="Закрыть предпросмотр" onClick={() => previewDialog.current?.close()}><ActionIcon name="close" /></button></div>
      {preview && <dl className="details-grid"><div><dt>Номер КТК</dt><dd>{preview.containerName}</dd></div><div><dt>Тип</dt><dd>{containerTypeLabel(preview.containerType as Parameters<typeof containerTypeLabel>[0])}</dd></div><div><dt>Текущий собственник</dt><dd>{preview.clientName || '—'}</dd></div><div><dt>Состояние</dt><dd><ContainerStatusBadge status={preview.status} /></dd></div></dl>}
    </dialog></>
}
