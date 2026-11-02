import { RoutePicker } from '../components/RoutePicker'
import { OrderContainerTable } from '../components/OrderContainerTable'
import { receivingWaybillRows } from '../orderContainerRows'
import { WaybillCompositionTable } from '../components/WaybillCompositionTable'
import { StatusBadge } from '../components/StatusBadge'
import { UiInput, UiSelect } from '../components/FormControls'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createOrder, createComprehensiveServiceOrder, getContracts, getRoutes, getReferenceOptions, getTerminalAreas, getTransportTypes } from '../api'
import { WaybillSelectionModal } from '../components/WaybillSelectionModal'
import type {
  OrderConfig,
  ReferenceOption,
  TerminalAreaOption,
  TransportType,
  TransportTypeOption,
} from '../domain'

import {
  buildPayload,
  filterTransportTypes,
  findContainerArea,
  initialOrderFormState,
  setContainerCargo,
  setContainerEmpty,
  selectedWaybillTotals,
  type SelectedContainer,
  type OrderFormState,
  validateStep,
} from '../orderForm'
import { getWaybillStationName } from '../waybillOptions'
import type { RouteSummary, RouteType } from '../routes'


const vehicleSteps = ['Основное', 'КТК', 'Груз']

const receivingRailwaySteps = ['Основное', 'Накладные', 'Вагоны', 'КТК', 'Груз']
const shippingRailwaySteps = ['Основное', 'Вагоны', 'КТК', 'Груз']

export function CreateOrderPage({ config, serviceMode = false }: { config: OrderConfig; serviceMode?: boolean }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<OrderFormState>(() => ({ ...initialOrderFormState, transportType: serviceMode ? 'RAILWAY' as const : '' as const }))
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [routeLoadError, setRouteLoadError] = useState('')
  const [routesLoading,setRoutesLoading]=useState(true)
  const [contracts, setContracts] = useState<import('../comprehensiveServiceOrder').ContractOption[]>([])
  const [clients, setClients] = useState<ReferenceOption[]>([])
  const [containers, setContainers] = useState<ReferenceOption[]>([])
  const [cargoOptions, setCargoOptions] = useState<ReferenceOption[]>([])
  const [railwayCarriages, setRailwayCarriages] = useState<ReferenceOption[]>([])
  const [terminalArea, setTerminalArea] = useState<TerminalAreaOption | null>(null)
  const [transportTypes, setTransportTypes] = useState<TransportTypeOption[]>([])
  const [containerRows, setContainerRows] = useState([''])
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [requestError, setRequestError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [waybillPickerOpen, setWaybillPickerOpen] = useState(false)
  const submitLock = useRef(false)
  const nextRailwayKey = useRef(1)
  
  
  
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getReferenceOptions('clients'),
      getReferenceOptions('containers'),
      getReferenceOptions('etsng-codes'),
      getReferenceOptions('railway-carriages'),
      getTerminalAreas(),
      getTransportTypes(),
      getContracts(),
    ])
      .then(([clientOptions, containerOptions, etsngOptions, carriageOptions, terminalAreas, transportOptions, contractOptions]) => {
        const containerArea = findContainerArea(terminalAreas)
        setContracts(contractOptions)
        setClients(clientOptions)
        setContainers(containerOptions)
        setCargoOptions(etsngOptions)
        setRailwayCarriages(carriageOptions)
        setTerminalArea(containerArea)
        setTransportTypes(filterTransportTypes(transportOptions))
        if (containerArea) {
          setForm((state) => ({
            ...state,
            terminalAreaId: containerArea.id,
          }))
        } else {
          setRequestError('Контейнерная площадка отсутствует в справочнике')
        }
      })
      .catch((error: unknown) => setRequestError(
        error instanceof Error ? error.message : 'Не удалось загрузить справочники',
      ))
      .finally(() => setLoadingReferences(false))
  }, [])

  useEffect(() => {
    if (serviceMode) return
    getRoutes().then(setRoutes).catch(() => setRouteLoadError('Не удалось загрузить рейсы')).finally(()=>setRoutesLoading(false))
  }, [serviceMode])

  const loadedContainers = useMemo(
    () => form.containers.filter((container) => !container.empty),
    [form.containers],
  )
  const loadedRailwayContainers = useMemo(
    () => form.railwayCarriages.flatMap((carriage, carriageIndex) =>
      carriage.containers
        .filter((container) => !container.empty)
        .map((container) => ({ carriage, carriageIndex, container })),
    ),
    [form.railwayCarriages],
  )
  
  const isRailwayReceiving = config.kind === 'receiving' && form.transportType === 'RAILWAY'
  const isRailwayShipping = config.kind === 'shipping' && form.transportType === 'RAILWAY'
  
  const isRailway = isRailwayReceiving || isRailwayShipping
  const steps = isRailwayReceiving
    ? receivingRailwaySteps
    : isRailwayShipping
      ? shippingRailwaySteps
      : vehicleSteps
  const visibleSteps = serviceMode ? steps : [steps[0], 'Рейс', ...steps.slice(1)]
  const lastStep = visibleSteps.length
  const contentStep = serviceMode ? step : step === 2 ? 0 : step > 2 ? step - 1 : step
  const waybillTotals = useMemo(() => selectedWaybillTotals(form.waybills), [form.waybills])
  const availableTransportTypes = transportTypes
  const generalErrors = errors

  const mainStepInvalid = loadingReferences
    || !form.clientId
    || !form.contractId
    || !form.terminalAreaId
    || !form.transportType
    || ((config.kind === 'receiving' || serviceMode) && !form.defaultContainerOwnerId)

  const goNext = () => {
    const validationErrors = validateStep(form, contentStep, config.kind)
    setErrors(validationErrors)
    if (validationErrors.length === 0) setStep((current) => Math.min(lastStep, current + 1))
  }

  const goBack = () => {
    setErrors([])
    setStep((current) => Math.max(1, current - 1))
  }

  const openStep = (targetStep: number) => {
    if (targetStep >= step) return
    setErrors([])
    setStep(targetStep)
  }

  const setContainerAt = (rowIndex: number, containerId: string) => {
    const nextRows = [...containerRows]
    nextRows[rowIndex] = containerId
    setContainerRows(nextRows)

    setForm((state) => {
      const currentById = new Map(state.containers.map((container) => [container.id, container]))
      const nextContainers = nextRows
        .filter(Boolean)
        .map((id) => {
          const current = currentById.get(id)
          if (current) return current
          const option = containers.find((container) => container.id === id)
          return option
            ? { id: option.id, name: option.name, empty: false, etsngCodeId: '', weight: '' }
            : null
        })
        .filter((container) => container !== null)

      return { ...state, containers: nextContainers }
    })
  }

  const submit = async () => {
    if (submitLock.current) return
    const validationErrors = validateStep(form, serviceMode ? lastStep : lastStep - 1, config.kind)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return

    submitLock.current = true
    setSubmitting(true)
    setRequestError('')
    try {
      if (serviceMode) {
        const created = await createComprehensiveServiceOrder({ clientId: form.clientId, contractId: form.contractId, waybillIds: form.waybills.map(item => item.id), defaultContainerOwnerId: form.defaultContainerOwnerId || '' })
        navigate('/comprehensive-service-orders/' + created.order.id)
        return
      }
      const created = await createOrder(config.apiPath, buildPayload(form, config.kind))
      navigate(config.listPath, { state: { createdCode: created.code } })
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Не удалось создать заявку')
      submitLock.current = false
      setSubmitting(false)
    }
  }

  const changeTransport = (nextTransport: TransportType | '') => {
    if (form.transportType === 'VEHICLE' && nextTransport === 'RAILWAY' && form.containers.length > 0) {
      if (!window.confirm('При переходе на ЖД выбранные КТК будут очищены. Продолжить?')) return
    }
    if (
      form.transportType === 'RAILWAY'
      && nextTransport === 'VEHICLE'
      && (form.waybills.length > 0
        || form.railwayCarriages.length > 0
        || form.railwayCarriageQuantities.length > 0
        || form.containers.length > 0
        || form.containerQuantities.length > 0)
    ) {
      if (!window.confirm('При переходе на Авто железнодорожный состав будет очищен. Продолжить?')) return
    }
    setErrors([])
    setContainerRows([''])
    setForm((state) => ({
      ...state,
      transportType: nextTransport,
      defaultContainerOwnerId: state.defaultContainerOwnerId,
      routeId: '',
      containers: [],
      waybills: nextTransport === 'VEHICLE' ? [] : state.waybills,
      railwayCarriages: nextTransport === 'VEHICLE' ? [] : state.railwayCarriages,
      fillingType: 'ALL',
      railwayCarriageQuantities: [],
      containerQuantities: [],
    }))
  }

  

  const updateRailwayCarriage = (
    key: number,
    update: (carriage: typeof form.railwayCarriages[number]) => typeof form.railwayCarriages[number],
  ) => {
    setForm((state) => ({
      ...state,
      railwayCarriages: state.railwayCarriages.map((carriage) => carriage.key === key ? update(carriage) : carriage),
    }))
  }


  const addRailwayContainer = (key: number) => {
    const container: SelectedContainer = { id: '', name: '', empty: false, etsngCodeId: '', weight: '' }
    updateRailwayCarriage(key, (carriage) => ({ ...carriage, containers: [...carriage.containers, container] }))
  }

  const updateRailwayContainer = (carriageKey: number, index: number, change: Partial<SelectedContainer>) => {
    updateRailwayCarriage(carriageKey, (carriage) => ({
      ...carriage,
      containers: carriage.containers.map((container, containerIndex) =>
        containerIndex === index ? { ...container, ...change } : container,
      ),
    }))
  }

  return (
    <section className="form-page">
      <div className="page-header form-page-header">
        <h1>{serviceMode ? 'Новая заявка на услугу' : config.createTitle}</h1>
        <div className="header-actions">
          <Link className="close-button" to={serviceMode ? '/comprehensive-service-orders' : config.listPath} aria-label="Закрыть форму" title="Закрыть">×</Link>
          {step < lastStep ? (
            <button
              className="primary-button"
              onClick={goNext}
              disabled={step === 1 && mainStepInvalid}
            >
              Далее <span>→</span>
            </button>
          ) : (
            <button className="primary-button" onClick={submit} disabled={submitting}>
              {submitting ? 'Создаём…' : 'Создать заявку'}
            </button>
          )}
        </div>
      </div>

      <div className="form-workspace">
        <div className="stepper" aria-label="Этапы создания заявки">
          {visibleSteps.map((label, index) => {
            const number = index + 1
            const stateClass = number === step ? 'current' : number < step ? 'complete' : ''
            return (
              <button
                type="button"
                className={`step ${stateClass}`}
                key={label}
                onClick={() => openStep(number)}
                disabled={number > step}
              >
                {label}
              </button>
            )
          })}
        </div>

        {requestError && <div className="notice error" role="alert">{requestError}</div>}
        {generalErrors.length > 0 && (
          <div className="notice error validation" role="alert">
            {generalErrors.map((error) => <span key={error}>{error}</span>)}
          </div>
        )}

        

        {step === 1 && (
          <div className="form-section ui-form-section">
            <div className="form-section-heading"><h2>Основная информация</h2></div>
            <div className="form-fields-grid">
              <div className="form-fields-column">
                <label className="field horizontal-field"><span>Номер заявки:</span><UiInput value="" placeholder="Присваивается автоматически" disabled /></label>
                <label className="field horizontal-field">
                  <span>Клиент:<b>*</b></span><span className="field-control">
                    <UiSelect required value={form.clientId} onChange={event => setForm({ ...form, clientId: event.target.value, contractId: '' })} disabled={loadingReferences}>
                      <option value="">{loadingReferences ? 'Загрузка…' : 'Выберите клиента'}</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </UiSelect>
                    {!loadingReferences && clients.length === 0 && <small>В справочнике пока нет клиентов.</small>}
                  </span>
                </label>
                {(config.kind === 'receiving' || serviceMode) && <label className="field horizontal-field"><span>Собственник КТК по умолчанию:<b>*</b></span><UiSelect aria-label="Собственник КТК по умолчанию" required value={form.defaultContainerOwnerId || ''} disabled={loadingReferences || !form.clientId} onChange={event => setForm(current => ({ ...current, defaultContainerOwnerId: event.target.value }))}><option value="">Выберите собственника</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</UiSelect></label>}
                <label className="field horizontal-field">
                  <span>Договор:<b>*</b></span><span className="field-control">
                    <UiSelect required value={form.contractId} disabled={loadingReferences || !form.clientId} onChange={event => setForm({ ...form, contractId: event.target.value })}>
                      <option value="">Выберите договор</option>{contracts.filter(item => item.clientId === form.clientId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </UiSelect>
                    {form.clientId && !loadingReferences && !contracts.some(item => item.clientId === form.clientId) && <small>У клиента нет договоров.</small>}
                  </span>
                </label>
              </div>
              <div className="form-fields-column">
                <div className="field horizontal-field"><span>Статус:</span><div className="ui-readonly-value"><StatusBadge status="DRAFT" /></div></div>
                {!serviceMode && (config.kind === 'receiving' ? <>
                  <label className="field horizontal-field"><span>Дата и время поступления:</span><UiInput type="datetime-local" step={60} value={form.arrivalAt} onChange={event => setForm(state => ({ ...state, arrivalAt: event.target.value }))} /></label>
                  <label className="field horizontal-field"><span>Грузоотправитель:</span><UiInput maxLength={255} value={form.consignor} onChange={event => setForm(state => ({ ...state, consignor: event.target.value }))} placeholder="Наименование грузоотправителя" /></label>
                </> : <>
                  <label className="field horizontal-field"><span>Дата и время вывоза:</span><UiInput type="datetime-local" step={60} value={form.departureAt} onChange={event => setForm(state => ({ ...state, departureAt: event.target.value }))} /></label>
                  <label className="field horizontal-field"><span>Грузополучатель:</span><UiInput maxLength={255} value={form.consignee} onChange={event => setForm(state => ({ ...state, consignee: event.target.value }))} placeholder="Наименование грузополучателя" /></label>
                </>)}
              </div>
            </div>
            {!serviceMode && <>
              <div className="form-section-heading ui-section-divider"><h2>Параметры заявки</h2></div>
              <div className="form-fields-grid">
                <div className="form-fields-column">
                  <label className="field horizontal-field"><span>Площадка:<b>*</b></span><span className="field-control"><UiInput value={loadingReferences ? 'Загрузка…' : terminalArea?.name ?? ''} placeholder="Контейнерная площадка недоступна" readOnly aria-readonly="true" />{!loadingReferences && !terminalArea && <small>Контейнерная площадка не найдена.</small>}</span></label>
                  <label className="field horizontal-field"><span>Вид транспорта:<b>*</b></span><span className="field-control"><UiSelect required value={form.transportType} onChange={event => changeTransport(event.target.value as TransportType | '')} disabled={loadingReferences}><option value="">Выберите тип транспорта</option>{availableTransportTypes.map(option => <option key={option.value} value={option.value}>{option.name}</option>)}</UiSelect>{!loadingReferences && transportTypes.length === 0 && <small>Типы транспорта недоступны.</small>}</span></label>
                </div>
              </div>
            </>}
          </div>
        )}

        {!serviceMode && step === 2 && <div className="form-section"><RoutePicker routes={routes} routeType={config.kind.toUpperCase() as RouteType} transportType={form.transportType as TransportType} terminalAreaId={form.terminalAreaId}
          selectedId={form.routeId} onSelect={id=>setForm(state=>({...state,routeId:id}))} loading={routesLoading} error={routeLoadError}
          onCreated={route=>setRoutes(current=>[route,...current])}
          onRefresh={()=>{setRoutesLoading(true);setRouteLoadError('');getRoutes().then(setRoutes).catch(()=>setRouteLoadError('Не удалось загрузить рейсы')).finally(()=>setRoutesLoading(false))}} /></div>}

        {contentStep === 2 && !isRailway && <div className="form-section"><OrderContainerTable
   rows={containerRows.map((id,index) => ({ ...(form.containers.find(c => c.id===id) ?? { empty:false }), key:String(index), containerId:id, name:containers.find(c => c.id===id)?.name ?? '' }))}
   options={containers} ownerReadOnly={config.kind === 'shipping'} defaultOwnerId={form.defaultContainerOwnerId}
   onSelect={(key,id) => setContainerAt(Number(key),id)} onAdd={() => setContainerRows(rows => [...rows,''])}
   onRemove={key => { setContainerAt(Number(key),''); setContainerRows(rows => rows.filter((_,index) => index!==Number(key))) }}
   allowEmptyEdit onChange={(key,change) => { const id=containerRows[Number(key)]; setForm(state => {
     const next=change.empty===undefined ? state : setContainerEmpty(state,id,change.empty)
     return { ...next, containers:next.containers.map(c => c.id===id ? { ...c,...change } : c) }
   }) }} /></div>}

        

        {contentStep === 2 && isRailwayReceiving && (
          <div className="form-section railway-order-section">
            <div className="waybill-section-title">

              <button type="button" className="outline-action-button" onClick={() => setWaybillPickerOpen(true)}>⊕ Выбрать накладные</button>
            </div>

            {form.waybills.length === 0 ? (
              <div className="inline-empty">Накладные не выбраны</div>
            ) : (
              <>
                <div className="selected-waybill-table">
                  <div className="selected-waybill-header selected-waybill-main-grid"><span>Накладная</span><span>Маршрут</span><span>Плательщик</span><span /></div>
                  {form.waybills.map((waybill) => (
                    <div className="selected-waybill-row selected-waybill-main-grid" key={waybill.id}>
                      <strong>{waybill.number}</strong>
                      <span>{getWaybillStationName(waybill.departureStation)} → {getWaybillStationName(waybill.destinationStation)}</span>
                      <span>{waybill.payer}</span>
                      <button type="button" className="row-clear-button" onClick={() => setForm((state) => ({ ...state, waybills: state.waybills.filter((item) => item.id !== waybill.id) }))} aria-label={`Удалить накладную ${waybill.number}`}>×</button>
                    </div>
                  ))}
                </div>
                <div className="waybill-selection-total">Итого: {waybillTotals.waybills} накладных, {waybillTotals.railwayCarriages} вагонов, {waybillTotals.containers} КТК</div>
              </>
            )}
          </div>
        )}

        {isRailwayReceiving && contentStep === 4 && <div className="form-section"><OrderContainerTable rows={receivingWaybillRows(form.waybills,form.defaultContainerOwnerId,clients)} /></div>}
        {isRailwayReceiving && (contentStep === 3 || contentStep === 5) && (
          <WaybillCompositionTable key={contentStep} waybills={form.waybills} tab={contentStep === 3 ? 'wagons' : 'cargo'} draft />
        )}

        {contentStep === 2 && isRailwayShipping && (
          <div className="form-section shipping-railway-section">
            <div className="waybill-section-title">

              {(
                <button type="button" className="outline-action-button" onClick={() => setForm((state) => ({
                  ...state,
                  railwayCarriages: [...state.railwayCarriages, { key: nextRailwayKey.current++, railwayCarriageId: '', containers: [{ id: '', name: '', empty: false, etsngCodeId: '', weight: '' }] }],
                }))}>⊕ Добавить вагон</button>
              )}
            </div>

            {(form.railwayCarriages.length === 0 ? (
              <div className="inline-empty">Вагоны не добавлены</div>
            ) : (
              <div className="shipping-railway-list">
                {form.railwayCarriages.map((carriage, carriageIndex) => (
                  <article className="shipping-railway-card" key={carriage.key}>
                    <div className="shipping-railway-card-head">
                      <strong>Вагон {carriageIndex + 1}</strong>
                      <label className="field shipping-railway-carriage-select">
                        <span className="sr-only">Номер вагона {carriageIndex + 1}</span>
                        <UiSelect value={carriage.railwayCarriageId} onChange={(event) => updateRailwayCarriage(carriage.key, (item) => ({ ...item, railwayCarriageId: event.target.value }))}>
                          <option value="">Выберите номер вагона</option>
                          {railwayCarriages.map((option) => <option key={option.id} value={option.id} disabled={form.railwayCarriages.some((item) => item.key !== carriage.key && item.railwayCarriageId === option.id)}>{option.name}</option>)}
                        </UiSelect>
                      </label>
                      <button type="button" className="row-clear-button" aria-label={`Удалить вагон ${carriageIndex + 1}`} title="Удалить вагон" onClick={() => {
                        if (carriage.containers.length > 0 && !window.confirm('В вагоне есть КТК. Удалить вагон вместе с ними?')) return
                        setForm((state) => ({ ...state, railwayCarriages: state.railwayCarriages.filter((item) => item.key !== carriage.key) }))
                      }}>×</button>
                    </div>
                  </article>
                ))}
              </div>
            ))}

            
          </div>
        )}

        {contentStep === 3 && isRailwayShipping && (
          <div className="form-section shipping-railway-section">
            <div className="waybill-section-title">

              
            </div>

            {form.fillingType === 'ALL' && (form.railwayCarriages.length === 0 ? <div className="inline-empty">Вагоны не добавлены</div> : (
              <div className="shipping-railway-list">
                {form.railwayCarriages.map((carriage, carriageIndex) => (
                  <article className="shipping-railway-card" key={carriage.key}>
                    <div className="shipping-railway-card-head"><strong>Вагон {carriageIndex + 1}</strong><span className="railway-carriage-code">{railwayCarriages.find((option) => option.id === carriage.railwayCarriageId)?.name ?? 'Номер не выбран'}</span></div>
                    <OrderContainerTable
   rows={carriage.containers.map((c,index) => ({ ...c, key:String(index), containerId:c.id }))}
   options={containers} selectedIds={form.railwayCarriages.flatMap(w => w.containers.map(c => c.id))} ownerReadOnly allowEmptyEdit
   onSelect={(key,id) => { const option=containers.find(c=>c.id===id); updateRailwayContainer(carriage.key,Number(key),{ id,name:option?.name ?? '',empty:false,etsngCodeId:'',weight:'',sealNumbers:null,sealTypeId:null,hazardClassId:null }) }}
   onChange={(key,change) => { const c=carriage.containers[Number(key)]; updateRailwayContainer(carriage.key,Number(key),{ ...change,...(change.empty ? { etsngCodeId:'',weight:'' } : { etsngCodeId:c.etsngCodeId,weight:c.weight }) }) }}
   onRemove={key => updateRailwayCarriage(carriage.key,item=>({ ...item,containers:item.containers.filter((_,index)=>index!==Number(key)) }))} />
                    <button type="button" className="railway-add-container-button" onClick={() => addRailwayContainer(carriage.key)}>⊕ Добавить КТК</button>
                  </article>
                ))}
              </div>
            ))}

            

            
          </div>
        )}

        

        {contentStep === 4 && isRailwayShipping && (
          <div className="form-section shipping-railway-section">

            {form.fillingType === 'ALL' && (loadedRailwayContainers.length === 0 ? (
              <div className="all-empty-message"><span>✓</span><div><strong>Все выбранные КТК порожние</strong><p>Данные о грузе заполнять не требуется.</p></div></div>
            ) : <div className="cargo-table">
              <div className="cargo-table-header railway-cargo-grid"><span>Вагон</span><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>
              {loadedRailwayContainers.map(({ carriage, carriageIndex, container }) => {
                const containerIndex = carriage.containers.indexOf(container)
                return <div className="cargo-row railway-cargo-grid" key={`${carriage.key}-${container.id}`}>
                  <strong>{railwayCarriages.find((option) => option.id === carriage.railwayCarriageId)?.name ?? `Вагон ${carriageIndex + 1}`}</strong>
                  <strong>{container.name}</strong>
                  <label className="field"><UiSelect value={container.etsngCodeId} onChange={(event) => updateRailwayContainer(carriage.key, containerIndex, { etsngCodeId: event.target.value })}><option value="">Выберите код ЕТСНГ</option>{cargoOptions.map((cargo) => <option key={cargo.id} value={cargo.id}>{cargo.name}</option>)}</UiSelect></label>
                  <label className="field weight-field"><UiInput type="text" inputMode="decimal" placeholder="0.000" value={container.weight} onChange={(event) => updateRailwayContainer(carriage.key, containerIndex, { weight: event.target.value })} /></label>
                </div>
              })}
            </div>)}

            

            
          </div>
        )}

        {contentStep === 3 && !isRailway && (
          <div className="form-section">

            {loadedContainers.length === 0 ? (
              <div className="all-empty-message">
                <span>✓</span>
                <div><strong>Все выбранные КТК порожние</strong><p>Данные о грузе заполнять не требуется.</p></div>
              </div>
            ) : (
              <div className="cargo-table">
                <div className="cargo-table-header">
                  <span>КТК</span>
                  <span>Груз</span>
                  <span>Масса, кг</span>
                </div>
                {loadedContainers.map((container) => (
                  <div className="cargo-row" key={container.id}>
                    <strong>{container.name}</strong>
                    <label className="field">
                      <span className="sr-only">Груз для {container.name}</span>
                      <UiSelect
                        value={container.etsngCodeId}
                        onChange={(event) => setForm((state) =>
                          setContainerCargo(state, container.id, 'etsngCodeId', event.target.value),
                        )}
                      >
                        <option value="">Выберите код ЕТСНГ</option>
                        {cargoOptions.map((cargo) => <option key={cargo.id} value={cargo.id}>{cargo.name}</option>)}
                      </UiSelect>
                    </label>
                    <label className="field weight-field">
                      <span className="sr-only">Масса для {container.name}</span>
                      <UiInput
                        type="text"
                        inputMode="decimal"
                        placeholder="0.000"
                        value={container.weight}
                        onChange={(event) => setForm((state) =>
                          setContainerCargo(state, container.id, 'weight', event.target.value),
                        )}
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step > 1 && (
          <div className="form-footer">
            <button className="secondary-button" onClick={goBack} disabled={submitting}>← Назад</button>
          </div>
        )}
      </div>
      {waybillPickerOpen && (
        <WaybillSelectionModal
          selected={form.waybills}
          onClose={() => setWaybillPickerOpen(false)}
          onConfirm={(waybills) => {
            setForm((state) => ({ ...state, waybills }))
            setWaybillPickerOpen(false)
            setErrors([])
          }}
        />
      )}
    </section>
  )
}


