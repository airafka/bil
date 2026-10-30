import { VehicleReceivingCargoTable } from '../components/VehicleReceivingCargoTable'
import { ReceivingContainerAttributes } from '../components/ReceivingContainerAttributes'
import { ActionIcon } from '../components/ActionIcon'
import { RouteInformation } from '../components/RouteInformation'
import { WaybillCompositionTable } from '../components/WaybillCompositionTable'
import { StatusBadge } from '../components/StatusBadge'
import { OrderStatusAction } from '../components/OrderStatusAction'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { updateOrderContainerAttributes, assignRouteOrders, createReturnReceivingOrder, getOrder, getRoutes } from '../api'
import type { OrderConfig, OrderDetails } from '../domain'
import { containerTypeLabel, fillingTypeLabel, transportTypeLabel } from '../domain'
import { getWaybillStationName } from '../waybillOptions'
import type { RouteSummary, RouteType } from '../routes'
import { routeDateLabel } from '../routes'
import { UiInput, UiSelect } from '../components/FormControls'

const vehicleTabs = ['Основное', 'КТК', 'Груз']
const unnumberedVehicleTabs = ['Основное', 'КТК']
const receivingRailwayTabs = ['Основное', 'Накладные', 'Вагоны', 'КТК', 'Груз']
const shippingRailwayTabs = ['Основное', 'Вагоны', 'КТК', 'Груз']

const formatWeight = (weight: number) => weight.toLocaleString('ru-RU', { maximumFractionDigits: 3 })

export function OrderViewPage({ config, providedOrderId, embedded = false }: { config: OrderConfig; providedOrderId?: string; embedded?: boolean }) {
  const { orderId: routeOrderId = '' } = useParams()
  const orderId = providedOrderId ?? routeOrderId
  return <OrderCard key={orderId} config={config} orderId={orderId} embedded={embedded} />
}

function OrderCard({ config, orderId, embedded }: { config: OrderConfig; orderId: string; embedded: boolean }) {
  const [activeTab, setActiveTab] = useState(1)
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [routeError, setRouteError] = useState('')
  const [routesLoading, setRoutesLoading] = useState(true)
  const [containerDraft, setContainerDraft] = useState<OrderDetails['containers']>([])
  const [editing, setEditing] = useState(false)
  const [returnToStock, setReturnToStock] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [returnError, setReturnError] = useState('')
  const [creatingReturn, setCreatingReturn] = useState(false)

  useEffect(() => {
    let active = true
    getOrder(config.apiPath, orderId)
      .then((response) => active && setOrder(response))
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить заявку')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [config.apiPath, orderId])

  useEffect(() => {
    let active = true
    getRoutes().then(value => { if (active) setRoutes(value) })
      .catch(() => { if (active) setRouteError('Не удалось загрузить рейсы') })
      .finally(() => { if (active) setRoutesLoading(false) })
    return () => { active = false }
  }, [])

  const cargoContainers = useMemo(
    () => order?.containers.filter((container) => !container.empty && container.cargo) ?? [],
    [order],
  )
  const railwayCargoContainers = useMemo(
    () => order?.railwayCarriages.flatMap((carriage) => carriage.containers
      .filter((container) => !container.empty && container.cargo)
      .map((container) => ({ carriage, container }))) ?? [],
    [order],
  )
  const isRailwayReceiving = config.kind === 'receiving' && order?.transportType === 'RAILWAY'
  const isRailwayShipping = config.kind === 'shipping' && order?.transportType === 'RAILWAY'
  const isUnnumberedVehicleShipping = config.kind === 'shipping'
    && order?.transportType === 'VEHICLE'
    && order.fillingType === 'VEHICLE_UNNUMBERED'
  const isRailway = isRailwayReceiving || isRailwayShipping
  const tabs = isRailwayReceiving
    ? receivingRailwayTabs
    : isRailwayShipping
      ? shippingRailwayTabs
      : isUnnumberedVehicleShipping ? unnumberedVehicleTabs : vehicleTabs

  const visibleTabs = [tabs[0], 'Рейс', ...tabs.slice(1)]
  const contentTab = activeTab === 2 ? 0 : activeTab > 2 ? activeTab - 1 : activeTab
  const compatibleRoutes = routes.filter(route => route.routeType === (config.kind.toUpperCase() as RouteType)
    && route.transportType === order?.transportType && route.terminalAreaId === order?.terminalArea?.id && route.status === 'DRAFT')
  const existingReturn = order?.returnOrders?.[0]
  const canEditReturn = config.kind === 'shipping' && order?.transportType === 'VEHICLE' && !!order.serviceOrderId
  const numberedContainers = order ? [...order.containers, ...order.railwayCarriages.flatMap(w => w.containers)] : []
  const canEditContainers = order?.status === 'DRAFT' && numberedContainers.length > 0
    && (config.kind === 'shipping' || order?.transportType === 'VEHICLE')
  const canEditRoute = order?.status === 'DRAFT' && !order.routeId
  const assignedRoute = routes.find(route => route.id === order?.routeId)
  function startEditing() {
    setContainerDraft(numberedContainers.map(row => ({ ...row })))
    setReturnToStock(!!existingReturn)
    setSelectedRouteId(order?.routeId ?? '')
    setReturnError('')
    setSaveMessage('')
    setEditing(true)
  }
  function containerTable(rows: OrderDetails['containers']) {
    return <ReceivingContainerAttributes key={editing ? 'edit' : 'view'} showState vehicleReceiving={config.kind === 'receiving' && order?.transportType === 'VEHICLE'}
      containers={rows.map(row => ({ ...(editing && canEditContainers ? containerDraft.find(c => c.containerId === row.containerId) ?? row : row), id: row.containerId, name: row.containerName }))}
      onChange={editing && canEditContainers ? (id, change) => setContainerDraft(current => current.map(row => row.containerId === id ? { ...row, ...change } : row)) : undefined} />
  }
  async function saveOrder() {
    if (!order || creatingReturn) return
    setCreatingReturn(true)
    setReturnError('')
    try {
      if (canEditContainers && containerDraft.length) {
        const updated = await updateOrderContainerAttributes(config.apiPath, order.id, containerDraft.map(row => ({
          containerId: row.containerId, ownerClientId: row.ownerClientId || null, sealNumbers: row.sealNumbers?.trim() || null,
          sealTypeId: row.sealTypeId || null, hazardClassId: row.hazardClassId || null,
        })))
        setOrder(updated)
      }
      if (canEditRoute && selectedRouteId) {
        const updated = await assignRouteOrders(selectedRouteId, [order.id])
        setOrder(current => current ? { ...current, routeId: updated.route.id } : current)
        setRoutes(current => current.map(route => route.id === updated.route.id ? updated.route : route))
      }
      let message = 'Заявка сохранена'
      if (canEditReturn && returnToStock && !existingReturn) {
        const created = await createReturnReceivingOrder(order.id, { containerIds: order.containers.map(item => item.containerId) })
        setOrder(current => current ? { ...current, returnOrders: [{ ...created, containerNames: order.containers.map(item => item.containerName) }] } : current)
        message += '. Создана поставка ' + created.code
      }
      setEditing(false)
      setSaveMessage(message)
    } catch (cause) { setReturnError(cause instanceof Error ? cause.message : 'Не удалось сохранить заявку') }
    finally { setCreatingReturn(false) }
  }

  return (
    <section className="form-page view-page">
      {!embedded && <div className="page-header form-page-header">
        <div className="view-title">
          <h1>{config.kind === 'receiving' ? 'Заявка на поставку' : 'Заявка на вывоз'}{order ? ` ${order.code}` : ''}</h1>

        </div>
        <div className="view-header-actions">{(canEditReturn || canEditRoute || canEditContainers) && !editing && <button type="button" className="secondary-button icon-button" onClick={startEditing} aria-label="Редактировать" title="Редактировать"><ActionIcon name="edit" /></button>}{order && !editing && <OrderStatusAction key={order.id} apiPath={config.apiPath} id={order.id} status={order.status} onChanged={status => setOrder(value => value ? { ...value, status } : value)} />}<Link className="close-button" to={config.listPath} aria-label="Вернуться в реестр" title="Закрыть"><ActionIcon name="close" /></Link></div>
      </div>

      }
      <div className={embedded ? 'embedded-order' : 'form-workspace'}>
        {loading && <div className="view-loading">Загружаем заявку…</div>}
        {error && <div className="view-error-state"><div className="notice error" role="alert">{error}</div><Link className="secondary-button" to={config.listPath}>← Вернуться в реестр</Link></div>}

        {order && !loading && <>
          {embedded && !editing && <div className="view-header-actions">{(canEditReturn || canEditRoute || canEditContainers) && <button type="button" className="secondary-button icon-button" onClick={startEditing} aria-label="Редактировать" title="Редактировать"><ActionIcon name="edit" /></button>}<OrderStatusAction key={order.id} apiPath={config.apiPath} id={order.id} status={order.status} onChanged={status => setOrder(value => value ? { ...value, status } : value)} /></div>}
          <div className="stepper view-tabs" aria-label="Разделы заявки">
            {visibleTabs.map((label, index) => <button type="button" className={`step ${activeTab === index + 1 ? 'current' : ''}`} key={label} onClick={() => setActiveTab(index + 1)}>{label}</button>)}
          </div>

          {activeTab === 1 && <div className="form-section">
            <div className="form-section-heading"><h2>Основная информация</h2></div>
            <dl className="details-grid">
              <div><dt>Номер заявки</dt><dd>{order.code}</dd></div>
              <div><dt>Статус</dt><dd><StatusBadge status={order.status} /></dd></div>
              <div className="details-wide"><dt>Клиент</dt><dd>{order.clientName}</dd></div>
              <div className="details-wide"><dt>Договор</dt><dd>{order.contractName ?? 'Не указан (ранее созданная заявка)'}</dd></div>
            </dl>
            <div className="form-section-heading ui-section-divider"><h2>Параметры заявки</h2></div>
            <dl className="details-grid">
              <div><dt>Площадка</dt><dd>{order.terminalArea?.name ?? '—'}</dd></div>
              <div><dt>Транспорт</dt><dd>{transportTypeLabel(order.transportType)}</dd></div>
              <div><dt>{config.kind === 'receiving' ? 'Дата и время поступления' : 'Дата и время вывоза'}</dt><dd>{(() => {
                const value = config.kind === 'receiving' ? order.arrivalAt : order.departureAt
                return value ? new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Не указаны'
              })()}</dd></div>
              <div><dt>{config.kind === 'receiving' ? 'Грузоотправитель' : 'Грузополучатель'}</dt><dd>{(config.kind === 'receiving' ? order.consignor : order.consignee) || 'Не указан'}</dd></div>
              {order.serviceOrderId && <div className="details-wide"><dt>Заявка на услугу</dt><dd><Link to={'/service-orders/' + order.serviceOrderId}>Открыть заявку на услугу</Link></dd></div>}
              {order.sourceReceivingOrderId && <div className="details-wide"><dt>Исходная поставка</dt><dd><Link to={'/receiving-orders/' + order.sourceReceivingOrderId}>Открыть поставку КП-ЖД</Link></dd></div>}
              {order.sourceShippingOrderId && <div className="details-wide"><dt>Исходный вывоз</dt><dd><Link to={'/shipping-orders/' + order.sourceShippingOrderId}>Открыть заявку на вывоз</Link></dd></div>}
              {isRailwayShipping && <div className="details-wide"><dt>Наличие данных</dt><dd>{fillingTypeLabel(order.fillingType)}</dd></div>}
            </dl>
          </div>}

          {activeTab === 1 && canEditReturn && <div className="form-section ui-form-section">
            <div className="form-section-heading"><h2>Возврат в сток собственника</h2></div>
            {editing ? <>
              <label className="return-stock-choice"><UiInput type="checkbox" checked={returnToStock} disabled={creatingReturn || !!existingReturn} onChange={event => setReturnToStock(event.target.checked)} /> Возврат в сток собственника</label>
              {returnToStock && !existingReturn && <p className="route-help">При сохранении будет создана одна поставка КП-Авто со всеми КТК этой заявки. Контейнеры возвращаются порожними.</p>}
              {existingReturn && <p className="route-help">Возврат уже оформлен.</p>}
            </> : <p>{existingReturn ? 'Возврат оформлен' : 'Возврат не запланирован'}</p>}
            {existingReturn && <Link className="secondary-button" to={`/receiving-orders/${existingReturn.id}`}>Поставка {existingReturn.code} · {existingReturn.containerNames.join(', ')}</Link>}
          </div>}
          {saveMessage && <div className="notice success" role="status">{saveMessage}</div>}
          {activeTab === 2 && <div className="order-route-tab">
            {editing && canEditRoute && <div className="form-section ui-form-section">
              <label className="field horizontal-field"><span>Рейс:</span><UiSelect value={selectedRouteId} onChange={event => setSelectedRouteId(event.target.value)} disabled={routesLoading || creatingReturn}><option value="">Без рейса</option>{compatibleRoutes.map(route => <option key={route.id} value={route.id}>Рейс {route.code} · {routeDateLabel(route.departureAt)}</option>)}</UiSelect></label>
              {!routesLoading && !routeError && compatibleRoutes.length === 0 && <p className="route-help">Подходящих черновых рейсов пока нет.</p>}
            </div>}
            {order.routeId ? (assignedRoute ? <RouteInformation route={assignedRoute} linkNumber /> : routesLoading ? <p role="status">Загружаем рейс…</p> : <Link to={'/routes/' + order.routeId}>Открыть рейс</Link>) : <p className="route-empty">Рейс не назначен</p>}
            {routeError && <div className="notice error" role="alert">{routeError}</div>}
          </div>}

          {contentTab === 2 && !isRailway && !isUnnumberedVehicleShipping && containerTable(order.containers)}

          {contentTab === 2 && isUnnumberedVehicleShipping && (
            <UnnumberedVehicleContainerView rows={order.containerQuantities} />
          )}

          {contentTab === 2 && isRailwayReceiving && <section className="form-section" aria-label="Накладные">
            <div className="table-wrap order-composition-wrap"><table className="order-waybills-table" aria-label="Накладные заявки">
              <thead><tr><th scope="col" className="composition-index">№</th><th scope="col">Номер накладной</th><th scope="col">Станция отправления</th><th scope="col">Станция назначения</th><th scope="col">Плательщик</th></tr></thead>
              <tbody>{order.waybills.length ? order.waybills.map((waybill, index) => <tr key={waybill.id}>
                <td className="composition-index">{index + 1}</td><td>{waybill.number}</td><td>{getWaybillStationName(waybill.departureStation)}</td><td>{getWaybillStationName(waybill.destinationStation)}</td><td>{waybill.payer}</td>
              </tr>) : <tr><td colSpan={5} className="composition-empty">Накладные не найдены</td></tr>}</tbody>
            </table></div>
          </section>}

          {isRailwayReceiving && contentTab >= 3 && contentTab <= 5 && (
            <WaybillCompositionTable wagonAttributes key={contentTab} waybills={order.waybills} tab={contentTab === 3 ? 'wagons' : contentTab === 4 ? 'containers' : 'cargo'} />
          )}

          {contentTab === 2 && isRailwayShipping && <div className="form-section railway-details">
            {order.railwayCarriages.length > 0 && <div className="shipping-railway-list">{order.railwayCarriages.map((carriage, index) => <article className="shipping-railway-card view-shipping-railway-card" key={carriage.railwayCarriageId}><div className="shipping-railway-card-head"><strong>Вагон {index + 1}</strong><span className="railway-carriage-code">{carriage.railwayCarriageCode}</span></div></article>)}</div>}
            {order.railwayCarriageQuantities.length > 0 && <div className="quantity-section"><div className="view-data-table"><div className="view-data-header view-quantity-grid"><span>Количество</span><span>Род/тип вагона</span></div>{order.railwayCarriageQuantities.map((row) => <div className="view-data-row view-quantity-grid" key={row.id}><strong>{row.quantity}</strong><span>{row.typeName ?? 'Тип не указан'}</span></div>)}</div></div>}
            {order.railwayCarriages.length === 0 && order.railwayCarriageQuantities.length === 0 && <div className="inline-empty">Вагоны не найдены</div>}
          </div>}

          {contentTab === 3 && isRailwayShipping && <div className="form-section railway-details">
            {order.railwayCarriages.length > 0 && <div className="shipping-railway-list">{order.railwayCarriages.map((carriage, index) => <article className="shipping-railway-card view-shipping-railway-card" key={carriage.railwayCarriageId}>
              <div className="shipping-railway-card-head"><strong>Вагон {index + 1}</strong><span className="railway-carriage-code">{carriage.railwayCarriageCode}</span><span className="railway-container-count">{carriage.containers.length} КТК</span></div>
              {containerTable(carriage.containers)}
            </article>)}</div>}
            {order.containers.length > 0 && <div className="quantity-section"><h3>Номерные КТК</h3>{containerTable(order.containers)}</div>}
            {order.containerQuantities.length > 0 && <div className="quantity-section"><h3>Плановые группы КТК</h3><div className="view-container-quantity-list">{order.containerQuantities.map((row) => <article className="container-quantity-card" key={row.id}><div className="view-container-quantity-head"><strong>{row.quantity} КТК</strong><span>{containerTypeLabel(row.type)}</span><span>{row.empty ? 'Порожние' : 'Гружёные'}</span></div></article>)}</div></div>}
            {order.railwayCarriages.every((carriage) => carriage.containers.length === 0) && order.containers.length === 0 && order.containerQuantities.length === 0 && <div className="inline-empty">КТК не найдены</div>}
          </div>}

          {contentTab === 4 && isRailwayShipping && <div className="form-section railway-details">
            {railwayCargoContainers.length > 0 && <div className="view-data-table"><div className="view-data-header view-railway-cargo-grid"><span>Вагон</span><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>{railwayCargoContainers.map(({ carriage, container }) => <div className="view-data-row view-railway-cargo-grid" key={`${carriage.railwayCarriageId}-${container.containerId}`}><strong>{carriage.railwayCarriageCode}</strong><strong>{container.containerName}</strong><span>{container.cargo?.etsngCodeName}</span><span>{container.cargo ? formatWeight(container.cargo.weight) : '—'}</span></div>)}</div>}
            {cargoContainers.length > 0 && <div className="quantity-section"><div className="view-data-table"><div className="view-data-header view-cargo-grid"><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>{cargoContainers.map((container) => <div className="view-data-row view-cargo-grid" key={container.containerId}><strong>{container.containerName}</strong><span>{container.cargo?.etsngCodeName}</span><span>{container.cargo ? formatWeight(container.cargo.weight) : '—'}</span></div>)}</div></div>}
            {order.containerQuantities.filter((row) => !row.empty).map((row) => <article className="container-quantity-card" key={row.id}><div className="view-container-quantity-head"><strong>{row.quantity} КТК</strong><span>{containerTypeLabel(row.type)}</span><span>Гружёные</span></div><div className="view-data-table"><div className="view-data-header view-quantity-cargo-grid"><span>ЕТСНГ</span><span>Масса на один КТК, кг</span></div>{row.items.map((item) => <div className="view-data-row view-quantity-cargo-grid" key={item.id}><span>{item.etsngCode}</span><strong>{formatWeight(item.weight)}</strong></div>)}</div></article>)}
            {railwayCargoContainers.length === 0 && cargoContainers.length === 0 && order.containerQuantities.every((row) => row.empty) && <div className="all-empty-message"><span>✓</span><div><strong>В заявке нет гружёных КТК</strong><p>Данные о грузе отсутствуют.</p></div></div>}
          </div>}

          {contentTab === 3 && !isRailway && !isUnnumberedVehicleShipping && cargoContainers.length > 0 && (config.kind === 'receiving' ? <VehicleReceivingCargoTable containers={order.containers} /> : <CargoView containers={cargoContainers} />)}
          {returnError && <div className="notice error" role="alert">{returnError}</div>}
          {editing && <div className="form-footer">
            <button type="button" className="secondary-button" disabled={creatingReturn} onClick={() => { setEditing(false); setSelectedRouteId(''); setReturnError('') }}>Отмена</button>
            <button type="button" className="primary-button" disabled={creatingReturn || (returnToStock && !existingReturn && order.containers.length === 0)} onClick={saveOrder}>{creatingReturn ? 'Сохраняем…' : 'Сохранить'}</button>
          </div>}
        </>}
      </div>
    </section>
  )
}

function UnnumberedVehicleContainerView({ rows }: { rows: OrderDetails['containerQuantities'] }) {
  const row = rows[0]
  return <div className="form-section">
    {row ? (
      <div className="view-data-table unnumbered-vehicle-view-table">
        <div className="view-data-header unnumbered-vehicle-view-grid">
          <span>Номер КТК</span><span>Типоразмер</span><span>Количество</span><span>Состояние</span>
        </div>
        <div className="view-data-row unnumbered-vehicle-view-grid">
          <strong>Не назначен</strong><span>{containerTypeLabel(row.type)}</span><span>{row.quantity}</span><span>Порожний</span>
        </div>
      </div>
    ) : <div className="inline-empty">Данные КТК не найдены</div>}
  </div>
}

function CargoView({ containers }: { containers: OrderDetails['containers'] }) {
  return <div className="form-section">
    {containers.length === 0 ? <div className="all-empty-message"><span>✓</span><div><strong>В заявке нет гружёных КТК</strong><p>Все выбранные контейнеры порожние.</p></div></div> : <div className="view-data-table"><div className="view-data-header view-cargo-grid"><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>{containers.map((container) => <div className="view-data-row view-cargo-grid" key={container.containerId}><strong>{container.containerName}</strong><span>{container.cargo?.etsngCodeName}</span><span>{container.cargo ? formatWeight(container.cargo.weight) : '—'}</span></div>)}</div>}
  </div>
}

