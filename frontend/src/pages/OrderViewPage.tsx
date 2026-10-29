import { StatusBadge } from '../components/StatusBadge'
import { OrderStatusAction } from '../components/OrderStatusAction'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { assignRouteOrders, createReturnReceivingOrder, getOrder, getRoutes } from '../api'
import type { OrderConfig, OrderDetails } from '../domain'
import { containerTypeLabel, fillingTypeLabel, statusLabel, transportTypeLabel } from '../domain'
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
  const [activeTab, setActiveTab] = useState(1)
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [routeError, setRouteError] = useState('')
  const [savingRoute, setSavingRoute] = useState(false)
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

  useEffect(() => { getRoutes().then(setRoutes).catch(() => setRouteError('Не удалось загрузить рейсы')) }, [])

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
  function startEditing() {
    setReturnToStock(!!existingReturn)
    setReturnError('')
    setSaveMessage('')
    setActiveTab(1)
    setEditing(true)
  }
  async function saveShipping() {
    if (!order || creatingReturn) return
    if (!returnToStock || existingReturn) { setEditing(false); setSaveMessage('Заявка сохранена'); return }
    setCreatingReturn(true)
    setReturnError('')
    try {
      const created = await createReturnReceivingOrder(order.id, { containerIds: order.containers.map(item => item.containerId) })
      setOrder(current => current ? { ...current, returnOrders: [{ ...created, containerNames: order.containers.map(item => item.containerName) }] } : current)
      setEditing(false)
      setSaveMessage('Заявка сохранена. Создана поставка ' + created.code)
    } catch (cause) { setReturnError(cause instanceof Error ? cause.message : 'Не удалось сохранить заявку') }
    finally { setCreatingReturn(false) }
  }
  async function attachRoute() {
    if (!order || !selectedRouteId) return
    setSavingRoute(true)
    setRouteError('')
    try {
      await assignRouteOrders(selectedRouteId, [order.id])
      setOrder(current => current ? { ...current, routeId: selectedRouteId } : current)
      setRoutes(await getRoutes())
    } catch (cause) { setRouteError(cause instanceof Error ? cause.message : 'Не удалось выбрать рейс') }
    finally { setSavingRoute(false) }
  }

  return (
    <section className="form-page view-page">
      {!embedded && <div className="page-header form-page-header">
        <div className="view-title">
          <h1>{config.kind === 'receiving' ? 'Заявка на поставку' : 'Заявка на вывоз'}{order ? ` ${order.code}` : ''}</h1>
          {order && <StatusBadge status={order.status} />}
        </div>
        <div className="view-header-actions">{canEditReturn && !editing && <button type="button" className="secondary-button" onClick={startEditing}>Редактировать</button>}{order && <OrderStatusAction key={order.id} apiPath={config.apiPath} id={order.id} status={order.status} onChanged={status => setOrder(value => value ? { ...value, status } : value)} />}<Link className="close-button" to={config.listPath} aria-label="Вернуться в реестр" title="Закрыть">×</Link></div>
      </div>

      }
      <div className={embedded ? 'embedded-order' : 'form-workspace'}>
        {loading && <div className="view-loading">Загружаем заявку…</div>}
        {error && <div className="view-error-state"><div className="notice error" role="alert">{error}</div><Link className="secondary-button" to={config.listPath}>← Вернуться в реестр</Link></div>}

        {order && !loading && <>
          {embedded && <OrderStatusAction key={order.id} apiPath={config.apiPath} id={order.id} status={order.status} onChanged={status => setOrder(value => value ? { ...value, status } : value)} />}
          <div className="stepper view-tabs" aria-label="Разделы заявки">
            {visibleTabs.map((label, index) => <button type="button" className={`step ${activeTab === index + 1 ? 'current' : ''}`} key={label} onClick={() => setActiveTab(index + 1)}>{label}</button>)}
          </div>

          {activeTab === 1 && <div className="form-section">
            <div className="form-section-heading"><h2>Основная информация</h2></div>
            <dl className="details-grid">
              <div><dt>Номер заявки</dt><dd>{order.code}</dd></div>
              <div><dt>Статус</dt><dd>{statusLabel(order.status)}</dd></div>
              <div className="details-wide"><dt>Клиент</dt><dd>{order.clientName}</dd></div>
              <div className="details-wide"><dt>Договор</dt><dd>{order.contractName ?? 'Не указан (ранее созданная заявка)'}</dd></div>
              {order.serviceOrderId && <div className="details-wide"><dt>Заявка на услугу</dt><dd><Link to={'/service-orders/' + order.serviceOrderId}>Открыть заявку на услугу</Link></dd></div>}
              {order.sourceReceivingOrderId && <div className="details-wide"><dt>Исходная поставка</dt><dd><Link to={'/receiving-orders/' + order.sourceReceivingOrderId}>Открыть поставку КП-ЖД</Link></dd></div>}
              {order.sourceShippingOrderId && <div className="details-wide"><dt>Исходный вывоз</dt><dd><Link to={'/shipping-orders/' + order.sourceShippingOrderId}>Открыть заявку на вывоз</Link></dd></div>}
              <div><dt>Площадка</dt><dd>{order.terminalArea?.name ?? '—'}</dd></div>
              <div><dt>Транспорт</dt><dd>{transportTypeLabel(order.transportType)}</dd></div>
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
            {returnError && <div className="notice error" role="alert">{returnError}</div>}
          </div>}
          {saveMessage && <div className="notice success" role="status">{saveMessage}</div>}
          {editing && <div className="form-footer">
            <button type="button" className="secondary-button" disabled={creatingReturn} onClick={() => { setEditing(false); setReturnError('') }}>Отмена</button>
            <button type="button" className="primary-button" disabled={creatingReturn || (returnToStock && !existingReturn && order.containers.length === 0)} onClick={saveShipping}>{creatingReturn ? 'Сохраняем…' : 'Сохранить'}</button>
          </div>}

          {activeTab === 2 && <div className="form-section ui-form-section">
            <div className="form-section-heading"><h2>Рейс</h2></div>
            {order.routeId ? <div className="form-fields-grid"><div className="form-fields-column"><div className="field horizontal-field"><span>Рейс:</span><Link to={'/routes/' + order.routeId}>Открыть рейс</Link></div></div></div> : <>
              <div className="form-fields-grid"><div className="form-fields-column"><label className="field horizontal-field"><span>Рейс:</span><UiSelect value={selectedRouteId} onChange={event => setSelectedRouteId(event.target.value)} disabled={order.status !== 'DRAFT'}><option value="">Без рейса</option>{compatibleRoutes.map(route => <option key={route.id} value={route.id}>Рейс {route.code} · {routeDateLabel(route.departureAt)}</option>)}</UiSelect></label></div></div>
              {order.status === 'DRAFT' && <div className="route-form-actions"><button type="button" className="primary-button" disabled={!selectedRouteId || savingRoute} onClick={attachRoute}>{savingRoute ? 'Сохраняем…' : 'Добавить в рейс'}</button></div>}
              {compatibleRoutes.length === 0 && <p className="route-help">Подходящих черновых рейсов пока нет.</p>}
            </>}
            {routeError && <div className="notice error" role="alert">{routeError}</div>}
          </div>}

          {contentTab === 2 && !isRailway && !isUnnumberedVehicleShipping && <ContainerView containers={order.containers} />}

          {contentTab === 2 && isUnnumberedVehicleShipping && (
            <UnnumberedVehicleContainerView rows={order.containerQuantities} />
          )}

          {contentTab === 2 && isRailwayReceiving && <div className="form-section railway-details">
            <div className="form-section-heading"><h2>Накладные</h2><p>{order.waybills.length} накладных в заявке</p></div>
            {order.waybills.length === 0 ? <div className="inline-empty">Накладные не найдены</div> : <div className="order-waybill-list">
              {order.waybills.map((waybill) => <article className="order-waybill-card" key={waybill.id}>
                <div className="order-waybill-head"><strong>{waybill.number}</strong><span>{getWaybillStationName(waybill.departureStation)} → {getWaybillStationName(waybill.destinationStation)}</span><span>{waybill.payer}</span></div>
              </article>)}
            </div>}
          </div>}

          {contentTab === 3 && isRailwayReceiving && <div className="form-section railway-details">
            <div className="form-section-heading"><h2>Вагоны</h2><p>Вагоны сгруппированы по накладным</p></div>
            <div className="order-waybill-list">{order.waybills.map((waybill) => <article className="order-waybill-card" key={waybill.id}>
              <div className="order-waybill-head"><strong>{waybill.number}</strong><span>{getWaybillStationName(waybill.departureStation)} → {getWaybillStationName(waybill.destinationStation)}</span></div>
              <div className="order-waybill-composition"><div>{waybill.railwayCarriages.length === 0 ? <span className="expanded-empty">Нет вагонов</span> : waybill.railwayCarriages.map((carriage) => <div className="order-carriage-row" key={carriage.id}><strong>{carriage.number}</strong></div>)}</div></div>
            </article>)}</div>
          </div>}

          {contentTab === 4 && isRailwayReceiving && <div className="form-section railway-details">
            <div className="form-section-heading"><h2>КТК</h2><p>КТК сгруппированы по накладным и вагонам</p></div>
            <div className="order-waybill-list">{order.waybills.map((waybill) => <article className="order-waybill-card" key={waybill.id}>
              <div className="order-waybill-head"><strong>{waybill.number}</strong><span>{getWaybillStationName(waybill.departureStation)} → {getWaybillStationName(waybill.destinationStation)}</span></div>
              <div className="order-waybill-composition"><div>{waybill.railwayCarriages.length === 0 ? <span className="expanded-empty">Нет вагонов</span> : waybill.railwayCarriages.map((carriage) => <div className="order-carriage-row" key={carriage.id}><strong>{carriage.number}</strong><div>{carriage.containers.length === 0 ? <span className="expanded-empty">Без КТК</span> : carriage.containers.map((container) => <span className="waybill-chip" key={container.containerId}>{container.number} · брутто {formatWeight(container.grossWeight)} кг · тара {formatWeight(container.tareWeight)} кг · груз {formatWeight(container.netWeight)} кг</span>)}</div></div>)}</div></div>
            </article>)}</div>
          </div>}

          {contentTab === 5 && isRailwayReceiving && <div className="form-section railway-details">
            <div className="form-section-heading"><h2>Груз</h2><p>Грузы сгруппированы по накладным</p></div>
            <div className="order-waybill-list">{order.waybills.map((waybill) => <article className="order-waybill-card" key={waybill.id}>
              <div className="order-waybill-head"><strong>{waybill.number}</strong><span>{getWaybillStationName(waybill.departureStation)} → {getWaybillStationName(waybill.destinationStation)}</span></div>
              <div className="order-waybill-composition"><div>{waybill.products.length === 0 ? <span className="expanded-empty">Нет грузов</span> : waybill.products.map((product) => <div className="order-product-row" key={product.id}><span>{product.etsngCode}</span><strong>{product.weight == null ? 'Масса не указана' : `${formatWeight(product.weight)} кг`}</strong></div>)}</div></div>
            </article>)}</div>
          </div>}

          {contentTab === 2 && isRailwayShipping && <div className="form-section railway-details">
            <div className="form-section-heading"><h2>Вагоны</h2><p>{fillingTypeLabel(order.fillingType)}</p></div>
            {order.railwayCarriages.length > 0 && <div className="shipping-railway-list">{order.railwayCarriages.map((carriage, index) => <article className="shipping-railway-card view-shipping-railway-card" key={carriage.railwayCarriageId}><div className="shipping-railway-card-head"><strong>Вагон {index + 1}</strong><span className="railway-carriage-code">{carriage.railwayCarriageCode}</span></div></article>)}</div>}
            {order.railwayCarriageQuantities.length > 0 && <div className="quantity-section"><div className="view-data-table"><div className="view-data-header view-quantity-grid"><span>Количество</span><span>Род/тип вагона</span></div>{order.railwayCarriageQuantities.map((row) => <div className="view-data-row view-quantity-grid" key={row.id}><strong>{row.quantity}</strong><span>{row.typeName ?? 'Тип не указан'}</span></div>)}</div></div>}
            {order.railwayCarriages.length === 0 && order.railwayCarriageQuantities.length === 0 && <div className="inline-empty">Вагоны не найдены</div>}
          </div>}

          {contentTab === 3 && isRailwayShipping && <div className="form-section railway-details">
            <div className="form-section-heading"><h2>КТК</h2><p>Номерные КТК показаны с контекстом вагона</p></div>
            {order.railwayCarriages.length > 0 && <div className="shipping-railway-list">{order.railwayCarriages.map((carriage, index) => <article className="shipping-railway-card view-shipping-railway-card" key={carriage.railwayCarriageId}>
              <div className="shipping-railway-card-head"><strong>Вагон {index + 1}</strong><span className="railway-carriage-code">{carriage.railwayCarriageCode}</span><span className="railway-container-count">{carriage.containers.length} КТК</span></div>
              <div className="view-data-table"><div className="view-data-header view-ktk-state-grid"><span>КТК</span><span>Состояние</span></div>{carriage.containers.map((container) => <div className="view-data-row view-ktk-state-grid" key={container.containerId}><strong>{container.containerName}</strong><span>{container.empty ? 'Порожний' : 'Гружёный'}</span></div>)}</div>
            </article>)}</div>}
            {order.containers.length > 0 && <div className="quantity-section"><h3>Номерные КТК</h3><div className="view-data-table"><div className="view-data-header view-ktk-state-grid"><span>КТК</span><span>Состояние</span></div>{order.containers.map((container) => <div className="view-data-row view-ktk-state-grid" key={container.containerId}><strong>{container.containerName}</strong><span>{container.empty ? 'Порожний' : 'Гружёный'}</span></div>)}</div></div>}
            {order.containerQuantities.length > 0 && <div className="quantity-section"><h3>Плановые группы КТК</h3><div className="view-container-quantity-list">{order.containerQuantities.map((row) => <article className="container-quantity-card" key={row.id}><div className="view-container-quantity-head"><strong>{row.quantity} КТК</strong><span>{containerTypeLabel(row.type)}</span><span>{row.empty ? 'Порожние' : 'Гружёные'}</span></div></article>)}</div></div>}
            {order.railwayCarriages.every((carriage) => carriage.containers.length === 0) && order.containers.length === 0 && order.containerQuantities.length === 0 && <div className="inline-empty">КТК не найдены</div>}
          </div>}

          {contentTab === 4 && isRailwayShipping && <div className="form-section railway-details">
            <div className="form-section-heading"><h2>Груз</h2><p>Груз только для гружёных КТК и групп</p></div>
            {railwayCargoContainers.length > 0 && <div className="view-data-table"><div className="view-data-header view-railway-cargo-grid"><span>Вагон</span><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>{railwayCargoContainers.map(({ carriage, container }) => <div className="view-data-row view-railway-cargo-grid" key={`${carriage.railwayCarriageId}-${container.containerId}`}><strong>{carriage.railwayCarriageCode}</strong><strong>{container.containerName}</strong><span>{container.cargo?.etsngCodeName}</span><span>{container.cargo ? formatWeight(container.cargo.weight) : '—'}</span></div>)}</div>}
            {cargoContainers.length > 0 && <div className="quantity-section"><div className="view-data-table"><div className="view-data-header view-cargo-grid"><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>{cargoContainers.map((container) => <div className="view-data-row view-cargo-grid" key={container.containerId}><strong>{container.containerName}</strong><span>{container.cargo?.etsngCodeName}</span><span>{container.cargo ? formatWeight(container.cargo.weight) : '—'}</span></div>)}</div></div>}
            {order.containerQuantities.filter((row) => !row.empty).map((row) => <article className="container-quantity-card" key={row.id}><div className="view-container-quantity-head"><strong>{row.quantity} КТК</strong><span>{containerTypeLabel(row.type)}</span><span>Гружёные</span></div><div className="view-data-table"><div className="view-data-header view-quantity-cargo-grid"><span>ЕТСНГ</span><span>Масса на один КТК, кг</span></div>{row.items.map((item) => <div className="view-data-row view-quantity-cargo-grid" key={item.id}><span>{item.etsngCode}</span><strong>{formatWeight(item.weight)}</strong></div>)}</div></article>)}
            {railwayCargoContainers.length === 0 && cargoContainers.length === 0 && order.containerQuantities.every((row) => row.empty) && <div className="all-empty-message"><span>✓</span><div><strong>В заявке нет гружёных КТК</strong><p>Данные о грузе отсутствуют.</p></div></div>}
          </div>}

          {contentTab === 3 && !isRailway && !isUnnumberedVehicleShipping && <CargoView containers={cargoContainers} />}
        </>}
      </div>
    </section>
  )
}

function UnnumberedVehicleContainerView({ rows }: { rows: OrderDetails['containerQuantities'] }) {
  const row = rows[0]
  return <div className="form-section">
    <div className="form-section-heading"><h2>КТК</h2><p>Безномерный вывоз по авто</p></div>
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

function ContainerView({ containers }: { containers: OrderDetails['containers'] }) {
  return <div className="form-section">
    <div className="form-section-heading"><h2>Контейнеры</h2><p>{containers.length} КТК в заявке</p></div>
    <div className="view-data-table"><div className="view-data-header view-ktk-grid"><span>№</span><span>Номер КТК</span><span>Порожний</span></div>{containers.map((container, index) => <div className="view-data-row view-ktk-grid" key={container.containerId}><span>{index + 1}</span><strong>{container.containerName}</strong><span className={`readonly-checkbox ${container.empty ? 'checked' : ''}`} aria-label={container.empty ? 'Порожний' : 'Гружёный'}>{container.empty ? '✓' : ''}</span></div>)}</div>
  </div>
}

function CargoView({ containers }: { containers: OrderDetails['containers'] }) {
  return <div className="form-section">
    <div className="form-section-heading"><h2>Груз</h2></div>
    {containers.length === 0 ? <div className="all-empty-message"><span>✓</span><div><strong>В заявке нет гружёных КТК</strong><p>Все выбранные контейнеры порожние.</p></div></div> : <div className="view-data-table"><div className="view-data-header view-cargo-grid"><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>{containers.map((container) => <div className="view-data-row view-cargo-grid" key={container.containerId}><strong>{container.containerName}</strong><span>{container.cargo?.etsngCodeName}</span><span>{container.cargo ? formatWeight(container.cargo.weight) : '—'}</span></div>)}</div>}
  </div>
}

