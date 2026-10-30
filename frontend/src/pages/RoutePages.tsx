import { RowActions } from '../components/RowActions'
import { ActionIcon } from '../components/ActionIcon'
import { RouteInformation } from '../components/RouteInformation'
import { StatusBadge } from '../components/StatusBadge'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { UiInput, UiSelect, UiTextarea } from '../components/FormControls'
import { assignRouteOrders, createRoute, getAvailableRouteOrders, getRoute, getRoutes, getTerminalAreas } from '../api'
import { transportTypeLabel } from '../domain'
import type { TerminalAreaOption, TransportType } from '../domain'
import type { RouteDetails, RouteOrder, RouteSummary, RouteType } from '../routes'
import { routeDateLabel, routeTypeLabel } from '../routes'

export function RouteRegistryPage() {
  const [routes, setRoutes] = useState<RouteSummary[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getRoutes().then(setRoutes).catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить рейсы')) }, [])
  return <section className="registry-page">
    <div className="page-header"><h1>Рейсы</h1><Link className="primary-button" to="/routes/new"><ActionIcon name="plus" /> Создать</Link></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="table-card">
      <div className="table-wrap"><table><thead><tr><th className="registry-index" scope="col">№</th><th>Номер рейса</th><th>Тип рейса</th><th>Дата и время</th><th>Вид транспорта</th><th>Заявок</th><th>Статус</th><th className="registry-actions" scope="col" aria-label="Действия" /></tr></thead><tbody>
        {!routes && !error && <tr><td className="table-message" colSpan={8}>Загружаем рейсы…</td></tr>}
        {routes && routes.length === 0 && <tr><td className="table-message" colSpan={8}>Рейсов пока нет</td></tr>}
        {routes?.map((route, index) => <tr key={route.id}><td className="registry-index">{index + 1}</td><td><Link className="order-code" to={`/routes/${route.id}`}>{route.code}</Link></td><td>{routeTypeLabel(route.routeType)}</td><td>{routeDateLabel(route.departureAt)}</td><td>{transportTypeLabel(route.transportType)}</td><td>{route.orderCount}</td><td><StatusBadge status={route.status} /></td><td className="registry-actions"><RowActions label={'Действия с рейсом ' + route.code} actions={[{ label: 'Открыть', to: '/routes/' + route.id }]} /></td></tr>)}
      </tbody></table></div>
    </div>
  </section>
}

export function RouteCreatePage() {
  const navigate = useNavigate()
  const [areas, setAreas] = useState<TerminalAreaOption[]>([])
  const [routeType, setRouteType] = useState<RouteType>('SHIPPING')
  const [transportType, setTransportType] = useState<TransportType>('VEHICLE')
  const [areaId, setAreaId] = useState('')
  const [departureAt, setDepartureAt] = useState('')
  const [carrier, setCarrier] = useState('')
  const [driverName, setDriverName] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [comment, setComment] = useState('')
  const [options, setOptions] = useState<RouteOrder[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'main' | 'orders'>('main')

  useEffect(() => { getTerminalAreas().then(value => { setAreas(value); setAreaId(value.find(area => area.code === 'CONTAINER')?.id ?? value[0]?.id ?? '') }).catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить площадки')) }, [])
  useEffect(() => {
    if (!areaId) return
    let active = true
    getAvailableRouteOrders(routeType, transportType, areaId).then(value => { if (active) setOptions(value) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Не удалось загрузить заявки') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [routeType, transportType, areaId])

  function toggle(id: string) { setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]) }
  function nextTab() {
    const form = document.getElementById('route-create-form') as HTMLFormElement | null
    if (form?.reportValidity()) setTab('orders')
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await createRoute({ routeType, transportType, terminalAreaId: areaId,
        departureAt: new Date(departureAt).toISOString(), carrier, driverName, vehicleNumber, comment, orderIds: selected })
      navigate(`/routes/${result.route.id}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось создать рейс') }
    finally { setSaving(false) }
  }
  return <section className="form-page route-page">
    <div className="page-header"><h1>Новый рейс</h1><Link className="secondary-button" to="/routes">Отмена</Link></div>
    <form id="route-create-form" className="form-workspace" onSubmit={submit}>
      <div className="stepper" aria-label="Этапы создания рейса"><button type="button" className={`step ${tab === 'main' ? 'current' : 'complete'}`} onClick={() => setTab('main')}>Основное</button><button type="button" className={`step ${tab === 'orders' ? 'current' : ''}`} onClick={nextTab}>Заявки</button></div>
      <div hidden={tab !== 'main'}>
      <section className="form-section ui-form-section"><h2 className="form-section-heading">Основная информация</h2>
        <div className="form-fields-grid"><div className="form-fields-column">
          <label className="field horizontal-field"><span>Тип рейса <b>*</b></span><UiSelect value={routeType} onChange={e => { setSelected([]); setLoading(true); setRouteType(e.target.value as RouteType) }}><option value="SHIPPING">Вывоз</option><option value="RECEIVING">Поставка</option></UiSelect></label>
          <label className="field horizontal-field"><span>Дата и время <b>*</b></span><UiInput type="datetime-local" required value={departureAt} onChange={e => setDepartureAt(e.target.value)} /></label>
          <label className="field horizontal-field"><span>Площадка <b>*</b></span><UiSelect required value={areaId} onChange={e => { setSelected([]); setLoading(true); setAreaId(e.target.value) }}><option value="">Выберите площадку</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</UiSelect></label>
        </div><div className="form-fields-column">
          <label className="field horizontal-field"><span>Транспорт <b>*</b></span><UiSelect value={transportType} onChange={e => { setSelected([]); setLoading(true); setTransportType(e.target.value as TransportType) }}><option value="VEHICLE">Авто</option><option value="RAILWAY">ЖД</option></UiSelect></label>
          <label className="field horizontal-field"><span>Статус</span><span className="ui-readonly-value"><StatusBadge status="DRAFT" /></span></label>
        </div></div>
      </section>
      {transportType === 'VEHICLE' && <section className="form-section ui-form-section ui-section-divider"><h2 className="form-section-heading">Транспортные данные</h2><div className="form-fields-grid"><div className="form-fields-column">
        <label className="field horizontal-field"><span>Перевозчик <b>*</b></span><UiInput required maxLength={255} value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="Укажите перевозчика" /></label>
        <label className="field horizontal-field"><span>Водитель <b>*</b></span><UiInput required maxLength={255} value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="ФИО водителя" /></label>
      </div><div className="form-fields-column"><label className="field horizontal-field"><span>Номер машины <b>*</b></span><UiInput required maxLength={100} value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="Госномер" /></label></div></div></section>}
      <section className="form-section ui-form-section ui-section-divider"><h2 className="form-section-heading">Комментарий</h2><label className="field horizontal-field route-comment"><span>Комментарий</span><UiTextarea maxLength={200} value={comment} onChange={e => setComment(e.target.value)} placeholder="Необязательно" /></label></section>
      </div>
      {tab === 'main' && <div className="route-form-actions"><button type="button" className="primary-button" onClick={nextTab}>Далее →</button></div>}
      {tab === 'orders' && <section className="form-section ui-form-section ui-section-divider"><p className="route-help">Можно создать рейс без заявок и добавить их позднее. Доступны свободные черновики выбранного транспорта и площадки.</p>
        <div className="table-wrap route-orders-picker"><table><thead><tr><th scope="col">Выбрать</th><th scope="col">Номер заявки</th><th scope="col">Клиент</th><th scope="col">Статус</th></tr></thead><tbody>
          {loading && <tr><td colSpan={4} className="table-message">Загружаем заявки…</td></tr>}
          {!loading && options.length === 0 && <tr><td colSpan={4} className="table-message">Подходящих заявок пока нет</td></tr>}
          {!loading && options.map(order => <tr key={order.id}><td><UiInput type="checkbox" checked={selected.includes(order.id)} onChange={() => toggle(order.id)} aria-label={`Выбрать заявку ${order.code}`} /></td><td>{order.code}</td><td>{order.clientName}</td><td><StatusBadge status={order.status} /></td></tr>)}
        </tbody></table></div>
        <div className="route-form-actions"><span>{selected.length} выбрано</span><button className="primary-button" type="submit" disabled={saving || loading || !areaId}>{saving ? 'Создаём…' : 'Создать рейс'}</button></div>
      </section>}
      {error && <div className="notice error" role="alert">{error}</div>}
    </form>
  </section>
}

export function RouteViewPage() {
  const { routeId = '' } = useParams()
  const [details, setDetails] = useState<RouteDetails | null>(null)
  const [error, setError] = useState('')
  const [available, setAvailable] = useState<RouteOrder[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  useEffect(() => { getRoute(routeId).then(setDetails).catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить рейс')) }, [routeId])
  const route = details?.route
  useEffect(() => {
    if (!route || route.status !== 'DRAFT' || !editing) return
    let active = true
    getAvailableRouteOrders(route.routeType, route.transportType, route.terminalAreaId)
      .then(value => { if (active) setAvailable(value) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Не удалось загрузить свободные заявки') })
      .finally(() => { if (active) setLoadingAvailable(false) })
    return () => { active = false }
  }, [route, editing])
  async function addOrders() {
    if (!selected.length) return
    setSaving(true)
    setError('')
    try {
      const updated = await assignRouteOrders(routeId, selected)
      setDetails(updated)
      setSelected([])
      setEditing(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось добавить заявки') }
    finally { setSaving(false) }
  }
  return <section className="form-page route-page">
    <Link className="service-back" to="/routes">← Рейсы</Link>
    <div className="page-header"><h1>Рейс {route?.code ?? ''}</h1>{route && <div className="view-header-actions"><StatusBadge status={route.status} />{route.status === 'DRAFT' && !editing && <button type="button" className="secondary-button icon-button" aria-label="Редактировать" title="Редактировать" onClick={() => { setSelected([]); setAvailable([]); setLoadingAvailable(true); setError(''); setEditing(true) }}><ActionIcon name="edit" /></button>}</div>}</div>
    {error && <div className="notice error" role="alert">{error}</div>}
    {!details && !error && <div className="service-loading" role="status">Загружаем рейс…</div>}
    {route && <><section className="service-main-panel"><RouteInformation route={route} /></section><section className="service-order-section"><h2>Заявки в рейсе <span className="service-count">{details.orders.length}</span></h2><div className="table-wrap service-compact-table"><table><thead><tr><th>Номер заявки</th><th>Клиент</th><th>Статус</th></tr></thead><tbody>{details.orders.map(order => <tr key={order.id}><td><Link className="order-code" to={`/${route.routeType === 'RECEIVING' ? 'receiving' : 'shipping'}-orders/${order.id}`}>{order.code}</Link></td><td>{order.clientName}</td><td><StatusBadge status={order.status} /></td></tr>)}</tbody></table></div>{details.orders.length === 0 && <div className="service-section-empty">В рейсе пока нет заявок</div>}</section>
    {route.status === 'DRAFT' && editing && <section className="service-order-section route-assign-section"><h2>Добавить заявки</h2><p className="route-help">Доступны свободные черновики того же транспорта и площадки.</p><div className="table-wrap service-compact-table"><table><thead><tr><th>Выбрать</th><th>Номер заявки</th><th>Клиент</th></tr></thead><tbody>{available.map(order => <tr key={order.id}><td><UiInput type="checkbox" disabled={saving} checked={selected.includes(order.id)} onChange={() => setSelected(current => current.includes(order.id) ? current.filter(id => id !== order.id) : [...current, order.id])} aria-label={`Выбрать заявку ${order.code}`} /></td><td>{order.code}</td><td>{order.clientName}</td></tr>)}</tbody></table></div>{loadingAvailable && <p role="status">Загружаем заявки…</p>}{!loadingAvailable && available.length === 0 && <div className="service-section-empty">Свободных заявок пока нет</div>}<div className="route-form-actions"><span>{selected.length} выбрано</span><button type="button" className="secondary-button" disabled={saving} onClick={() => { setEditing(false); setSelected([]); setError('') }}>Отмена</button><button type="button" className="primary-button" disabled={!selected.length || saving || loadingAvailable} onClick={addOrders}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div></section>}</>}
  </section>
}

