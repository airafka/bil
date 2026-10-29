import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPaymentInvoice, deletePaymentInvoice, getContracts, getInvoiceCandidates, getPaymentInvoice, getPaymentInvoices, getReferenceOptions } from '../api'
import type { PagedResponse, ReferenceOption } from '../domain'
import type { ContractOption } from '../serviceOrder'
import type { InvoiceCandidates, InvoiceDetails, InvoiceFilters, InvoiceLine, PaymentInvoice } from '../invoices'
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

function LinesTable({ items, timeZone, selected, onToggle, disabled = false }: {
  items: InvoiceLine[]; timeZone: string; selected?: Set<string>; onToggle?: (id: string) => void; disabled?: boolean
}) {
  return <div className="table-wrap service-compact-table"><table>
    <thead><tr>{onToggle && <th scope="col">Выбрать</th>}<th scope="col">Дата оказания</th><th scope="col">Заявка на услугу</th><th scope="col">КТК</th><th scope="col">Услуга</th><th scope="col">Без НДС, ₽</th><th scope="col">С НДС, ₽</th></tr></thead>
    <tbody>{items.map(item => <tr key={item.id}>
      {onToggle && <td><UiInput type="checkbox" checked={selected?.has(item.id) ?? false} disabled={disabled} onChange={() => onToggle(item.id)} aria-label={`Выбрать ${item.serviceName}, КТК ${item.containerName}, заявка ${item.serviceOrderCode}, ${invoiceDate(item.performedAt, timeZone)}`} /></td>}
      <td>{invoiceDate(item.performedAt, timeZone)}</td>
      <td><Link to={`/service-orders/${item.serviceOrderId}`} target={onToggle ? '_blank' : undefined} rel={onToggle ? 'noreferrer' : undefined}>{item.serviceOrderCode}</Link></td>
      <td>{item.containerName}</td><td>{item.serviceName}</td><td>{invoiceMoney(item.amountWithoutVat)}</td><td>{invoiceMoney(item.amountWithVat)}</td>
    </tr>)}</tbody>
  </table></div>
}

export function InvoiceRegistryPage() {
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<PagedResponse<PaymentInvoice> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getPaymentInvoices(page).then(value => { if (active) setData(value) }).catch(cause => { if (active) setError(message(cause)) })
    return () => { active = false }
  }, [page, attempt])
  return <section className="registry-page">
    <div className="page-header"><h1>Счета на оплату</h1><Link className="primary-button" to="/payment-invoices/new">+ Создать счёт</Link></div>
    {error && <div className="notice error" role="alert">{error}<button className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Повторить</button></div>}
    <div className="table-card"><div className="table-toolbar"><strong>Черновики счетов</strong><span>{data?.totalElements ?? '…'} записей</span></div>
      {!data && !error && <p className="table-message" role="status">Загружаем счета…</p>}
      {data?.items.length === 0 && <div className="empty-state"><strong>Счетов пока нет</strong><p>Создайте счёт из оказанных услуг выбранного клиента за месяц.</p></div>}
      {!!data?.items.length && <div className="table-wrap"><table><thead><tr><th scope="col">Номер</th><th scope="col">Дата создания</th><th scope="col">Клиент</th><th scope="col">Договор</th><th scope="col">Период оказания</th><th scope="col">Сумма с НДС, ₽</th><th scope="col">Статус</th></tr></thead>
        <tbody>{data.items.map(item => <tr key={item.id}><td><Link className="order-code" to={`/payment-invoices/${item.id}`}>{item.code}</Link></td><td>{invoiceDate(item.createdAt, item.timeZone)}</td><td>{item.clientName}</td><td>{item.contractName}</td><td>{invoicePeriod(item.period)}</td><td>{invoiceMoney(item.amountWithVat)}</td><td>Черновик</td></tr>)}</tbody>
      </table></div>}
      {data && <Pages page={page} totalPages={data.totalPages} onChange={next => { setData(null); setError(''); setPage(next) }} />}
    </div>
  </section>
}

export function InvoiceCreatePage() {
  const [clients, setClients] = useState<ReferenceOption[]>([])
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [referencesReady, setReferencesReady] = useState(false)
  const [referenceError, setReferenceError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState<InvoiceFilters>({ clientId: '', contractId: '', period: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }).slice(0, 7) })
  const [applied, setApplied] = useState<InvoiceFilters | null>(null)
  useEffect(() => {
    let active = true
    Promise.all([getReferenceOptions('clients'), getContracts()]).then(([clientRows, contractRows]) => {
      if (active) { setClients(clientRows); setContracts(contractRows); setReferencesReady(true) }
    }).catch(cause => { if (active) setReferenceError(message(cause)) })
    return () => { active = false }
  }, [attempt])
  function change(next: InvoiceFilters) { setFilters(next); setApplied(null) }
  return <section className="form-page service-dashboard">
    <Link className="service-back" to="/payment-invoices">← Счета на оплату</Link>
    <div className="page-header"><h1>Создание счёта на оплату</h1></div>
    {referenceError && <div className="notice error" role="alert">{referenceError}<button type="button" className="secondary-button" onClick={() => { setReferenceError(''); setAttempt(value => value + 1) }}>Повторить</button></div>}
    <form className="service-main-panel invoice-filter-panel" onSubmit={event => { event.preventDefault(); setApplied({ ...filters }) }}>
      <h2>Параметры счёта</h2>
      <div className="invoice-filters">
        <label className="field"><span>Клиент <b>*</b></span><UiSelect required disabled={busy || !referencesReady} value={filters.clientId} onChange={event => change({ ...filters, clientId: event.target.value, contractId: '' })}><option value="">{referencesReady ? 'Выберите клиента' : 'Загрузка…'}</option>{clients.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</UiSelect></label>
        <label className="field"><span>Договор <b>*</b></span><UiSelect required disabled={busy || !referencesReady || !filters.clientId} value={filters.contractId} onChange={event => change({ ...filters, contractId: event.target.value })}><option value="">Выберите договор</option>{contracts.filter(item => item.clientId === filters.clientId).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</UiSelect></label>
        <label className="field"><span>Период оказания <b>*</b></span><UiInput required type="month" min="0001-01" max="9998-12" disabled={busy} value={filters.period} onChange={event => change({ ...filters, period: event.target.value })} /></label>
      </div>
      <div className="route-form-actions"><span>Выберите месяц и год оказания услуг.</span><button type="submit" className="primary-button" disabled={busy || !referencesReady || !filters.clientId || !filters.contractId || !filters.period}>Показать услуги</button></div>
    </form>
    {applied ? <InvoiceSelection key={`${applied.clientId}/${applied.contractId}/${applied.period}`} filters={applied} onBusy={setBusy} /> : <p className="route-help">После выбора параметров появятся оказанные услуги, доступные для включения в счёт.</p>}
  </section>
}

function InvoiceSelection({ filters, onBusy }: { filters: InvoiceFilters; onBusy: (value: boolean) => void }) {
  const navigate = useNavigate()
  const [data, setData] = useState<InvoiceCandidates | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const requestKey = useRef(crypto.randomUUID())
  useEffect(() => {
    let active = true
    getInvoiceCandidates(filters).then(value => { if (active) setData(value) }).catch(cause => { if (active) setError(message(cause)) })
    return () => { active = false }
  }, [filters, attempt])
  const totals = selectedInvoiceTotals(data?.items ?? [], selected)
  function changeSelection(next: Set<string>) { requestKey.current = crypto.randomUUID(); setSelected(next) }
  function reload() { setData(null); setError(''); changeSelection(new Set()); setPage(0); setAttempt(value => value + 1) }
  async function save() {
    if (!selected.size || saveLock.current) return
    saveLock.current = true; setSaving(true); onBusy(true); setError('')
    try {
      const result = await createPaymentInvoice(filters, [...selected], requestKey.current)
      navigate(`/payment-invoices/${result.invoice.id}`)
    } catch (cause) { setError(message(cause)) }
    finally { saveLock.current = false; setSaving(false); onBusy(false) }
  }
  return <section className="service-order-section invoice-selection" aria-label="Выбор оказанных услуг">
    <div className="bulk-return-heading"><h2>Оказанные услуги · {invoicePeriod(filters.period)}</h2><button type="button" className="secondary-button" disabled={saving} onClick={reload}>Обновить список</button></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    {!data && !error && <p className="table-message" role="status">Загружаем оказанные услуги…</p>}
    {data && <>
      <p className="invoice-help">Каждая услуга — отдельная строка. Услуги из других счетов и черновиков исключены. Даты учитываются в часовом поясе {data.timeZone}.</p>
      {data.items.length ? <>
        <div className="bulk-return-actions"><span>Найдено услуг: {data.items.length}. Выбор сохраняется при переходе между страницами.</span><button className="secondary-button" type="button" disabled={saving || data.items.length > 10000} onClick={() => changeSelection(new Set(data.items.map(item => item.id)))}>Выбрать все найденные</button><button className="secondary-button" type="button" disabled={saving || !selected.size} onClick={() => changeSelection(new Set())}>Снять выбор</button></div>
        {data.items.length > 10000 && <p className="invoice-help">В один черновик можно включить не более 10 000 услуг. Выберите нужные строки.</p>}
        <LinesTable items={data.items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)} timeZone={data.timeZone} selected={selected} disabled={saving} onToggle={id => {
          const next = new Set(selected)
          if (next.has(id)) next.delete(id)
          else if (next.size < 10000) next.add(id)
          changeSelection(next)
        }} />
        <Pages page={page} totalPages={Math.ceil(data.items.length / PAGE_SIZE)} onChange={setPage} />
      </> : <div className="service-section-empty">За выбранный месяц нет оказанных услуг, доступных для включения в счёт.</div>}
      <div className="invoice-selection-footer">
        <div><strong>Выбрано услуг: {totals.count}</strong><span>Без НДС: {invoiceMoney(totals.withoutVat)} ₽ · НДС: {invoiceMoney(totals.vat)} ₽</span><strong>Итого с НДС: {invoiceMoney(totals.withVat)} ₽</strong></div>
        <button type="button" className="primary-button" disabled={saving || !totals.count} onClick={save}>{saving ? 'Создаём…' : 'Создать черновик счёта'}</button>
      </div>
    </>}
  </section>
}

export function InvoiceViewPage() {
  const { invoiceId = '' } = useParams()
  return <InvoiceView key={invoiceId} id={invoiceId} />
}

function InvoiceView({ id }: { id: string }) {
  const navigate = useNavigate()
  const [data, setData] = useState<InvoiceDetails | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteLock = useRef(false)
  useEffect(() => {
    let active = true
    getPaymentInvoice(id).then(value => { if (active) setData(value) }).catch(cause => { if (active) setError(message(cause)) })
    return () => { active = false }
  }, [id, attempt])
  async function remove() {
    if (deleteLock.current) return
    deleteLock.current = true; setDeleting(true); setError('')
    try { await deletePaymentInvoice(id); navigate('/payment-invoices') }
    catch (cause) { setError(message(cause)) }
    finally { deleteLock.current = false; setDeleting(false) }
  }
  return <section className="form-page service-dashboard">
    <Link className="service-back" to="/payment-invoices">← Счета на оплату</Link>
    <div className="page-header"><h1>Черновик счёта{data ? ` № ${data.invoice.code}` : ''}</h1>{data && !confirmDelete && <button className="secondary-button" type="button" onClick={() => setConfirmDelete(true)}>Удалить черновик</button>}</div>
    {error && <div className="notice error" role="alert">{error}<button className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Повторить</button></div>}
    {!data && !error && <p role="status">Загружаем счёт…</p>}
    {data && <>
      {confirmDelete && <div className="notice" role="alert">Удалить черновик? Его услуги снова станут доступны для выставления.<button className="secondary-button" disabled={deleting} onClick={() => setConfirmDelete(false)}>Отмена</button><button className="primary-button" disabled={deleting} onClick={remove}>{deleting ? 'Удаляем…' : 'Удалить'}</button></div>}
      <section className="service-main-panel"><h2>Основное</h2><dl className="details-grid">
        <div><dt>Клиент</dt><dd>{data.invoice.clientName}</dd></div><div><dt>Договор</dt><dd>{data.invoice.contractName}</dd></div>
        <div><dt>Период оказания</dt><dd>{invoicePeriod(data.invoice.period)}</dd></div><div><dt>Дата создания</dt><dd>{invoiceDate(data.invoice.createdAt, data.invoice.timeZone)}</dd></div>
        <div><dt>Статус</dt><dd>Черновик</dd></div><div><dt>Количество услуг</dt><dd>{data.items.length}</dd></div>
        <div><dt>Без НДС, ₽</dt><dd>{invoiceMoney(data.invoice.amountWithoutVat)}</dd></div><div><dt>НДС, ₽</dt><dd>{invoiceMoney(data.invoice.amountWithVat - data.invoice.amountWithoutVat)}</dd></div><div><dt>Итого с НДС, ₽</dt><dd>{invoiceMoney(data.invoice.amountWithVat)}</dd></div>
      </dl></section>
      <section className="service-order-section"><div className="bulk-return-heading"><h2>Услуги в счёте</h2></div><LinesTable items={data.items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)} timeZone={data.invoice.timeZone} /><Pages page={page} totalPages={Math.ceil(data.items.length / PAGE_SIZE)} onChange={setPage} /></section>
      <p className="route-help">Состав и суммы сохранены в черновике. Новые оказанные услуги автоматически не добавляются.</p>
    </>}
  </section>
}
