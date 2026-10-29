import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { UiInput, UiSelect } from '../components/FormControls'
import {
  createComplexService, deleteComplexService, deleteComplexServiceTariff, getComplexService, getComplexServices,
  getContracts, getReferenceOptions, saveComplexServiceTariff, updateComplexService,
} from '../api'
import type { ReferenceOption } from '../domain'
import type { ContractOption } from '../serviceOrder'
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
  const [query, setQuery] = useState('')
  const [services, setServices] = useState<ComplexService[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getComplexServices().then(setServices).catch(cause => setError(cause instanceof Error ? cause.message : 'Не удалось загрузить услуги')) }, [])
  return <section className="registry-page complex-service-page">
    <div className="page-header"><h1>Комплексные услуги</h1><Link className="primary-button" to="/complex-services/new"><span>+</span> Создать услугу</Link></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="table-card"><div className="registry-tools"><label>Поиск по наименованию<UiInput type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Название услуги" /></label></div><div className="table-toolbar"><strong>Справочник услуг</strong><span>{services?.length ?? 0} записей</span></div>
      <div className="table-wrap"><table><thead><tr><th>Наименование</th><th>Цена без НДС, ₽</th><th>Цена с НДС, ₽</th><th>Тарифов</th></tr></thead><tbody>
        {!services && !error && <tr><td colSpan={4} className="table-message">Загружаем услуги…</td></tr>}
        {services && !services.some(service => service.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))) && <tr><td colSpan={4} className="empty-state"><strong>{query ? 'Услуги не найдены' : 'Комплексных услуг пока нет'}</strong><p>Создайте услугу, затем настройте коэффициенты для клиентов и договоров.</p></td></tr>}
        {services?.filter(service => service.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))).map(service => <tr key={service.id}><td><Link className="order-code" to={`/complex-services/${service.id}`}>{service.name}</Link></td><td className="complex-service-money">{priceLabel(service.priceWithoutVat)}</td><td className="complex-service-money">{priceLabel(service.priceWithVat)}</td><td>{service.tariffCount}</td></tr>)}
      </tbody></table></div>
    </div>
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
    <div className="page-header"><h1>Новая комплексная услуга</h1><Link className="secondary-button" to="/complex-services">Отмена</Link></div>
    <form className="form-workspace" onSubmit={submit}>
      <div className="stepper"><span className="step current">Основное</span></div>
      <section className="form-section ui-form-section"><h2 className="form-section-heading">Основная информация</h2>{serviceFields(value, setValue)}</section>
      {error && <div className="notice error" role="alert">{error}</div>}
      <div className="complex-service-actions"><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Создать услугу'}</button></div>
    </form>
  </section>
}

export function ComplexServiceViewPage() {
  const { complexServiceId = '' } = useParams()
  return <ComplexServiceCard key={complexServiceId} id={complexServiceId} />
}

function ComplexServiceCard({ id }: { id: string }) {
  const navigate = useNavigate()
  const [details, setDetails] = useState<ComplexServiceDetails | null>(null)
  const [base, setBase] = useState<ComplexServicePayload>(emptyService)
  const [tab, setTab] = useState<'main' | 'tariffs' | 'tariff-form'>('main')
  const [clients, setClients] = useState<ReferenceOption[]>([])
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [clientId, setClientId] = useState('')
  const [contractId, setContractId] = useState('')
  const [coefficient, setCoefficient] = useState('1')
  const [editingContractId, setEditingContractId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    try { setDetails(await updateComplexService(id, base)); setSavedMessage('Изменения сохранены') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить услугу') }
    finally { setSaving(false) }
  }

  function editTariff(tariff: ComplexServiceTariff) {
    setClientId(tariff.clientId)
    setContractId(tariff.contractId)
    setCoefficient(String(tariff.coefficient))
    setEditingContractId(tariff.contractId)
    setError('')
    setTab('tariff-form')
  }

  function clearTariffForm() {
    setClientId(''); setContractId(''); setCoefficient('1'); setEditingContractId('')
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
      setDetails(await saveComplexServiceTariff(id, { clientId, contractId, coefficient }))
      clearTariffForm()
      setTab('tariffs')
      setSavedMessage('Тариф сохранён')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить тариф') }
    finally { setSaving(false) }
  }

  async function removeTariff(tariff: ComplexServiceTariff) {
    setSaving(true); setError('')
    try {
      await deleteComplexServiceTariff(id, tariff.contractId)
      setDetails(await getComplexService(id))
      if (editingContractId === tariff.contractId) clearTariffForm()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось удалить тариф') }
    finally { setSaving(false) }
  }

  async function removeService() {
    setDeleting(true); setError('')
    try {
      await deleteComplexService(id)
      navigate('/complex-services', { replace: true })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось удалить услугу') }
    finally { setDeleting(false) }
  }

  const availableContracts = contracts.filter(contract => contract.clientId === clientId)
  return <section className="form-page complex-service-page">
    <div className="page-header"><h1>{details?.service.name ?? 'Комплексная услуга'}</h1><div className="header-actions"><Link className="secondary-button" to="/complex-services">К справочнику</Link>{details && <button type="button" className="secondary-button complex-service-delete-button" onClick={() => { setError(''); setShowDeleteConfirm(true) }}>Удалить услугу</button>}</div></div>
    {error && !showDeleteConfirm && <div className="notice error" role="alert">{error}</div>}
    {!details && !error && <div className="table-card table-message">Загружаем услугу…</div>}
    {savedMessage && <div className="notice success" role="status">{savedMessage}<button type="button" className="notice-close" aria-label="Закрыть уведомление" onClick={() => setSavedMessage('')}>×</button></div>}
    {details && <div className="form-workspace">
      {tab !== 'tariff-form' && <div className="stepper view-tabs" role="tablist" aria-label="Разделы комплексной услуги">
        <button type="button" role="tab" aria-selected={tab === 'main'} className={`step ${tab === 'main' ? 'current' : ''}`} onClick={() => { setTab('main'); setError('') }}>Основное</button>
        <button type="button" role="tab" aria-selected={tab === 'tariffs'} className={`step ${tab === 'tariffs' ? 'current' : ''}`} onClick={() => { setTab('tariffs'); setError('') }}>Тарифы ({details.tariffs.length})</button>
      </div>}
      {tab === 'main' && <form onSubmit={saveBase}>
        <section className="form-section ui-form-section"><h2 className="form-section-heading">Основная информация</h2>{serviceFields(base, next => { setBase(next); setSavedMessage('') })}</section>
        <div className="complex-service-actions"><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить изменения'}</button></div>
      </form>}
      {tab === 'tariffs' && <section className="complex-service-tariffs">
        <div className="table-toolbar"><strong>Тарифы по договорам</strong><button type="button" className="primary-button" onClick={openTariffForm}><span>+</span> Добавить тариф</button></div>
        <div className="table-wrap"><table><thead><tr><th>Клиент</th><th>Договор</th><th>Коэффициент</th><th>Цена с НДС, ₽</th><th>Цена без НДС, ₽</th><th>Действия</th></tr></thead><tbody>
          {details.tariffs.length === 0 && <tr><td colSpan={6} className="table-message">Тарифы пока не настроены</td></tr>}
          {details.tariffs.map(tariff => <tr key={tariff.id}><td>{tariff.clientName}</td><td>{tariff.contractName}</td><td>{tariff.coefficient}</td><td className="complex-service-money">{priceLabel(tariff.priceWithVat)}</td><td className="complex-service-money">{priceLabel(tariff.priceWithoutVat)}</td><td><button type="button" className="secondary-button" disabled={saving} onClick={() => editTariff(tariff)}>Изменить</button><button type="button" className="secondary-button" disabled={saving} onClick={() => removeTariff(tariff)}>Удалить</button></td></tr>)}
        </tbody></table></div>
      </section>}
      {tab === 'tariff-form' && <form className="complex-service-tariff-form" onSubmit={saveTariff}>
        <button type="button" className="complex-service-back" onClick={() => { clearTariffForm(); setTab('tariffs'); setError('') }}>← К тарифам</button>
        <h2>{editingContractId ? 'Изменить коэффициент' : 'Добавить тариф'}</h2>
        <p>Коэффициент задаётся отдельно для каждого договора клиента.</p>
        <div className="form-fields-grid"><div className="form-fields-column">
          <label className="field horizontal-field"><span>Клиент <b>*</b></span><UiSelect required disabled={Boolean(editingContractId)} value={clientId} onChange={event => { setClientId(event.target.value); setContractId('') }}><option value="">Выберите клиента</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</UiSelect></label>
          <label className="field horizontal-field"><span>Договор <b>*</b></span><UiSelect required disabled={!clientId || Boolean(editingContractId)} value={contractId} onChange={event => setContractId(event.target.value)}><option value="">Выберите договор</option>{availableContracts.map(contract => <option key={contract.id} value={contract.id}>{contract.name}</option>)}</UiSelect></label>
        </div><div className="form-fields-column">
          <label className="field horizontal-field"><span>Коэффициент <b>*</b></span><UiInput required type="number" min="0.0001" step="0.0001" value={coefficient} onChange={event => setCoefficient(event.target.value)} /></label>
        </div></div>
        <div className="complex-service-actions"><button type="button" className="secondary-button" onClick={() => { clearTariffForm(); setTab('tariffs'); setError('') }}>Отмена</button><button className="primary-button" disabled={saving || clients.length === 0}>{saving ? 'Сохраняем…' : 'Сохранить тариф'}</button></div>
      </form>}
    </div>}
    {showDeleteConfirm && details && <div className="modal-backdrop">
      <div className="complex-service-dialog" role="alertdialog" aria-modal="true" aria-labelledby="complex-service-delete-title" aria-describedby="complex-service-delete-description" onKeyDown={event => { if (event.key === 'Escape' && !deleting) setShowDeleteConfirm(false) }}>
        <h2 id="complex-service-delete-title">Удалить комплексную услугу?</h2>
        <p id="complex-service-delete-description">Услуга «{details.service.name}» и все её тарифы ({details.tariffs.length}) будут удалены. Это действие нельзя отменить.</p>
        {error && <div className="notice error" role="alert">{error}</div>}
        <div className="complex-service-dialog-actions"><button type="button" className="secondary-button" autoFocus disabled={deleting} onClick={() => setShowDeleteConfirm(false)}>Отмена</button><button type="button" className="primary-button complex-service-danger-button" disabled={deleting} onClick={removeService}>{deleting ? 'Удаляем…' : 'Удалить услугу'}</button></div>
      </div>
    </div>}
  </section>
}

