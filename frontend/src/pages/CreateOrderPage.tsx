import { ReceivingContainerAttributes } from '../components/ReceivingContainerAttributes'
import { WaybillCompositionTable } from '../components/WaybillCompositionTable'
import { StatusBadge } from '../components/StatusBadge'
import { UiInput, UiSelect } from '../components/FormControls'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createOrder, createServiceOrder, getContracts, getRoutes, getReferenceOptions, getTerminalAreas, getTransportTypes } from '../api'
import { WaybillSelectionModal } from '../components/WaybillSelectionModal'
import type {
  FillingType,
  OrderConfig,
  ReferenceOption,
  TerminalAreaOption,
  TransportType,
  TransportTypeOption,
} from '../domain'
import { containerTypeOptions, fillingTypeOptions } from '../domain'
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
import { routeDateLabel } from '../routes'

const vehicleSteps = ['Основное', 'КТК', 'Груз']
const unnumberedVehicleSteps = ['Основное', 'КТК']
const receivingRailwaySteps = ['Основное', 'Накладные', 'Вагоны', 'КТК', 'Груз']
const shippingRailwaySteps = ['Основное', 'Вагоны', 'КТК', 'Груз']

export function CreateOrderPage({ config, serviceMode = false }: { config: OrderConfig; serviceMode?: boolean }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<OrderFormState>(() => ({ ...initialOrderFormState, transportType: serviceMode ? 'RAILWAY' as const : '' as const }))
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [routeLoadError, setRouteLoadError] = useState('')
  const [contracts, setContracts] = useState<import('../serviceOrder').ContractOption[]>([])
  const [clients, setClients] = useState<ReferenceOption[]>([])
  const [containers, setContainers] = useState<ReferenceOption[]>([])
  const [cargoOptions, setCargoOptions] = useState<ReferenceOption[]>([])
  const [railwayCarriages, setRailwayCarriages] = useState<ReferenceOption[]>([])
  const [railwayCarriageTypes, setRailwayCarriageTypes] = useState<ReferenceOption[]>([])
  const [terminalArea, setTerminalArea] = useState<TerminalAreaOption | null>(null)
  const [transportTypes, setTransportTypes] = useState<TransportTypeOption[]>([])
  const [containerRows, setContainerRows] = useState(['', '', ''])
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [requestError, setRequestError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [waybillPickerOpen, setWaybillPickerOpen] = useState(false)
  const submitLock = useRef(false)
  const nextRailwayKey = useRef(1)
  const nextRailwayQuantityKey = useRef(1)
  const nextContainerQuantityKey = useRef(1)
  const nextQuantityCargoKey = useRef(1)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getReferenceOptions('clients'),
      getReferenceOptions('containers'),
      getReferenceOptions('etsng-codes'),
      getReferenceOptions('railway-carriages'),
      getReferenceOptions('railway-carriage-types'),
      getTerminalAreas(),
      getTransportTypes(),
      getContracts(),
    ])
      .then(([clientOptions, containerOptions, etsngOptions, carriageOptions, carriageTypeOptions, terminalAreas, transportOptions, contractOptions]) => {
        const containerArea = findContainerArea(terminalAreas)
        setContracts(contractOptions)
        setClients(clientOptions)
        setContainers(containerOptions)
        setCargoOptions(etsngOptions)
        setRailwayCarriages(carriageOptions)
        setRailwayCarriageTypes(carriageTypeOptions)
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
    getRoutes().then(setRoutes).catch(() => setRouteLoadError('Не удалось загрузить рейсы'))
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
  const loadedContainerQuantityGroups = useMemo(
    () => form.containerQuantities.filter((group) => !group.empty),
    [form.containerQuantities],
  )
  const isRailwayReceiving = config.kind === 'receiving' && form.transportType === 'RAILWAY'
  const isRailwayShipping = config.kind === 'shipping' && form.transportType === 'RAILWAY'
  const isUnnumberedVehicleShipping = config.kind === 'shipping'
    && form.transportType === 'VEHICLE'
    && form.fillingType === 'VEHICLE_UNNUMBERED'
  const isRailway = isRailwayReceiving || isRailwayShipping
  const steps = isRailwayReceiving
    ? receivingRailwaySteps
    : isRailwayShipping
      ? shippingRailwaySteps
      : isUnnumberedVehicleShipping ? unnumberedVehicleSteps : vehicleSteps
  const visibleSteps = serviceMode ? steps : [steps[0], 'Рейс', ...steps.slice(1)]
  const lastStep = visibleSteps.length
  const contentStep = serviceMode ? step : step === 2 ? 0 : step > 2 ? step - 1 : step
  const compatibleRoutes = routes.filter(route => route.routeType === (config.kind.toUpperCase() as RouteType)
    && route.transportType === form.transportType && route.terminalAreaId === form.terminalAreaId && route.status === 'DRAFT')
  const waybillTotals = useMemo(() => selectedWaybillTotals(form.waybills), [form.waybills])
  const availableTransportTypes = transportTypes
  const generalErrors = errors

  const mainStepInvalid = loadingReferences
    || !form.clientId
    || !form.contractId
    || !form.terminalAreaId
    || !form.transportType

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
        const created = await createServiceOrder({ clientId: form.clientId, contractId: form.contractId, waybillIds: form.waybills.map(item => item.id) })
        navigate('/service-orders/' + created.order.id)
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
    setContainerRows(['', '', ''])
    setForm((state) => ({
      ...state,
      transportType: nextTransport,
      routeId: '',
      containers: [],
      waybills: nextTransport === 'VEHICLE' ? [] : state.waybills,
      railwayCarriages: nextTransport === 'VEHICLE' ? [] : state.railwayCarriages,
      fillingType: 'ALL',
      railwayCarriageQuantities: [],
      containerQuantities: [],
    }))
  }

  const changeFillingType = (fillingType: FillingType) => {
    const hasComposition = form.railwayCarriages.length > 0
      || form.railwayCarriageQuantities.length > 0
      || form.containers.length > 0
      || form.containerQuantities.length > 0
    if (hasComposition && fillingType !== form.fillingType) {
      if (!window.confirm('При изменении наличия данных текущий состав нужно очистить. Очистить состав и продолжить?')) return
    }
    setContainerRows(['', '', ''])
    setErrors([])
    setForm((state) => ({
      ...state,
      fillingType,
      railwayCarriages: [],
      railwayCarriageQuantities: [],
      containers: [],
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
          <Link className="close-button" to={serviceMode ? '/service-orders' : config.listPath} aria-label="Закрыть форму" title="Закрыть">×</Link>
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
                {isRailwayShipping && <div className="form-fields-column"><label className="field horizontal-field"><span>Наличие данных:<b>*</b></span><UiSelect value={form.fillingType} onChange={event => changeFillingType(event.target.value as FillingType)}>{fillingTypeOptions.filter(option => option.value !== 'VEHICLE_UNNUMBERED').map(option => <option key={option.value} value={option.value}>{option.name}</option>)}</UiSelect></label></div>}
              </div>
            </>}
          </div>
        )}

        {!serviceMode && step === 2 && <div className="form-section ui-form-section">
          <div className="form-fields-grid"><div className="form-fields-column"><label className="field horizontal-field"><span>Рейс:</span><UiSelect value={form.routeId} onChange={event => setForm(state => ({ ...state, routeId: event.target.value }))}><option value="">Без рейса</option>{compatibleRoutes.map(route => <option value={route.id} key={route.id}>Рейс {route.code} · {routeDateLabel(route.departureAt)}</option>)}</UiSelect></label></div></div>
          <p className="route-help">Доступны черновые рейсы выбранного транспорта и площадки. Можно добавить заявку в рейс позднее.</p>
          {routeLoadError && <div className="notice error" role="alert">{routeLoadError}</div>}
        </div>}

        {contentStep === 2 && !isRailway && !isUnnumberedVehicleShipping && (
          <div className="form-section">
            <div className="ktk-toolbar">
              <button
                type="button"
                className="outline-action-button"
                onClick={() => setContainerRows((rows) => [...rows, ''])}
              >
                <span>⊕</span> Добавить
              </button>
            </div>

            <div className="ktk-table" role="table" aria-label="Выбор КТК">
              <div className="ktk-table-header" role="row">
                <span role="columnheader">№</span>
                <span role="columnheader">Номер КТК <b>*</b></span>
                <span role="columnheader">Порожний</span>
                <span role="columnheader" aria-label="Действия" />
              </div>
              {containerRows.map((containerId, rowIndex) => {
                const selectedContainer = form.containers.find((container) => container.id === containerId)
                return (
                  <div className="ktk-table-row" role="row" key={rowIndex}>
                    <span className="ktk-row-number" role="cell">{rowIndex + 1}</span>
                    <label className="field" role="cell">
                      <span className="sr-only">Номер КТК в строке {rowIndex + 1}</span>
                      <UiSelect
                        value={containerId}
                        onChange={(event) => setContainerAt(rowIndex, event.target.value)}
                      >
                        <option value="">Выберите номер</option>
                        {containers.map((container) => {
                          const usedInAnotherRow = containerRows.some(
                            (id, index) => id === container.id && index !== rowIndex,
                          )
                          return (
                            <option key={container.id} value={container.id} disabled={usedInAnotherRow}>
                              {container.name}
                            </option>
                          )
                        })}
                      </UiSelect>
                    </label>
                    <label className="table-checkbox" role="cell">
                      <UiInput
                        type="checkbox"
                        checked={selectedContainer?.empty ?? false}
                        disabled={!selectedContainer}
                        onChange={(event) => selectedContainer && setForm((state) =>
                          setContainerEmpty(state, selectedContainer.id, event.target.checked),
                        )}
                      />
                      <span aria-hidden="true">{selectedContainer?.empty ? '✓' : ''}</span>
                      <span className="sr-only">Порожний</span>
                    </label>
                    <button
                      type="button"
                      className="row-clear-button"
                      onClick={() => setContainerAt(rowIndex, '')}
                      disabled={!selectedContainer}
                      aria-label={`Очистить строку ${rowIndex + 1}`}
                      title="Очистить строку"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
            {<ReceivingContainerAttributes containers={form.containers}
              onChange={(id, change) => setForm(state => ({ ...state, containers: state.containers.map(row => row.id === id ? { ...row, ...change } : row) }))} />}
          </div>
        )}

        {contentStep === 2 && isUnnumberedVehicleShipping && (
          <div className="form-section unnumbered-vehicle-section">
            <div className="unnumbered-vehicle-fields">
              <label className="field horizontal-field">
                <span>Количество КТК <b>*</b></span>
                <span className="field-control">
                  <UiInput
                    type="number"
                    min="1"
                    step="1"
                    value={form.containerQuantities[0]?.quantity ?? ''}
                    placeholder="Введите количество"


                    onChange={(event) => setForm((state) => ({
                      ...state,
                      containerQuantities: state.containerQuantities.map((row, index) =>
                        index === 0 ? { ...row, quantity: event.target.value } : row,
                      ),
                    }))}
                  />
                </span>
              </label>
              <label className="field horizontal-field">
                <span>Типоразмер КТК <b>*</b></span>
                <span className="field-control">
                  <UiSelect
                    value={form.containerQuantities[0]?.type ?? ''}
                    onChange={(event) => setForm((state) => ({
                      ...state,
                      containerQuantities: state.containerQuantities.map((row, index) =>
                        index === 0 ? { ...row, type: event.target.value as typeof row.type } : row,
                      ),
                    }))}
                  >
                    <option value="">Выберите типоразмер</option>
                    {containerTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.name}</option>)}
                  </UiSelect>
                </span>
              </label>
              <label className="field horizontal-field">
                <span>Состояние КТК <b>*</b></span>
                <span className="field-control"><UiInput value="Порожний" readOnly aria-readonly="true" /></span>
              </label>
            </div>
          </div>
        )}

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

        {isRailwayReceiving && contentStep >= 3 && contentStep <= 5 && (
          <WaybillCompositionTable key={contentStep} waybills={form.waybills} tab={contentStep === 3 ? 'wagons' : contentStep === 4 ? 'containers' : 'cargo'} draft />
        )}

        {contentStep === 2 && isRailwayShipping && (
          <div className="form-section shipping-railway-section">
            <div className="waybill-section-title">

              {(form.fillingType === 'ALL' || form.fillingType === 'RAILWAY_CARRIAGE') && (
                <button type="button" className="outline-action-button" onClick={() => setForm((state) => ({
                  ...state,
                  railwayCarriages: [...state.railwayCarriages, { key: nextRailwayKey.current++, railwayCarriageId: '', containers: [] }],
                }))}>⊕ Добавить вагон</button>
              )}
            </div>

            {(form.fillingType === 'ALL' || form.fillingType === 'RAILWAY_CARRIAGE') && (form.railwayCarriages.length === 0 ? (
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

            {(form.fillingType === 'CONTAINER' || form.fillingType === 'NONE') && (
              <div className="quantity-table-section">
                <div className="ktk-toolbar">
                  <button type="button" className="outline-action-button" onClick={() => setForm((state) => ({
                    ...state,
                    railwayCarriageQuantities: [...state.railwayCarriageQuantities, { key: nextRailwayQuantityKey.current++, quantity: '', typeId: '' }],
                  }))}><span>⊕</span> Добавить</button>
                </div>
                <div className="quantity-table" role="table" aria-label="Количество вагонов">
                  <div className="quantity-table-header carriage-quantity-grid" role="row">
                    <span role="columnheader">№</span>
                    <span role="columnheader">Количество вагонов <b>*</b></span>
                    <span role="columnheader">Род/тип вагона</span>
                    <span role="columnheader" aria-label="Действия" />
                  </div>
                  {form.railwayCarriageQuantities.map((row, index) => (
                    <div className="quantity-table-row carriage-quantity-grid" role="row" key={row.key}>
                      <span className="ktk-row-number" role="cell">{index + 1}</span>
                      <label className="field" role="cell"><span className="sr-only">Количество вагонов в строке {index + 1}</span><UiInput type="number" min="1" step="1" value={row.quantity} onChange={(event) => setForm((state) => ({ ...state, railwayCarriageQuantities: state.railwayCarriageQuantities.map((item) => item.key === row.key ? { ...item, quantity: event.target.value } : item) }))} /></label>
                      <label className="field" role="cell"><span className="sr-only">Род или тип вагона в строке {index + 1}</span><UiSelect value={row.typeId} onChange={(event) => setForm((state) => ({ ...state, railwayCarriageQuantities: state.railwayCarriageQuantities.map((item) => item.key === row.key ? { ...item, typeId: event.target.value } : item) }))}>
                        <option value="">Тип не указан</option>
                        {railwayCarriageTypes.map((option) => <option key={option.id} value={option.id} disabled={row.typeId !== option.id && form.railwayCarriageQuantities.some((item) => item.typeId === option.id)}>{option.name}</option>)}
                      </UiSelect></label>
                      <button type="button" className="row-clear-button" aria-label={`Удалить строку вагонов ${index + 1}`} onClick={() => setForm((state) => ({ ...state, railwayCarriageQuantities: state.railwayCarriageQuantities.filter((item) => item.key !== row.key) }))}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {contentStep === 3 && isRailwayShipping && (
          <div className="form-section shipping-railway-section">
            <div className="waybill-section-title">

              {form.fillingType === 'CONTAINER' && <button type="button" className="outline-action-button" onClick={() => setContainerRows((rows) => [...rows, ''])}>⊕ Добавить КТК</button>}
            </div>

            {form.fillingType === 'ALL' && (form.railwayCarriages.length === 0 ? <div className="inline-empty">Вагоны не добавлены</div> : (
              <div className="shipping-railway-list">
                {form.railwayCarriages.map((carriage, carriageIndex) => (
                  <article className="shipping-railway-card" key={carriage.key}>
                    <div className="shipping-railway-card-head"><strong>Вагон {carriageIndex + 1}</strong><span className="railway-carriage-code">{railwayCarriages.find((option) => option.id === carriage.railwayCarriageId)?.name ?? 'Номер не выбран'}</span></div>
                    <div className="shipping-railway-container-table">
                      <div className="shipping-railway-container-header shipping-railway-ktk-grid"><span>КТК *</span><span>Порожний</span><span /></div>
                      {carriage.containers.map((container, containerIndex) => (
                        <div className="shipping-railway-container-row shipping-railway-ktk-grid" key={`${carriage.key}-${containerIndex}`}>
                          <label className="field"><span className="sr-only">КТК в вагоне {carriageIndex + 1}</span><UiSelect value={container.id} onChange={(event) => {
                            const option = containers.find((item) => item.id === event.target.value)
                            updateRailwayContainer(carriage.key, containerIndex, { id: event.target.value, name: option?.name ?? '' })
                          }}><option value="">Выберите номер КТК</option>{containers.map((option) => <option key={option.id} value={option.id} disabled={container.id !== option.id && form.railwayCarriages.some((item) => item.containers.some((selected) => selected.id === option.id))}>{option.name}</option>)}</UiSelect></label>
                          <label className="table-checkbox"><UiInput type="checkbox" checked={container.empty} onChange={(event) => updateRailwayContainer(carriage.key, containerIndex, { empty: event.target.checked, etsngCodeId: event.target.checked ? '' : container.etsngCodeId, weight: event.target.checked ? '' : container.weight })} /><span aria-hidden="true">{container.empty ? '✓' : ''}</span><span className="sr-only">Порожний</span></label>
                          <button type="button" className="row-clear-button" aria-label={`Удалить КТК ${containerIndex + 1}`} onClick={() => updateRailwayCarriage(carriage.key, (item) => ({ ...item, containers: item.containers.filter((_, index) => index !== containerIndex) }))}>×</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="railway-add-container-button" onClick={() => addRailwayContainer(carriage.key)}>⊕ Добавить КТК</button>
                  </article>
                ))}
              </div>
            ))}

            {form.fillingType === 'CONTAINER' && <div className="shipping-railway-container-table numbered-container-table">
              <div className="shipping-railway-container-header shipping-railway-ktk-grid"><span>КТК *</span><span>Порожний</span><span /></div>
              {containerRows.map((containerId, rowIndex) => {
                const selected = form.containers.find((container) => container.id === containerId)
                return <div className="shipping-railway-container-row shipping-railway-ktk-grid" key={rowIndex}>
                  <label className="field"><UiSelect value={containerId} onChange={(event) => setContainerAt(rowIndex, event.target.value)}><option value="">Выберите номер КТК</option>{containers.map((option) => <option key={option.id} value={option.id} disabled={containerRows.some((id, index) => id === option.id && index !== rowIndex)}>{option.name}</option>)}</UiSelect></label>
                  <label className="table-checkbox"><UiInput type="checkbox" checked={selected?.empty ?? false} disabled={!selected} onChange={(event) => selected && setForm((state) => setContainerEmpty(state, selected.id, event.target.checked))} /><span>{selected?.empty ? '✓' : ''}</span><span className="sr-only">Порожний</span></label>
                  <button type="button" className="row-clear-button" disabled={!selected} onClick={() => setContainerAt(rowIndex, '')}>×</button>
                </div>
              })}
            </div>}

            {(form.fillingType === 'RAILWAY_CARRIAGE' || form.fillingType === 'NONE') && (
              <div className="quantity-table-section">
                <div className="ktk-toolbar">
                  <button type="button" className="outline-action-button" onClick={() => setForm((state) => ({
                    ...state,
                    containerQuantities: [...state.containerQuantities, { key: nextContainerQuantityKey.current++, quantity: '', type: '', empty: false, items: [] }],
                  }))}><span>⊕</span> Добавить</button>
                </div>
                <div className="quantity-table" role="table" aria-label="Количество КТК">
                  <div className="quantity-table-header container-quantity-grid" role="row">
                    <span role="columnheader">№</span>
                    <span role="columnheader">Количество КТК <b>*</b></span>
                    <span role="columnheader">Тип КТК <b>*</b></span>
                    <span role="columnheader">Порожний</span>
                    <span role="columnheader" aria-label="Действия" />
                  </div>
                  {form.containerQuantities.map((row, rowIndex) => (
                    <div className="quantity-table-row container-quantity-grid" role="row" key={row.key}>
                      <span className="ktk-row-number" role="cell">{rowIndex + 1}</span>
                      <label className="field" role="cell"><span className="sr-only">Количество КТК в строке {rowIndex + 1}</span><UiInput type="number" min="1" step="1" value={row.quantity} onChange={(event) => setForm((state) => ({ ...state, containerQuantities: state.containerQuantities.map((item) => item.key === row.key ? { ...item, quantity: event.target.value } : item) }))} /></label>
                      <label className="field" role="cell"><span className="sr-only">Тип КТК в строке {rowIndex + 1}</span><UiSelect value={row.type} onChange={(event) => setForm((state) => ({ ...state, containerQuantities: state.containerQuantities.map((item) => item.key === row.key ? { ...item, type: event.target.value as typeof row.type } : item) }))}><option value="">Выберите тип</option>{containerTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.name}</option>)}</UiSelect></label>
                      <label className="table-checkbox" role="cell"><UiInput type="checkbox" checked={row.empty} onChange={(event) => setForm((state) => ({ ...state, containerQuantities: state.containerQuantities.map((item) => item.key === row.key ? { ...item, empty: event.target.checked, items: event.target.checked ? [] : item.items } : item) }))} /><span aria-hidden="true">{row.empty ? '✓' : ''}</span><span className="sr-only">Порожний</span></label>
                      <button type="button" className="row-clear-button" aria-label={`Удалить строку КТК ${rowIndex + 1}`} onClick={() => setForm((state) => ({ ...state, containerQuantities: state.containerQuantities.filter((item) => item.key !== row.key) }))}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {contentStep === 3 && isRailwayShipping && <ReceivingContainerAttributes
          containers={[...form.containers, ...form.railwayCarriages.flatMap(w => w.containers)].filter(c => c.id)}
          onChange={(id, change) => setForm(state => ({ ...state,
            containers: state.containers.map(row => row.id === id ? { ...row, ...change } : row),
            railwayCarriages: state.railwayCarriages.map(w => ({ ...w, containers: w.containers.map(row => row.id === id ? { ...row, ...change } : row) })),
          }))} />}

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

            {form.fillingType === 'CONTAINER' && (loadedContainers.length === 0 ? (
              <div className="all-empty-message"><span>✓</span><div><strong>Все выбранные КТК порожние</strong><p>Данные о грузе заполнять не требуется.</p></div></div>
            ) : <div className="cargo-table">
              <div className="cargo-table-header"><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>
              {loadedContainers.map((container) => <div className="cargo-row" key={container.id}>
                <strong>{container.name}</strong>
                <label className="field"><UiSelect value={container.etsngCodeId} onChange={(event) => setForm((state) => setContainerCargo(state, container.id, 'etsngCodeId', event.target.value))}><option value="">Выберите код ЕТСНГ</option>{cargoOptions.map((cargo) => <option key={cargo.id} value={cargo.id}>{cargo.name}</option>)}</UiSelect></label>
                <label className="field weight-field"><UiInput type="text" inputMode="decimal" placeholder="0.000" value={container.weight} onChange={(event) => setForm((state) => setContainerCargo(state, container.id, 'weight', event.target.value))} /></label>
              </div>)}
            </div>)}

            {(form.fillingType === 'RAILWAY_CARRIAGE' || form.fillingType === 'NONE') && (loadedContainerQuantityGroups.length === 0 ? (
              <div className="all-empty-message"><span>✓</span><div><strong>Все группы КТК порожние</strong><p>Данные о грузе заполнять не требуется.</p></div></div>
            ) : <div className="container-quantity-list">
              {loadedContainerQuantityGroups.map((row) => {
                const rowIndex = form.containerQuantities.indexOf(row)
                return <article className="container-quantity-card" key={row.key}>
                  <div className="view-container-quantity-head"><strong>Группа {rowIndex + 1}</strong><span>{row.quantity} КТК</span><span>{containerTypeOptions.find((option) => option.value === row.type)?.name ?? 'Тип не выбран'}</span></div>
                  <div className="quantity-cargo-list">
                    {row.items.map((item, itemIndex) => <div className="quantity-cargo-row" key={item.key}>
                      <span>Груз {itemIndex + 1}</span>
                      <label className="field"><UiSelect value={item.etsngCodeId} onChange={(event) => setForm((state) => ({ ...state, containerQuantities: state.containerQuantities.map((group) => group.key === row.key ? { ...group, items: group.items.map((cargo) => cargo.key === item.key ? { ...cargo, etsngCodeId: event.target.value } : cargo) } : group) }))}><option value="">Выберите ЕТСНГ</option>{cargoOptions.map((cargo) => <option key={cargo.id} value={cargo.id}>{cargo.name}</option>)}</UiSelect></label>
                      <label className="field"><UiInput type="text" inputMode="decimal" placeholder="Масса на один КТК, кг" value={item.weight} onChange={(event) => setForm((state) => ({ ...state, containerQuantities: state.containerQuantities.map((group) => group.key === row.key ? { ...group, items: group.items.map((cargo) => cargo.key === item.key ? { ...cargo, weight: event.target.value } : cargo) } : group) }))} /></label>
                      <button type="button" className="row-clear-button" onClick={() => setForm((state) => ({ ...state, containerQuantities: state.containerQuantities.map((group) => group.key === row.key ? { ...group, items: group.items.filter((cargo) => cargo.key !== item.key) } : group) }))}>×</button>
                    </div>)}
                    <button type="button" className="railway-add-container-button" onClick={() => setForm((state) => ({ ...state, containerQuantities: state.containerQuantities.map((group) => group.key === row.key ? { ...group, items: [...group.items, { key: nextQuantityCargoKey.current++, etsngCodeId: '', weight: '' }] } : group) }))}>⊕ Добавить груз</button>
                  </div>
                </article>
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


