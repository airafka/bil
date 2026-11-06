import { createPortal } from 'react-dom'
import { RecordRow } from '../components/RecordRow'
import { Notification } from '../components/Notification'
import { ActionIcon } from '../components/ActionIcon'
import { RowActions } from '../components/RowActions'
import { StatusBadge } from '../components/StatusBadge'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { updatePaymentInvoice, markPaymentInvoicePaid, getInvoiceTariff, createPaymentInvoice, deletePaymentInvoice, getContracts, getInvoiceCandidates, getPaymentInvoice, getPaymentInvoices, getReferenceOptions } from '../api'
import type { PagedResponse, ReferenceOption } from '../domain'
import type { ContractOption } from '../comprehensiveServiceOrder'
import type { AppliedInvoiceTariff, InvoiceCandidates, InvoiceDetails, InvoiceFilters, InvoiceLine, PaymentInvoice } from '../invoices'
import { invoiceDate, invoiceMoney, invoicePeriod, selectedInvoiceTotals } from '../invoices'
import { UiInput, UiSelect } from '../components/FormControls'

const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Не удалось выполнить запрос'
const PAGE_SIZE = 25

function Pages({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  return totalPages > 1 && <div className="pagination invoice-pagination">
    <button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>Назад</button>
    <span>Страница {page + 1} из {totalPages}</span>
    <button type="button" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Далее</button>
  </div>
}

function LinesTable({ items, timeZone, selected, onToggle, onToggleAll, allSelected = false, partiallySelected = false, invoiceId, disabled = false }: {
  items: InvoiceLine[]; timeZone: string; invoiceId?: string; selected?: Set<string>; onToggle?: (id: string) => void; disabled?: boolean
  onToggleAll?: () => void; allSelected?: boolean; partiallySelected?: boolean
}) {
  const allCheckbox = useRef<HTMLInputElement>(null)
  useEffect(() => { if (allCheckbox.current) allCheckbox.current.indeterminate = partiallySelected && !allSelected }, [partiallySelected, allSelected])
  return <div className="table-wrap service-compact-table"><table className="invoice-lines-table" data-responsive-min-width={960}>
    <colgroup>{[...(onToggle ? [44] : []), 110, 110, 135, 400, ...(invoiceId ? [80] : []), 115, 115].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
    <thead><tr>{onToggle && <th scope="col" className="registry-index" aria-label="Выбор услуг">{onToggleAll && <UiInput ref={allCheckbox} type="checkbox" checked={allSelected} disabled={disabled || !items.length} onChange={onToggleAll} aria-label="Выбрать все услуги" title="Выбрать или снять выбор всех услуг, на всех страницах" />}</th>}<th scope="col" className="invoice-date-column">Дата оказания</th><th scope="col" className="invoice-order-column">Заявка на услугу</th><th scope="col" className="invoice-container-column">КТК</th><th scope="col">Услуга</th>{invoiceId && <th scope="col" className="invoice-tariff-column">Тариф</th>}<th scope="col">Без НДС, ₽</th><th scope="col">С НДС, ₽</th></tr></thead>
    <tbody>{items.map(item => <tr key={item.id}>
      {onToggle && <td className="registry-index"><UiInput type="checkbox" checked={selected?.has(item.id) ?? false} disabled={disabled} onChange={() => onToggle(item.id)} aria-label={`Выбрать ${item.serviceName}, КТК ${item.containerName}, заявка ${item.comprehensiveServiceOrderCode}, ${invoiceDate(item.performedAt, timeZone)}`} /></td>}
      <td>{invoiceDate(item.performedAt, timeZone)}</td>
      <td><Link to={`/comprehensive-service-orders/${item.comprehensiveServiceOrderId}`} target={onToggle ? '_blank' : undefined} rel={onToggle ? 'noreferrer' : undefined}>{item.comprehensiveServiceOrderCode}</Link></td>
      <td>{item.containerName}</td><td>{item.serviceName}</td>{invoiceId && <td>{item.tariffId ? <Link to={`/complex-services/tariffs/${item.tariffId}`} state={{ returnTo: '/payment-invoices/' + invoiceId }}>Открыть</Link> : '—'}</td>}<td>{invoiceMoney(item.amountWithoutVat)}</td><td>{invoiceMoney(item.amountWithVat)}</td>
    </tr>)}</tbody>
  </table></div>
}

export function InvoiceRegistryPage() {
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<PagedResponse<PaymentInvoice> | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<PaymentInvoice | null>(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')
  async function remove() {
    if (!deleting || busy) return
    setBusy(true); setError('')
    try {
      await deletePaymentInvoice(deleting.id)
      setDeleting(null); setSuccess('Счёт удалён')
      if (data?.items.length === 1 && page > 0) setPage(current => current - 1)
      else setAttempt(current => current + 1)
    } catch (cause) { setError(message(cause)); setDeleting(null); setAttempt(current => current + 1) }
    finally { setBusy(false) }
  }
  useEffect(() => {
    let active = true
    getPaymentInvoices(page).then(value => { if (active) setData(value) }).catch(cause => { if (active) setError(message(cause)) })
    return () => { active = false }
  }, [page, attempt])
  return <section className="registry-page">
    <div className="page-header"><h1>Счета на оплату</h1><Link className="primary-button" to="/payment-invoices/new"><ActionIcon name="plus" /> Создать</Link></div>
    {error && <Notification kind="error">{error}<button className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Повторить</button></Notification>}
    {success && <Notification kind="success" onDismiss={() => setSuccess('')}>{success}</Notification>}
    {deleting && <div className="modal-backdrop"><div className="complex-service-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-invoice-title">
      <h2 id="delete-invoice-title">Удалить счет №{deleting.code}?</h2>
      <div className="header-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setDeleting(null)}>Отмена</button><button type="button" className="primary-button" disabled={busy} onClick={remove}>Удалить</button></div>
    </div></div>}
    <div className="table-card">
      {!data && !error && <p className="table-message" role="status">Загружаем счета…</p>}
      {data?.items.length === 0 && <div className="empty-state"><strong>Счетов пока нет</strong><p>Создайте счёт из оказанных услуг выбранного клиента за месяц.</p></div>}
      {!!data?.items.length && <div className="table-wrap"><table><thead><tr><th className="registry-index" scope="col">№</th><th scope="col">Номер счёта</th><th scope="col">Дата создания</th><th scope="col">Клиент</th><th scope="col">Договор</th><th scope="col">Период оказания</th><th scope="col">Сумма с НДС, ₽</th><th scope="col">Статус</th><th className="registry-actions" scope="col" aria-label="Действия" /></tr></thead>
        <tbody>{data.items.map((item, index) => <RecordRow to={`/payment-invoices/${item.id}`} key={item.id}><td className="registry-index">{page * PAGE_SIZE + index + 1}</td><td><Link className="order-code" to={`/payment-invoices/${item.id}`}>{item.code}</Link></td><td>{invoiceDate(item.createdAt, item.timeZone)}</td><td>{item.clientName}</td><td>{item.contractName}</td><td>{invoicePeriod(item.period)}</td><td>{invoiceMoney(item.amountWithVat)}</td><td><StatusBadge status={item.status} /></td><td className="registry-actions"><RowActions label={'Действия со счётом ' + item.code} disabled={busy} actions={[{ label: 'Открыть', to: '/payment-invoices/' + item.id }, ...(item.status === 'DRAFT' ? [{ label: 'Удалить', onClick: () => setDeleting(item) }] : [])]} /></td></RecordRow>)}</tbody>
      </table></div>}
      {data && <Pages page={page} totalPages={data.totalPages} onChange={next => { setData(null); setError(''); setPage(next) }} />}
    </div>
  </section>
}

export function InvoiceCreatePage() { return <InvoiceForm /> }

function InvoiceForm({ initial, onSaved, onCancel }: { initial?: InvoiceDetails; onSaved?: (data: InvoiceDetails) => void; onCancel?: () => void }) {
  const [actionHost, setActionHost] = useState<HTMLDivElement | null>(null)
  const [clients, setClients] = useState<ReferenceOption[]>([])
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [referencesReady, setReferencesReady] = useState(false)
  const [referenceError, setReferenceError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState<InvoiceFilters>(initial ? { clientId: initial.invoice.clientId, contractId: initial.invoice.contractId, period: initial.invoice.period } : { clientId: '', contractId: '', period: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }).slice(0, 7) })
  const [applied, setApplied] = useState<{ filters: InvoiceFilters; candidates: InvoiceCandidates; key: string } | null>(null)
  const [candidates, setCandidates] = useState<InvoiceCandidates | null>(null)
  const [candidateError, setCandidateError] = useState('')
  const initialApplied = useRef(false)
  const editingId = initial?.invoice.id
  useEffect(() => {
    if (!filters.clientId || !filters.contractId || !filters.period) return
    let active = true
    getInvoiceCandidates(filters, editingId).then(value => {
      if (active) {
        setCandidates(value)
        if (editingId && !initialApplied.current) { initialApplied.current = true; setApplied({ filters: { ...filters }, candidates: value, key: crypto.randomUUID() }) }
      }
    }).catch(cause => { if (active) setCandidateError(message(cause)) })
    return () => { active = false }
  }, [filters, attempt, editingId])
  useEffect(() => {
    let active = true
    Promise.all([getReferenceOptions('clients'), getContracts()]).then(([clientRows, contractRows]) => {
      if (active) { setClients(clientRows); setContracts(contractRows); setReferencesReady(true) }
    }).catch(cause => { if (active) setReferenceError(message(cause)) })
    return () => { active = false }
  }, [attempt])
  function change(next: InvoiceFilters) { setFilters(next); setApplied(null); setCandidates(null); setCandidateError('') }
  async function applyFilters() {
    if (busy) return
    setBusy(true); setApplied(null); setCandidateError('')
    try {
      const current = await getInvoiceCandidates(filters, editingId)
      setCandidates(current)
      setApplied({ filters: { ...filters }, candidates: current, key: crypto.randomUUID() })
    } catch (cause) { setCandidateError(message(cause)) }
    finally { setBusy(false) }
  }
  return <section className="form-page invoice-create-page">
    <div className="page-header"><h1>{initial ? `Счет №${initial.invoice.code}` : 'Создание счёта на оплату'}</h1><div className="header-actions">{initial && <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Отмена</button>}<Link className="close-button" to="/payment-invoices" aria-label="Закрыть" title="Закрыть">×</Link><button type="submit" form="invoice-filter" className="primary-button" disabled={busy || !referencesReady || !filters.clientId || !filters.contractId || !filters.period || !candidates}>Показать услуги</button><div className="header-actions" ref={setActionHost} /></div></div>
    {referenceError && <Notification kind="error">{referenceError}<button type="button" className="secondary-button" onClick={() => { setReferenceError(''); setAttempt(value => value + 1) }}>Повторить</button></Notification>}
    {candidateError && <Notification kind="error">{candidateError}<button type="button" className="secondary-button" onClick={() => { setCandidateError(''); setAttempt(value => value + 1) }}>Повторить</button></Notification>}
    <div className="form-workspace">
    <form id="invoice-filter" className="form-section ui-form-section invoice-filter-panel" onSubmit={event => { event.preventDefault(); void applyFilters() }}>
      <div className="form-section-heading"><h2>Основная информация</h2></div>
      <div className="invoice-filters">
        <label className="field horizontal-field"><span>Клиент <b>*</b></span><UiSelect required disabled={busy || !referencesReady} value={filters.clientId} onChange={event => change({ ...filters, clientId: event.target.value, contractId: '' })}><option value="" hidden disabled />{clients.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</UiSelect></label>
        <label className="field horizontal-field"><span>Договор <b>*</b></span><UiSelect required disabled={busy || !referencesReady || !filters.clientId} value={filters.contractId} onChange={event => change({ ...filters, contractId: event.target.value })}><option value="" hidden disabled />{contracts.filter(item => item.clientId === filters.clientId).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</UiSelect></label>
        <label className="field horizontal-field"><span>Период оказания <b>*</b></span><UiInput required type="month" min="0001-01" max="9998-12" disabled={busy} value={filters.period} onChange={event => change({ ...filters, period: event.target.value })} /></label>
      </div>
    </form>
    {applied && <InvoiceSelection key={applied.key} filters={applied.filters} data={applied.candidates} onBusy={setBusy} actionHost={actionHost} initial={initial} onSaved={onSaved} />}
    </div>
  </section>
}

function InvoiceSelection({ filters, data, onBusy, actionHost, initial, onSaved }: { filters: InvoiceFilters; data: InvoiceCandidates; onBusy: (value: boolean) => void; actionHost: HTMLDivElement | null; initial?: InvoiceDetails; onSaved?: (data: InvoiceDetails) => void }) {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial?.items.filter(item => data.items.some(candidate => candidate.id === item.id)).map(item => item.id) ?? []))
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const requestKey = useRef(crypto.randomUUID())
  const totals = selectedInvoiceTotals(data?.items ?? [], selected)
  const allSelected = data.items.length > 0 && data.items.every(item => selected.has(item.id))
  function changeSelection(next: Set<string>) { requestKey.current = crypto.randomUUID(); setSelected(next) }
  function toggleAll() {
    if (saving) return
    if (!allSelected && data.items.length > 10000) {
      setError('В один счёт можно включить не более 10 000 услуг. Выберите услуги по отдельности.')
      return
    }
    setError('')
    changeSelection(allSelected ? new Set() : new Set(data.items.map(item => item.id)))
  }
  async function save() {
    if (!selected.size || saveLock.current) return
    saveLock.current = true; setSaving(true); onBusy(true); setError('')
    try {
      const result = initial ? await updatePaymentInvoice(initial.invoice.id, filters, [...selected], initial.invoice.version) : await createPaymentInvoice(filters, [...selected], requestKey.current)
      if (onSaved) onSaved(result)
      else navigate(`/payment-invoices/${result.invoice.id}`)
    } catch (cause) { setError(message(cause)) }
    finally { saveLock.current = false; setSaving(false); onBusy(false) }
  }
  return <section className="invoice-selection" aria-label="Выбор оказанных услуг">
    <div className="form-section-heading"><h2>Оказанные услуги</h2></div>
    {error && <Notification kind="error">{error}</Notification>}
    {data && <>
      {data.items.length ? <>
        <LinesTable items={data.items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)} timeZone={data.timeZone} selected={selected} disabled={saving} onToggleAll={toggleAll} allSelected={allSelected} partiallySelected={selected.size > 0} onToggle={id => {
          const next = new Set(selected)
          if (next.has(id)) next.delete(id)
          else if (next.size < 10000) next.add(id)
          changeSelection(next)
        }} />
        <Pages page={page} totalPages={Math.ceil(data.items.length / PAGE_SIZE)} onChange={setPage} />
      </> : <div className="service-section-empty">За выбранный месяц нет оказанных услуг, доступных для включения в счёт.</div>}
      <div className="invoice-selection-footer">
        <div><span>Без НДС: {invoiceMoney(totals.withoutVat)} ₽ · НДС: {invoiceMoney(totals.vat)} ₽</span><strong>Итого с НДС: {invoiceMoney(totals.withVat)} ₽</strong></div>
        {actionHost && createPortal(<button type="button" className="primary-button" disabled={saving || !totals.count} onClick={save}>{saving ? 'Сохраняем…' : initial ? 'Сохранить' : 'Создать'}</button>, actionHost)}
      </div>
    </>}
  </section>
}

export function InvoiceViewPage() {
  const { invoiceId = '' } = useParams()
  return <InvoiceView key={invoiceId} id={invoiceId} />
}

function InvoiceView({ id }: { id: string }) {
  const [data, setData] = useState<InvoiceDetails | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const payLock = useRef(false)
  useEffect(() => {
    let active = true
    getPaymentInvoice(id).then(value => { if (active) setData(value) }).catch(cause => { if (active) setError(message(cause)) })
    return () => { active = false }
  }, [id, attempt])
  async function pay() {
    if (!data || payLock.current) return
    payLock.current = true; setBusy(true); setError('')
    try { setData(await markPaymentInvoicePaid(id, data.invoice.version)); setSuccess('Счёт отмечен оплаченным') }
    catch (cause) { setError(message(cause)); setAttempt(current => current + 1) }
    finally { payLock.current = false; setBusy(false) }
  }
  if (editing && data) return <InvoiceForm initial={data} onCancel={() => { setEditing(false); setAttempt(current => current + 1) }} onSaved={value => { setData(value); setEditing(false); setPage(0); setSuccess('Счёт сохранён') }} />
  return <section className="form-page service-dashboard">
    <div className="page-header"><h1>{data ? `Счет №${data.invoice.code}` : 'Счет'}</h1><div className="header-actions">
      {data?.invoice.status === 'DRAFT' && <><button type="button" className="secondary-button icon-button" title="Редактировать" aria-label="Редактировать" disabled={busy} onClick={() => { setEditing(true); setSuccess(''); setError('') }}><ActionIcon name="edit" /></button><button type="button" className="primary-button" disabled={busy} onClick={pay}>Оплачен</button></>}
      <Link className="close-button" to="/payment-invoices" aria-label="Закрыть" title="Закрыть">×</Link>
    </div></div>
    {error && <Notification kind="error">{error}<button className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Повторить</button></Notification>}
    {success && <Notification kind="success" onDismiss={() => setSuccess('')}>{success}</Notification>}
    {!data && !error && <p role="status">Загружаем счёт…</p>}
    {data && <>
      <section className="service-main-panel"><h2>Основное</h2><dl className="details-grid">
        <div><dt>Клиент</dt><dd>{data.invoice.clientName}</dd></div><div><dt>Договор</dt><dd>{data.invoice.contractName}</dd></div>
        <div><dt>Период оказания</dt><dd>{invoicePeriod(data.invoice.period)}</dd></div><div><dt>Дата создания</dt><dd>{invoiceDate(data.invoice.createdAt, data.invoice.timeZone)}</dd></div>
        <div><dt>Статус</dt><dd><StatusBadge status={data.invoice.status} /></dd></div><div><dt>Количество услуг</dt><dd>{data.items.length}</dd></div>
        <div><dt>Без НДС, ₽</dt><dd>{invoiceMoney(data.invoice.amountWithoutVat)}</dd></div><div><dt>НДС, ₽</dt><dd>{invoiceMoney(data.invoice.amountWithVat - data.invoice.amountWithoutVat)}</dd></div><div><dt>Итого с НДС, ₽</dt><dd>{invoiceMoney(data.invoice.amountWithVat)}</dd></div>
      </dl></section>
      <section className="service-order-section"><div className="bulk-return-heading"><h2>Услуги в счёте</h2></div><LinesTable items={data.items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)} timeZone={data.invoice.timeZone} invoiceId={id} /><Pages page={page} totalPages={Math.ceil(data.items.length / PAGE_SIZE)} onChange={setPage} /></section>
    </>}
  </section>
}

export function InvoiceTariffPage() {
  const { invoiceId = '', chargeId = '' } = useParams()
  return <InvoiceTariffCard key={invoiceId + chargeId} invoiceId={invoiceId} chargeId={chargeId} />
}
function InvoiceTariffCard({ invoiceId, chargeId }: { invoiceId: string; chargeId: string }) {
  const [data, setData] = useState<AppliedInvoiceTariff | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    getInvoiceTariff(invoiceId, chargeId).then(value => { if (active) setData(value) }).catch(cause => { if (active) setError(message(cause)) })
    return () => { active = false }
  }, [invoiceId, chargeId, attempt])
  if (data) return <Navigate replace to={'/complex-services/tariffs/' + data.tariffId} state={{ returnTo: '/payment-invoices/' + invoiceId }} />
  return <>{error ? <Notification kind="error">{error}<button className="secondary-button" onClick={() => { setError(''); setAttempt(current => current + 1) }}>Повторить</button></Notification> : <p role="status">Загружаем тариф…</p>}</>
}
