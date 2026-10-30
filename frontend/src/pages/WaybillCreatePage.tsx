import { ReceivingContainerAttributes } from '../components/ReceivingContainerAttributes'
import { UiInput, UiSelect } from '../components/FormControls'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createWaybill, getReferenceOptions } from '../api'
import type { ReferenceOption } from '../domain'
import {
  buildWaybillPayload,
  hasLoadedContainers,
  initialWaybillFormState,
  validateWaybillForm,
  validateWaybillStep,
  type WaybillCarriageRow,
  netWeight,
  selectWaybillContainer,
  type WaybillContainerRow,
} from '../waybillForm'
import {
  WAYBILL_DEPARTURE_STATIONS,
  WAYBILL_DESTINATION_STATIONS,
  WAYBILL_PAYERS,
} from '../waybillOptions'

const steps = ['Основное', 'Вагоны', 'КТК', 'Груз']

export function WaybillCreatePage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialWaybillFormState)
  const [carriages, setCarriages] = useState<ReferenceOption[]>([])
  const [containers, setContainers] = useState<ReferenceOption[]>([])
  const [hazards, setHazards] = useState<ReferenceOption[]>([])
  const [cargoOptions, setCargoOptions] = useState<ReferenceOption[]>([])
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [requestError, setRequestError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const nextKey = useRef(1)
  const submitLock = useRef(false)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getReferenceOptions('railway-carriages'),
      getReferenceOptions('containers'),
      getReferenceOptions('etsng-codes'), getReferenceOptions('hazard-classes'),
    ])
      .then(([carriageOptions, containerOptions, etsngOptions, hazardOptions]) => {
        setCarriages(carriageOptions)
        setContainers(containerOptions)
        setCargoOptions(etsngOptions); setHazards(hazardOptions)
      })
      .catch((error: unknown) => setRequestError(
        error instanceof Error ? error.message : 'Не удалось загрузить справочники',
      ))
      .finally(() => setLoadingReferences(false))
  }, [])

  const addCarriage = () => {
    const row: WaybillCarriageRow = { key: nextKey.current++, railwayCarriageId: '', containers: [] }
    setForm((state) => ({ ...state, railwayCarriages: [...state.railwayCarriages, row] }))
  }

  const updateCarriage = (key: number, change: Partial<WaybillCarriageRow>) => {
    setForm((state) => ({
      ...state,
      railwayCarriages: state.railwayCarriages.map((row) => row.key === key ? { ...row, ...change } : row),
    }))
  }

  const removeCarriage = (key: number) => {
    setForm((state) => ({
      ...state,
      railwayCarriages: state.railwayCarriages.filter((row) => row.key !== key),
    }))
  }

  const addContainer = (carriage: WaybillCarriageRow) => {
    updateCarriage(carriage.key, { containers: [...carriage.containers, { containerId: '', grossWeight: '', tareWeight: 0 }] })
  }
  const updateContainer = (carriage: WaybillCarriageRow, index: number, change: Partial<WaybillContainerRow>) => {
    updateCarriage(carriage.key, { containers: carriage.containers.map((row, i) => {
      if (i !== index) return row
      const next = { ...row, ...change }
      return next
    }) })
  }
  const setContainer = (carriage: WaybillCarriageRow, index: number, containerId: string) => {
    updateContainer(carriage, index, selectWaybillContainer(carriage.containers[index], containers.find(item => item.id === containerId)))
  }
  const removeContainer = (carriage: WaybillCarriageRow, index: number) => {
    updateCarriage(carriage.key, { containers: carriage.containers.filter((_, i) => i !== index) })
  }

  const goNext = () => {
    const validationErrors = validateWaybillStep(form, step)
    setErrors(validationErrors)
    if (validationErrors.length === 0) setStep((current) => Math.min(steps.length, current + 1))
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

  const submit = async () => {
    if (submitLock.current) return
    const validationErrors = validateWaybillForm(form)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return

    submitLock.current = true
    setSubmitting(true)
    setRequestError('')
    try {
      const created = await createWaybill(buildWaybillPayload(form))
      navigate('/waybills', { state: { createdNumber: created.number } })
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Не удалось создать накладную')
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <section className="form-page">
      <div className="page-header form-page-header">
        <h1>Создание накладной</h1>
        <div className="header-actions">
          <Link className="secondary-button" to="/waybills">Отмена</Link>
          {step < steps.length ? (
            <button className="primary-button" onClick={goNext} disabled={loadingReferences}>
              Далее <span>→</span>
            </button>
          ) : (
            <button className="primary-button" onClick={submit} disabled={submitting || loadingReferences}>
              {submitting ? 'Создаём…' : 'Создать'}
            </button>
          )}
        </div>
      </div>

      <div className="form-workspace waybill-form">
        <div className="stepper" aria-label="Этапы создания накладной">
          {steps.map((label, index) => {
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
        {errors.length > 0 && (
          <div className="notice error validation" role="alert">
            {errors.map((error) => <span key={error}>{error}</span>)}
          </div>
        )}

        {step === 1 && <section className="waybill-section">
          <div className="form-section-heading"><h2>Основное</h2></div>
          <div className="waybill-main-grid">
            <label className="field"><span>Номер накладной</span><UiInput value="Будет присвоен автоматически" readOnly aria-readonly="true" /></label>
            <label className="field"><span>Станция отправления <b>*</b></span><UiSelect value={form.departureStation} onChange={(event) => setForm({ ...form, departureStation: event.target.value })}><option value="">Выберите станцию</option>{WAYBILL_DEPARTURE_STATIONS.map((station) => <option key={station.value} value={station.value}>{station.label}</option>)}</UiSelect></label>
            <label className="field"><span>Станция назначения <b>*</b></span><UiSelect value={form.destinationStation} onChange={(event) => setForm({ ...form, destinationStation: event.target.value })}><option value="">Выберите станцию</option>{WAYBILL_DESTINATION_STATIONS.map((station) => <option key={station.value} value={station.value}>{station.label}</option>)}</UiSelect></label>
            <label className="field"><span>Плательщик <b>*</b></span><UiSelect value={form.payer} onChange={(event) => setForm({ ...form, payer: event.target.value })}><option value="">Выберите плательщика</option>{WAYBILL_PAYERS.map((payer) => <option key={payer} value={payer}>{payer}</option>)}</UiSelect></label>
          </div>
        </section>}

        {step === 2 && <section className="waybill-section">
          <div className="waybill-section-title">

            <button type="button" className="outline-action-button" onClick={addCarriage}>⊕ Добавить вагон</button>
          </div>
          {form.railwayCarriages.length === 0 && <div className="inline-empty">Вагоны не добавлены</div>}
          <div className="waybill-carriage-list">
            {form.railwayCarriages.map((carriage, carriageIndex) => (
              <article className="waybill-carriage-card" key={carriage.key}>
                <div className="waybill-carriage-head">
                  <strong>Вагон {carriageIndex + 1}</strong>
                  <UiSelect value={carriage.railwayCarriageId} onChange={(event) => updateCarriage(carriage.key, { railwayCarriageId: event.target.value })}><option value="">Выберите вагон</option>{carriages.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</UiSelect>
                  <button type="button" className="row-clear-button" onClick={() => removeCarriage(carriage.key)} aria-label="Удалить вагон">×</button>
                </div>
              </article>
            ))}
          </div>
        </section>}

        {step === 3 && <section className="waybill-section">
          {form.railwayCarriages.length === 0 && <div className="inline-empty">Вагоны не добавлены</div>}
          <div className="waybill-carriage-list">
            {form.railwayCarriages.map((carriage, carriageIndex) => {
              const carriageName = carriages.find((option) => option.id === carriage.railwayCarriageId)?.name
              return (
                <article className="waybill-carriage-card" key={carriage.key}>
                  <div className="waybill-carriage-head">
                    <strong>Вагон {carriageIndex + 1}</strong>
                    <span className="railway-carriage-code">{carriageName ?? 'Номер не выбран'}</span>
                  </div>
                  <div className="waybill-container-rows">
                    {carriage.containers.map((container, containerIndex) => (
                      <div className="waybill-mass-row" key={containerIndex}>
                        <label className="field"><span>КТК {containerIndex + 1}</span><UiSelect aria-label={`КТК ${containerIndex + 1} вагона ${carriageIndex + 1}`} value={container.containerId} onChange={event => setContainer(carriage, containerIndex, event.target.value)}><option value="">Выберите КТК</option>{containers.map(option => <option key={option.id} value={option.id} disabled={option.id !== container.containerId && form.railwayCarriages.some(row => row.containers.some(item => item.containerId === option.id))}>{option.name}</option>)}</UiSelect></label>
                        <label className="field"><span>Масса брутто, кг *</span><UiInput aria-label={`Масса брутто КТК ${containerIndex + 1} вагона ${carriageIndex + 1}`} inputMode="decimal" value={container.grossWeight} onChange={event => updateContainer(carriage, containerIndex, { grossWeight: event.target.value })} placeholder="Например: 25000" /></label>
                        <label className="field"><span>Масса тары, кг</span><UiInput aria-label={`Масса тары КТК ${containerIndex + 1} вагона ${carriageIndex + 1}`} readOnly value={container.containerId ? container.tareWeight : ''} /></label>
                        <label className="field"><span>Масса груза, кг</span><UiInput aria-label={`Масса груза КТК ${containerIndex + 1} вагона ${carriageIndex + 1}`} readOnly value={netWeight(container) ?? '—'} /></label>
                        <button type="button" className="row-clear-button" onClick={() => removeContainer(carriage, containerIndex)} aria-label="Удалить КТК">×</button>
                      </div>
                    ))}
                  </div>
                  <ReceivingContainerAttributes includeHazardClass={false}
                    containers={carriage.containers.filter(row => row.containerId).map(row => ({ ...row, id: row.containerId, name: containers.find(option => option.id === row.containerId)?.name ?? row.containerId }))}
                    onChange={(id, change) => updateCarriage(carriage.key, { containers: carriage.containers.map(row => row.containerId === id ? { ...row, ...change } : row) })} />
                  <button type="button" className="text-action-button" onClick={() => addContainer(carriage)}>+ Добавить КТК</button>
                </article>
              )
            })}
          </div>
        </section>}

        {step === 4 && <section className="waybill-section">
          {hasLoadedContainers(form) && <label className="field horizontal-field"><span>Класс опасности груза</span><UiSelect aria-label="Класс опасности груза" value={form.hazardClassId ?? ''} onChange={event => setForm(current => ({ ...current, hazardClassId: event.target.value }))}><option value="">Не указан</option>{hazards.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</UiSelect></label>}
          {hasLoadedContainers(form) ? <label className="field horizontal-field"><span>Груз по ЕТСНГ <b>*</b></span><UiSelect aria-label="Груз накладной по ЕТСНГ" value={form.etsngCodeId} onChange={event => setForm(current => ({ ...current, etsngCodeId: event.target.value }))}><option value="">Выберите груз</option>{cargoOptions.map(cargo => <option key={cargo.id} value={cargo.id}>{cargo.name}</option>)}</UiSelect></label> : <p className="composition-hint">Для порожних КТК груз не указывается.</p>}
          {form.railwayCarriages.flatMap(carriage => carriage.containers.map((container, index) => {
            const option = containers.find(item => item.id === container.containerId)
            const net = netWeight(container)
            return <article className="waybill-carriage-card" key={carriage.key + '-' + index}>
              <div className="waybill-cargo-mass-row"><strong>{option?.name ?? 'КТК не выбран'}</strong>
                <label className="field"><span>Масса груза, кг</span><UiInput readOnly value={net ?? '—'} /></label>
              </div>
            </article>
          }))}
          {form.railwayCarriages.every(carriage => carriage.containers.length === 0) && <div className="inline-empty">КТК не добавлены</div>}
        </section>}

        {step > 1 && (
          <div className="form-footer">
            <button className="secondary-button" onClick={goBack} disabled={submitting}>← Назад</button>
          </div>
        )}
      </div>
    </section>
  )
}

