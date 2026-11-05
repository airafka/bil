import { Notification } from '../components/Notification'
import { WaybillDraftComposition } from '../components/WaybillDraftComposition'
import type { RailwayCarriage } from '../railwayCarriages'
import { UiInput, UiSelect } from '../components/FormControls'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createWaybill, getReferenceOptions } from '../api'
import type { DangerProductOption, ReferenceOption } from '../domain'
import {
  buildWaybillPayload,
  initialWaybillFormState,
  validateWaybillForm,
  validateWaybillStep,
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
  const [carriages, setCarriages] = useState<RailwayCarriage[]>([])
  const [containers, setContainers] = useState<ReferenceOption[]>([])
  const [dangerProducts, setDangerProducts] = useState<DangerProductOption[]>([])
  const [sealTypes, setSealTypes] = useState<ReferenceOption[]>([])
  const [cargoOptions, setCargoOptions] = useState<ReferenceOption[]>([])
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [requestError, setRequestError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getReferenceOptions('railway-carriages'),
      getReferenceOptions('containers'),
      getReferenceOptions('etsng-codes'),
      getReferenceOptions('danger-products'),
      getReferenceOptions('seal-types'),
    ])
      .then(([carriageOptions, containerOptions, etsngOptions, dangerOptions, sealOptions]) => {
        setCarriages(carriageOptions as RailwayCarriage[])
        setContainers(containerOptions)
        setCargoOptions(etsngOptions)
        setDangerProducts(dangerOptions as DangerProductOption[])
        setSealTypes(sealOptions)
      })
      .catch((error: unknown) => setRequestError(
        error instanceof Error ? error.message : 'Не удалось загрузить справочники',
      ))
      .finally(() => setLoadingReferences(false))
  }, [])

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
          {step > 1 && (<button className="secondary-button" onClick={goBack} disabled={submitting}>← Назад</button>)}
          <Link className="close-button" to="/waybills" aria-label="Закрыть" title="Закрыть">×</Link>
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
        {requestError && <Notification kind="error">{requestError}</Notification>}
        {errors.length > 0 && (
          <Notification kind="error" title="Проверьте данные" onDismiss={() => setErrors([])}>
            {errors.map((error) => <span key={error}>{error}</span>)}
          </Notification>
        )}

        {step === 1 && <section className="waybill-section">
          <div className="form-section-heading"><h2>Основная информация</h2></div>
          <div className="waybill-main-grid waybill-main-fields">
            <label className="field"><span>Номер накладной</span><UiInput value={form.number ?? ''} maxLength={255} onChange={event => setForm(current => ({ ...current, number: event.target.value }))} placeholder="Будет присвоен автоматически" /></label>
            <label className="field"><span>Станция отправления <b>*</b></span><UiSelect value={form.departureStation} onChange={(event) => setForm({ ...form, departureStation: event.target.value })}><option value="" hidden disabled />{WAYBILL_DEPARTURE_STATIONS.map((station) => <option key={station.value} value={station.value}>{station.label}</option>)}</UiSelect></label>
            <label className="field"><span>Станция назначения <b>*</b></span><UiSelect value={form.destinationStation} onChange={(event) => setForm({ ...form, destinationStation: event.target.value })}><option value="" hidden disabled />{WAYBILL_DESTINATION_STATIONS.map((station) => <option key={station.value} value={station.value}>{station.label}</option>)}</UiSelect></label>
            <label className="field"><span>Плательщик <b>*</b></span><UiSelect value={form.payer} onChange={(event) => setForm({ ...form, payer: event.target.value })}><option value="" hidden disabled />{WAYBILL_PAYERS.map((payer) => <option key={payer} value={payer}>{payer}</option>)}</UiSelect></label>
          </div>
        </section>}

        {step > 1 && <WaybillDraftComposition tab={step === 2 ? 'wagons' : step === 3 ? 'containers' : 'cargo'}
          form={form} onChange={setForm} carriages={carriages} containers={containers} cargoOptions={cargoOptions}
          dangerProducts={dangerProducts} sealTypes={sealTypes} disabled={submitting || loadingReferences} />}

      </div>
    </section>
  )
}

