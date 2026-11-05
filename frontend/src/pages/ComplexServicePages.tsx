import { RecordRow } from '../components/RecordRow'
import { Notification } from '../components/Notification'
import { ActionIcon } from '../components/ActionIcon'
import { RowActions } from '../components/RowActions'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { UiInput, UiSelect } from '../components/FormControls'
import {
  getComplexServiceTariff, createComplexService, deleteComplexService, deleteComplexServiceTariff, getComplexService, getComplexServices,
  getContracts, getReferenceOptions, saveComplexServiceTariff, updateComplexServiceTariff, updateComplexService,
} from '../api'
import type { ReferenceOption } from '../domain'
import type { ContractOption } from '../comprehensiveServiceOrder'
import type { ComplexService, ComplexServiceDetails, ComplexServicePayload, ComplexServiceTariff } from '../complexService'
import { priceLabel } from '../complexService'

const emptyService: ComplexServicePayload = { name: '', priceWithoutVat: '', priceWithVat: '' }

function serviceFields(value: ComplexServicePayload, change: (next: ComplexServicePayload) => void) {
  return <div className="form-fields-grid"><div className="form-fields-column">
    <label className="field horizontal-field"><span>Наименование <b>*</b></span><UiInput required maxLength={255} value={value.name} onChange={event => change({ ...value, name: event.target.value })} placeholder="Название комплексной услуги" /></label>
    <label className="field horizontal-field"><span>Цена без НДС, ₽ <b>*</b></span><UiInput required type="number" min="0" step="0.01" value={value.priceWithoutVat} onChange={event => change({ ...value, priceWithoutVat: event.target.value })} placeholder="0,00" /></label>
  </div><div className="form-fields-column">
    <label className="field horizontal-field"><span>Цена с НДС, ₽ <b>*</b></span><UiInput required type="number" min="0" step="0.01" value={value.priceWithVat} onChange={event => change({ ...value, priceWithVat: event.target.value })} placeholder="0,00" /></label>
  </div></div>
}

function priceError(value: ComplexServicePayload) {
  if (Number(value.priceWithVat) < Number(value.priceWithoutVat)) return 'Цена с НДС не может быть ниже цены без НДС'
  return ''
}

export function ComplexServiceRegistryPage() {
  const [services, setServices] = useState<ComplexService[] | null>(null)
  const [deletingService, setDeletingService] = useState<ComplexService | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  async function removeService() {
    if (!deletingService || deleting) return
    setDeleting(true); setDeleteError('')
    try {
      await deleteComplexService(deletingService.id)
      setServices(current => current?.filter(service => service.id !== deletingService.id) ?? null)
      setDeletingService(null)
    } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'Не удалось удалить услугу') }
    finally { setDeleting(false) }
  }
  const [error, setError] = useState('')
  useEffect(() => { getComplexServices().then(setServices).catch(cause => setError(cause instanceof Error ? cause.message : 'Не удалось загрузить услуги')) }, [])
  return <section className="registry-page complex-service-page">
    <div className="page-header"><h1>Комплексные услуги</h1><Link className="primary-button create-action-button" to="/complex-services/new"><ActionIcon name="plus" /> Создать</Link></div>
    {error && <Notification kind="error">{error}</Notification>}
    <div className="table-card">
      <div className="table-wrap"><table><thead><tr><th className="registry-index" scope="col">№</th><th>Наименование</th><th>Цена без НДС, ₽</th><th>Цена с НДС, ₽</th><th>Тарифов</th><th className="registry-actions" scope="col" aria-label="Действия" /></tr></thead><tbody>
        {!services && !error && <tr><td colSpan={6} className="table-message">Загружаем услуги…</td></tr>}
        {services && services.length === 0 && <tr><td colSpan={6} className="empty-state"><strong>Комплексных услуг пока нет</strong><p>Создайте услугу, затем настройте коэффициенты для клиентов и договоров.</p></td></tr>}
        {services?.map((service, index) => <RecordRow to={`/complex-services/${service.id}`} key={service.id}><td className="registry-index">{index + 1}</td><td><Link className="order-code" to={`/complex-services/${service.id}`}>{service.name}</Link></td><td className="complex-service-money">{priceLabel(service.priceWithoutVat)}</td><td className="complex-service-money">{priceLabel(service.priceWithVat)}</td><td>{service.tariffCount}</td><td className="registry-actions"><RowActions label={'Действия с услугой ' + service.name} disabled={deleting} actions={[{ label: 'Открыть', to: '/complex-services/' + service.id }, { label: 'Удалить', onClick: () => { setDeleteError(''); setDeletingService(service) } }]} /></td></RecordRow>)}
      </tbody></table></div>
    </div>
    {deletingService && <div className="modal-backdrop">
      <div className="complex-service-dialog" role="alertdialog" aria-modal="true" aria-labelledby="complex-service-delete-title" aria-describedby="complex-service-delete-description" onKeyDown={event => { if (event.key === 'Escape' && !deleting) setDeletingService(null) }}>
        <h2 id="complex-service-delete-title">Удалить комплексную услугу?</h2>
        <p id="complex-service-delete-description">Услуга «{deletingService.name}» и все её тарифы ({deletingService.tariffCount}) будут удалены. Это действие нельзя отменить.</p>
        {deleteError && <Notification kind="error">{deleteError}</Notification>}
        <div className="complex-service-dialog-actions"><button type="button" className="secondary-button" autoFocus disabled={deleting} onClick={() => setDeletingService(null)}>Отмена</button><button type="button" className="primary-button complex-service-danger-button" disabled={deleting} onClick={removeService}>{deleting ? 'Удаляем…' : 'Удалить услугу'}</button></div>
      </div>
    </div>}
  </section>
}

export function ComplexServiceCreatePage() {
  const navigate = useNavigate()
  const [value, setValue] = useState<ComplexServicePayload>(emptyService)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const invalid = priceError(value)
    if (invalid) { setError(invalid); return }
    setSaving(true); setError('')
    try {
      const created = await createComplexService(value)
      navigate(`/complex-services/${created.service.id}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать услугу') }
    finally { setSaving(false) }
  }
  return <section className="form-page complex-service-page">
    <div className="page-header form-page-header"><h1>Новая комплексная услуга</h1><div className="header-actions"><Link className="close-button" to="/complex-services" aria-label="Вернуться в реестр" title="Закрыть"><ActionIcon name="close" /></Link><button type="submit" form="complex-service-create" className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Создать услугу'}</button></div></div>
    <form id="complex-service-create" className="form-workspace" onSubmit={submit}>
      <div className="stepper"><span className="step current">Основное</span></div>
      <section className="form-section ui-form-section"><div className="form-section-heading"><h2>Основная информация</h2></div>{serviceFields(value, setValue)}</section>
      {error && <Notification kind="error">{error}</Notification>}

    </form>
  </section>
}

export function ComplexServiceViewPage() {
  const { complexServiceId = '' } = useParams()
  return <ComplexServiceCard key={complexServiceId} id={complexServiceId} />
}

function ComplexServiceCard({ id }: { id: string }) {
  const [details, setDetails] = useState<ComplexServiceDetails | null>(null)
  const [base, setBase] = useState<ComplexServicePayload>(emptyService)
  const [tab, setTab] = useState<'main' | 'tariffs' | 'tariff-form'>('main')
  const [clients, setClients] = useState<ReferenceOption[]>([])
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [clientId, setClientId] = useState('')
  const [contractId, setContractId] = useState('')
  const [coefficient, setCoefficient] = useState('1')
  const [tariffActive, setTariffActive] = useState(true)
  const [editingTariffId, setEditingTariffId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [editingBase, setEditingBase] = useState(false)

  useEffect(() => {
    let active = true
    getComplexService(id).then(result => {
      if (!active) return
      setDetails(result)
      setBase({ name: result.service.name, priceWithoutVat: String(result.service.priceWithoutVat), priceWithVat: String(result.service.priceWithVat) })
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить услугу') })
    Promise.all([getReferenceOptions('clients'), getContracts()]).then(([clientRows, contractRows]) => {
      if (active) { setClients(clientRows); setContracts(contractRows) }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить клиентов и договоры') })
    return () => { active = false }
  }, [id])

  async function saveBase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavedMessage('')
    const invalid = priceError(base)
    if (invalid) { setError(invalid); return }
    setSaving(true); setError('')
    try { setDetails(await updateComplexService(id, base)); setSavedMessage('Изменения сохранены'); setEditingBase(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить услугу') }
    finally { setSaving(false) }
  }

  function editTariff(tariff: ComplexServiceTariff) {
    setClientId(tariff.clientId)
    setContractId(tariff.contractId)
    setCoefficient(String(tariff.coefficient))
    setEditingTariffId(tariff.id)
    setTariffActive(tariff.active)
    setError('')
    setTab('tariff-form')
  }

  function clearTariffForm() {
    setClientId(''); setContractId(''); setCoefficient('1'); setEditingTariffId(''); setTariffActive(true)
  }

  function openTariffForm() {
    clearTariffForm()
    setError('')
    setTab('tariff-form')
  }

  async function saveTariff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = { clientId, contractId, coefficient, active: tariffActive }
      setDetails(editingTariffId
        ? await updateComplexServiceTariff(id, editingTariffId, payload)
        : await saveComplexServiceTariff(id, payload))
      clearTariffForm()
      setTab('tariffs')
      setSavedMessage('Тариф сохранён')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить тариф') }
    finally { setSaving(false) }
  }

  async function removeTariff(tariff: ComplexServiceTariff) {
    setSaving(true); setError('')
    try {
      await deleteComplexServiceTariff(id, tariff.id)
      setDetails(await getComplexService(id))
      if (editingTariffId === tariff.id) clearTariffForm()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось удалить тариф') }
    finally { setSaving(false) }
  }

  const availableContracts = contracts.filter(contract => contract.clientId === clientId)
  return <section className="form-page view-page complex-service-page">
    <div className="page-header form-page-header"><h1>{details?.service.name ?? 'Комплексная услуга'}</h1><div className="view-header-actions">{details && tab === 'main' && editingBase && <><button type="button" className="secondary-button" disabled={saving} onClick={() => { setBase({ name: details.service.name, priceWithoutVat: String(details.service.priceWithoutVat), priceWithVat: String(details.service.priceWithVat) }); setEditingBase(false); setError('') }}>Отмена</button><button type="submit" form="complex-service-edit" className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></>}{details && tab === 'tariff-form' && <><button type="button" className="secondary-button" onClick={() => { clearTariffForm(); setTab('tariffs'); setError('') }}>Отмена</button><button type="submit" form="complex-tariff-edit" className="primary-button" disabled={saving || clients.length === 0}>{saving ? 'Сохраняем…' : 'Сохранить тариф'}</button></>}{details && tab === 'main' && !editingBase && <button type="button" className="secondary-button icon-button" title="Редактировать" aria-label="Редактировать" onClick={() => { setEditingBase(true); setSavedMessage(''); setError('') }}><ActionIcon name="edit" /></button>}<Link className="close-button" to="/complex-services" aria-label="Вернуться в реестр" title="Закрыть"><ActionIcon name="close" /></Link></div></div>
    {error && <Notification kind="error">{error}</Notification>}
    {!details && !error && <div className="table-card table-message">Загружаем услугу…</div>}
    {savedMessage && <Notification kind="success" onDismiss={() => setSavedMessage('')}>{savedMessage}</Notification>}
    {details && <div className="form-workspace">
      {tab !== 'tariff-form' && <div className="complex-service-tabs-toolbar"><div className="stepper view-tabs" role="tablist" aria-label="Разделы комплексной услуги">
        <button type="button" role="tab" aria-selected={tab === 'main'} className={`step ${tab === 'main' ? 'current' : ''}`} onClick={() => { setTab('main'); setError('') }}>Основное</button>
        <button type="button" role="tab" aria-selected={tab === 'tariffs'} className={`step ${tab === 'tariffs' ? 'current' : ''}`} onClick={() => { setTab('tariffs'); setError('') }}>Тарифы</button>
      </div>{tab === 'tariffs' && <button type="button" className="primary-button create-action-button" disabled={saving} onClick={openTariffForm}><ActionIcon name="plus" /> Создать</button>}</div>}
      {tab === 'main' && !editingBase && <section className="form-section ui-form-section"><div className="form-section-heading"><h2>Основная информация</h2></div><dl className="details-grid"><div><dt>Наименование</dt><dd>{details.service.name}</dd></div><div><dt>Цена с НДС, ₽</dt><dd>{priceLabel(details.service.priceWithVat)}</dd></div><div><dt>Цена без НДС, ₽</dt><dd>{priceLabel(details.service.priceWithoutVat)}</dd></div></dl></section>}
      {tab === 'main' && editingBase && <form id="complex-service-edit" onSubmit={saveBase}>
        <section className="form-section ui-form-section"><div className="form-section-heading"><h2>Основная информация</h2></div>{serviceFields(base, next => { setBase(next); setSavedMessage('') })}</section>

      </form>}
      {tab === 'tariffs' && <section className="complex-service-tariffs">
        <div className="table-wrap"><table><thead><tr><th className="registry-index" scope="col">№</th><th>Клиент</th><th>Договор</th><th>Активный</th><th>Коэффициент</th><th>Цена с НДС, ₽</th><th>Цена без НДС, ₽</th><th className="registry-actions" scope="col" aria-label="Действия" /></tr></thead><tbody>
          {details.tariffs.length === 0 && <tr><td colSpan={8} className="table-message">Тарифы пока не настроены</td></tr>}
          {details.tariffs.map((tariff, index) => <RecordRow to={`/complex-services/tariffs/${tariff.id}`} key={tariff.id}><td className="registry-index">{index + 1}</td><td>{tariff.clientName}</td><td><Link to={`/complex-services/tariffs/${tariff.id}`} state={{ returnTo: '/complex-services/' + id }}>{tariff.contractName}</Link></td><td><UiInput type="checkbox" checked={tariff.active} disabled aria-label={`Активный тариф: ${tariff.clientName}, ${tariff.contractName}`} /></td><td>{tariff.coefficient}</td><td className="complex-service-money">{priceLabel(tariff.priceWithVat)}</td><td className="complex-service-money">{priceLabel(tariff.priceWithoutVat)}</td><td className="registry-actions"><RowActions label={'Действия с тарифом ' + tariff.clientName + ', ' + tariff.contractName} disabled={saving} actions={[{ label: 'Открыть', to: '/complex-services/tariffs/' + tariff.id }, { label: 'Редактировать', onClick: () => editTariff(tariff) }, { label: 'Удалить', onClick: () => removeTariff(tariff) }]} /></td></RecordRow>)}
        </tbody></table></div>
      </section>}
      {tab === 'tariff-form' && <form id="complex-tariff-edit" className="complex-service-tariff-form" onSubmit={saveTariff}>
        <h2>{editingTariffId ? 'Изменить тариф' : 'Добавить тариф'}</h2>
        <p>Коэффициент задаётся отдельно для каждого договора клиента.</p>
        <div className="form-fields-grid"><div className="form-fields-column">
          <label className="field horizontal-field"><span>Клиент <b>*</b></span><UiSelect required disabled={Boolean(editingTariffId)} value={clientId} onChange={event => { setClientId(event.target.value); setContractId('') }}><option value="" hidden disabled />{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</UiSelect></label>
          <label className="field horizontal-field"><span>Договор <b>*</b></span><UiSelect required disabled={!clientId || Boolean(editingTariffId)} value={contractId} onChange={event => setContractId(event.target.value)}><option value="" hidden disabled />{availableContracts.map(contract => <option key={contract.id} value={contract.id}>{contract.name}</option>)}</UiSelect></label>
        </div><div className="form-fields-column">
          <label className="field horizontal-field"><span>Коэффициент <b>*</b></span><UiInput required type="number" min="0.0001" step="0.0001" value={coefficient} onChange={event => setCoefficient(event.target.value)} /></label>
          <label className="field horizontal-field"><span>Активный</span><UiInput type="checkbox" checked={tariffActive} disabled={!editingTariffId || saving} onChange={event => setTariffActive(event.target.checked)} /></label>
        </div></div>

      </form>}
    </div>}

  </section>
}


export function TariffViewPage() {
  const { tariffId = '' } = useParams()
  return <TariffCard key={tariffId} tariffId={tariffId} />
}
function TariffCard({ tariffId }: { tariffId: string }) {
  const location = useLocation()
  const returnTo = typeof location.state?.returnTo === 'string' && /^\/(payment-invoices|complex-services)\/[a-f0-9-]+$/.test(location.state.returnTo) ? location.state.returnTo : '/complex-services'
  const [tariff, setTariff] = useState<ComplexServiceTariff | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    getComplexServiceTariff(tariffId).then(value => { if (active) setTariff(value) }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить тариф') })
    return () => { active = false }
  }, [tariffId, attempt])
  return <section className="form-page view-page complex-service-page">
    <div className="page-header"><h1>Тариф</h1><div className="header-actions"><Link className="close-button" to={returnTo} aria-label="Закрыть" title="Закрыть"><ActionIcon name="close" /></Link></div></div>
    {error && <Notification kind="error">{error}<button type="button" className="secondary-button" onClick={() => { setError(''); setAttempt(current => current + 1) }}>Повторить</button></Notification>}
    {!tariff && !error && <p role="status">Загружаем тариф…</p>}
    {tariff && <div className="form-workspace"><div className="stepper view-tabs"><span className="step current">Основное</span></div>
      <section className="form-section ui-form-section"><div className="form-section-heading"><h2>Основная информация</h2></div>
        <dl className="details-grid">
          <div><dt>Клиент</dt><dd>{tariff.clientName}</dd></div><div><dt>Договор</dt><dd>{tariff.contractName}</dd></div>
          <div><dt>Коэффициент</dt><dd>{tariff.coefficient.toLocaleString('ru-RU', { maximumFractionDigits: 4 })}</dd></div>
          <div><dt>Активный</dt><dd><UiInput type="checkbox" checked={tariff.active} disabled aria-label="Активный" /></dd></div>
          <div><dt>Цена без НДС, ₽</dt><dd>{priceLabel(tariff.priceWithoutVat)}</dd></div>
          <div><dt>Цена с НДС, ₽</dt><dd>{priceLabel(tariff.priceWithVat)}</dd></div>
        </dl>
      </section>
    </div>}
  </section>
}
