import { RailwayReceivingHierarchy } from '../components/RailwayReceivingHierarchy'
import { AddedContainerCargo } from '../components/AddedContainerCargo'
import { containerAdditionsPayload, type DraftContainerAddition } from '../orderContainerAdditions'
import { RoutePicker } from '../components/RoutePicker'
import { VehicleReceivingCargoTable } from '../components/VehicleReceivingCargoTable'
import { OrderContainerTable } from '../components/OrderContainerTable'
import { ActionIcon } from '../components/ActionIcon'
import { RouteInformation } from '../components/RouteInformation'
import { WaybillCompositionTable } from '../components/WaybillCompositionTable'
import { StatusBadge } from '../components/StatusBadge'
import { OrderStatusAction } from '../components/OrderStatusAction'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { updateOrderContainerAttributes, assignRouteOrders, createReturnReceivingOrder, getOrder, getRoutes, getReferenceOptions } from '../api'
import type { OrderConfig, OrderDetails } from '../domain'
import { fillingTypeLabel, transportTypeLabel } from '../domain'
import { getWaybillStationName } from '../waybillOptions'
import type { RouteSummary, RouteType } from '../routes'

import { UiInput, UiSelect } from '../components/FormControls'

const vehicleTabs = ['Основное', 'КТК', 'Груз']

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
  const [containerAdditions,setContainerAdditions]=useState<DraftContainerAddition[]>([])
  const [containerOptions,setContainerOptions]=useState<import('../domain').ReferenceOption[]>([])
  const [cargoOptions,setCargoOptions]=useState<import('../domain').ReferenceOption[]>([])
  const [additionReferencesLoading,setAdditionReferencesLoading]=useState(false)
  const [containerDraft, setContainerDraft] = useState<OrderDetails['containers']>([])
  const [defaultOwnerDraft, setDefaultOwnerDraft] = useState('')
  const [ownerClients, setOwnerClients] = useState<import('../domain').ReferenceOption[]>([])
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
    () => order?.containers.flatMap(container => (container.cargoItems ?? (container.cargo ? [container.cargo] : [])).map(cargo => ({ ...container, cargo }))).filter((container) => !container.empty && container.cargo) ?? [],
    [order],
  )
  const railwayCargoContainers = useMemo(
    () => order?.railwayCarriages.flatMap((carriage) => carriage.containers.flatMap(container => (container.cargoItems ?? (container.cargo ? [container.cargo] : [])).map(cargo => ({ ...container, cargo })))
      .filter((container) => !container.empty && container.cargo)
      .map((container) => ({ carriage, container }))) ?? [],
    [order],
  )
  const isRailwayReceiving = config.kind === 'receiving' && order?.transportType === 'RAILWAY'
  const isRailwayShipping = config.kind === 'shipping' && order?.transportType === 'RAILWAY'
  
  const isRailway = isRailwayReceiving || isRailwayShipping
  const tabs = isRailwayReceiving
    ? receivingRailwayTabs
    : isRailwayShipping
      ? shippingRailwayTabs
      : vehicleTabs

  const visibleTabs = [tabs[0], 'Рейс', ...tabs.slice(1)]
  const contentTab = activeTab === 2 ? 0 : activeTab > 2 ? activeTab - 1 : activeTab
  const existingReturn = order?.returnOrders?.[0]
  const canEditReturn = config.kind === 'shipping' && order?.transportType === 'VEHICLE' && !!order.comprehensiveServiceOrderId
  const numberedContainers = order ? [...order.containers, ...order.railwayCarriages.flatMap(w => w.containers)] : []
  const canEditDefaultOwner = config.kind === 'receiving' && order?.status === 'DRAFT'
  const canAddContainers = order?.status === 'DRAFT' && !order.comprehensiveServiceOrderId && !order.sourceReceivingOrderId && !order.sourceShippingOrderId
    && (order.transportType === 'VEHICLE' || (config.kind === 'shipping' && order.transportType === 'RAILWAY'))
  const canEditContainers = order?.status === 'DRAFT' && (numberedContainers.length > 0 || canAddContainers)

  const canEditRoute = order?.status === 'DRAFT' && !order.routeId
  const assignedRoute = routes.find(route => route.id === order?.routeId)
  function startEditing() {
    setContainerAdditions([])
    if(canAddContainers){setAdditionReferencesLoading(true);Promise.all([getReferenceOptions('containers'),getReferenceOptions('etsng-codes')])
      .then(([containers,cargo])=>{setContainerOptions(containers);setCargoOptions(cargo)})
      .catch(e=>setReturnError(e instanceof Error?e.message:'Не удалось загрузить справочники'))
      .finally(()=>setAdditionReferencesLoading(false))}
    setDefaultOwnerDraft(order?.defaultContainerOwnerId || '')
    if(config.kind === 'receiving') getReferenceOptions('clients').then(setOwnerClients).catch(e => setReturnError(String(e)))
    setContainerDraft(numberedContainers.map(row => ({ ...row })))
    setReturnToStock(!!existingReturn)
    setSelectedRouteId(order?.routeId ?? '')
    setReturnError('')
    setSaveMessage('')
    setEditing(true)
  }
  function containerTable(rows: OrderDetails['containers'], railwayCarriageId?: string) {
    const adding=editing&&canAddContainers
    const pending=adding?containerAdditions.filter(row=>row.railwayCarriageId===railwayCarriageId):[]
    const keys=pending.map(row=>row.key)
    const allRows=[...rows.map(row=>({...(editing&&canEditContainers?containerDraft.find(c=>c.containerId===row.containerId)??row:row),key:row.containerId,name:row.containerName})),
      ...pending.map(row=>({...row.container,key:row.key,containerId:row.container.id}))]
    return <><OrderContainerTable defaultOwnerId={config.kind==='receiving'?defaultOwnerDraft||order?.defaultContainerOwnerId||undefined:undefined} ownerReadOnly={config.kind==='shipping'} key={editing?'edit':'view'}
      rows={allRows} options={containerOptions} selectableKeys={keys} removableKeys={keys} allowEmptyEdit={!!adding} addDisabled={additionReferencesLoading}
      selectedIds={[...numberedContainers.map(c=>c.containerId),...containerAdditions.map(row=>row.container.id)]}
      onAdd={adding?()=>setContainerAdditions(current=>[...current,{key:'new:'+crypto.randomUUID(),railwayCarriageId,container:{id:'',name:'',empty:false,etsngCodeId:'',weight:''}}]):undefined}
      onRemove={adding?key=>setContainerAdditions(current=>current.filter(row=>row.key!==key)):undefined}
      onSelect={adding?(key,id)=>{const option=containerOptions.find(c=>c.id===id);setContainerAdditions(current=>current.map(row=>row.key===key?{...row,container:{id,name:option?.name??'',empty:false,etsngCodeId:'',weight:''}}:row))}:undefined}
      onChange={editing&&canEditContainers?(key,change)=>{
        if(key.startsWith('new:'))setContainerAdditions(current=>current.map(row=>row.key===key?{...row,container:{...row.container,...change,...(change.empty?{etsngCodeId:'',weight:''}:{})}}:row))
        else setContainerDraft(current=>current.map(row=>row.containerId===key?{...row,...change}:row))
      }:undefined}/>
      {adding&&<AddedContainerCargo rows={pending} options={cargoOptions} onChange={(key,field,value)=>setContainerAdditions(current=>current.map(row=>row.key===key?{...row,container:{...row.container,[field]:value}}:row))}/>}
    </>
  }
  async function saveOrder() {
    if (!order || creatingReturn) return
    setCreatingReturn(true)
    setReturnError('')
    try {
      const additions=containerAdditionsPayload(containerAdditions,numberedContainers.map(c=>c.containerId))
      if ((canEditContainers && containerDraft.length) || canEditDefaultOwner || additions.length) {
        const updated = await updateOrderContainerAttributes(config.apiPath, order.id, containerDraft.map(row => ({
          containerId: row.containerId, ownerClientId: row.ownerClientId || null, sealNumbers: row.sealNumbers?.trim() || null,
          sealTypeId: row.sealTypeId || null, hazardClassId: row.hazardClassId || null,
        })), canEditDefaultOwner ? defaultOwnerDraft : undefined, additions)
        setOrder(updated)
        setContainerAdditions([])
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
        <div className="view-header-actions">{(canEditReturn || canEditRoute || canEditContainers || canEditDefaultOwner) && !editing && <button type="button" className="secondary-button icon-button" onClick={startEditing} aria-label="Редактировать" title="Редактировать"><ActionIcon name="edit" /></button>}{order && !editing && <OrderStatusAction key={order.id} apiPath={config.apiPath} id={order.id} status={order.status} onChanged={status => { setOrder(value => value ? { ...value, status } : value); getOrder(config.apiPath, orderId).then(setOrder).catch(e => setError(String(e))) }} />}<Link className="close-button" to={config.listPath} aria-label="Вернуться в реестр" title="Закрыть"><ActionIcon name="close" /></Link></div>
      </div>

      }
      <div className={embedded ? 'embedded-order' : 'form-workspace'}>
        {loading && <div className="view-loading">Загружаем заявку…</div>}
        {error && <div className="view-error-state"><div className="notice error" role="alert">{error}</div><Link className="secondary-button" to={config.listPath}>← Вернуться в реестр</Link></div>}

        {order && !loading && <>
          {embedded && !editing && <div className="view-header-actions">{(canEditReturn || canEditRoute || canEditContainers || canEditDefaultOwner) && <button type="button" className="secondary-button icon-button" onClick={startEditing} aria-label="Редактировать" title="Редактировать"><ActionIcon name="edit" /></button>}<OrderStatusAction key={order.id} apiPath={config.apiPath} id={order.id} status={order.status} onChanged={status => { setOrder(value => value ? { ...value, status } : value); getOrder(config.apiPath, orderId).then(setOrder).catch(e => setError(String(e))) }} /></div>}
          <div className="stepper view-tabs" aria-label="Разделы заявки">
            {visibleTabs.map((label, index) => <button type="button" className={`step ${activeTab === index + 1 ? 'current' : ''}`} key={label} onClick={() => setActiveTab(index + 1)}>{label}</button>)}
          </div>

          {activeTab === 1 && <div className="form-section">
            <div className="form-section-heading"><h2>Основная информация</h2></div>
            <dl className="details-grid">
              <div><dt>Номер заявки</dt><dd>{order.code}</dd></div>
              <div><dt>Статус</dt><dd><StatusBadge status={order.status} /></dd></div>
              <div className="details-wide"><dt>Клиент</dt><dd>{order.clientName}</dd></div>
              {config.kind === 'receiving' && <div className="details-wide"><dt>Собственник КТК по умолчанию</dt><dd>{editing && canEditDefaultOwner ? <><UiSelect aria-label="Собственник КТК по умолчанию" value={defaultOwnerDraft} disabled={creatingReturn || !ownerClients.length} onChange={event => { const value=event.target.value; setDefaultOwnerDraft(value); setContainerAdditions(current=>current.map(row=>({...row,container:{...row.container,ownerClientId:value,ownerClientName:ownerClients.find(client=>client.id===value)?.name}}))); setContainerDraft(current => current.map(row => ({ ...row, ownerClientId:value, ownerClientName:ownerClients.find(client => client.id===value)?.name }))) }}>{ownerClients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</UiSelect><small>Смена значения обновит собственников всех КТК заявки.</small></> : order.defaultContainerOwnerName || 'Не указан'}</dd></div>}
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
              {order.comprehensiveServiceOrderId && <div className="details-wide"><dt>Заявка на услугу</dt><dd><Link to={'/comprehensive-service-orders/' + order.comprehensiveServiceOrderId}>Открыть заявку на услугу</Link></dd></div>}
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
            {editing && canEditRoute && order.transportType && <div className="form-section"><RoutePicker routes={routes} routeType={config.kind.toUpperCase() as RouteType} transportType={order.transportType} terminalAreaId={order.terminalArea.id}
              selectedId={selectedRouteId} onSelect={setSelectedRouteId} loading={routesLoading} error={routeError} disabled={creatingReturn}
              onCreated={route=>setRoutes(current=>[route,...current])}
              onRefresh={()=>{setRoutesLoading(true);setRouteError('');getRoutes().then(setRoutes).catch(()=>setRouteError('Не удалось загрузить рейсы')).finally(()=>setRoutesLoading(false))}} /></div>}
            {order.routeId ? (assignedRoute ? <RouteInformation route={assignedRoute} linkNumber /> : routesLoading ? <p role="status">Загружаем рейс…</p> : <Link to={'/routes/' + order.routeId}>Открыть рейс</Link>) : <p className="route-empty">Рейс не назначен</p>}
            {routeError && <div className="notice error" role="alert">{routeError}</div>}
          </div>}

          {contentTab === 2 && !isRailway && containerTable(order.containers)}

          

          {contentTab === 2 && isRailwayReceiving && <section className="form-section" aria-label="Накладные">
            <div className="table-wrap order-composition-wrap"><table className="order-waybills-table" aria-label="Накладные заявки">
              <thead><tr><th scope="col" className="composition-index">№</th><th scope="col">Номер накладной</th><th scope="col">Станция отправления</th><th scope="col">Станция назначения</th><th scope="col">Плательщик</th></tr></thead>
              <tbody>{order.waybills.length ? order.waybills.map((waybill, index) => <tr key={waybill.id}>
                <td className="composition-index">{index + 1}</td><td>{waybill.number}</td><td>{getWaybillStationName(waybill.departureStation)}</td><td>{getWaybillStationName(waybill.destinationStation)}</td><td>{waybill.payer}</td>
              </tr>) : <tr><td colSpan={5} className="composition-empty">Накладные не найдены</td></tr>}</tbody>
            </table></div>
          </section>}

          {isRailwayReceiving&&contentTab===4&&<RailwayReceivingHierarchy waybills={order.waybills}
            containers={order.containers.map(row=>editing&&canEditContainers?containerDraft.find(c=>c.containerId===row.containerId)??row:row)}
            defaultOwnerId={defaultOwnerDraft||order.defaultContainerOwnerId||undefined}
            onChange={editing&&canEditContainers?(id,change)=>setContainerDraft(current=>current.map(row=>row.containerId===id?{...row,...change}:row)):undefined}/>}  
          {isRailwayReceiving && (contentTab === 3 || contentTab === 5) && (
            <WaybillCompositionTable wagonAttributes key={contentTab} waybills={order.waybills} tab={contentTab === 3 ? 'wagons' : 'cargo'} />
          )}

          {contentTab === 2 && isRailwayShipping && <div className="form-section railway-details">
            {order.railwayCarriages.length > 0 && <div className="shipping-railway-list">{order.railwayCarriages.map((carriage, index) => <article className="shipping-railway-card view-shipping-railway-card" key={carriage.railwayCarriageId}><div className="shipping-railway-card-head"><strong>Вагон {index + 1}</strong><span className="railway-carriage-code">{carriage.railwayCarriageCode}</span></div></article>)}</div>}
            
            {order.railwayCarriages.length === 0 && <div className="inline-empty">Вагоны не найдены</div>}
          </div>}

          {contentTab === 3 && isRailwayShipping && <div className="form-section railway-details">
            {order.railwayCarriages.length > 0 && <div className="shipping-railway-list">{order.railwayCarriages.map((carriage, index) => <article className="shipping-railway-card view-shipping-railway-card" key={carriage.railwayCarriageId}>
              <div className="shipping-railway-card-head"><strong>Вагон {index + 1}</strong><span className="railway-carriage-code">{carriage.railwayCarriageCode}</span><span className="railway-container-count">{carriage.containers.length} КТК</span></div>
              {containerTable(carriage.containers,carriage.railwayCarriageId)}
            </article>)}</div>}
            {order.containers.length > 0 && <div className="quantity-section"><h3>Номерные КТК</h3>{containerTable(order.containers)}</div>}
            
            {order.railwayCarriages.every((carriage) => carriage.containers.length === 0) && order.containers.length === 0 && <div className="inline-empty">КТК не найдены</div>}
          </div>}

          {contentTab === 4 && isRailwayShipping && <div className="form-section railway-details">
            {railwayCargoContainers.length > 0 && <div className="view-data-table"><div className="view-data-header view-railway-cargo-grid"><span>Вагон</span><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>{railwayCargoContainers.map(({ carriage, container }) => <div className="view-data-row view-railway-cargo-grid" key={`${carriage.railwayCarriageId}-${container.containerId}-${container.cargo?.etsngCodeId}`}><strong>{carriage.railwayCarriageCode}</strong><strong>{container.containerName}</strong><span>{container.cargo?.etsngCodeName}</span><span>{container.cargo ? formatWeight(container.cargo.weight) : '—'}</span></div>)}</div>}
            {cargoContainers.length > 0 && <div className="quantity-section"><div className="view-data-table"><div className="view-data-header view-cargo-grid"><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>{cargoContainers.map((container) => <div className="view-data-row view-cargo-grid" key={`${container.containerId}-${container.cargo?.etsngCodeId}`}><strong>{container.containerName}</strong><span>{container.cargo?.etsngCodeName}</span><span>{container.cargo ? formatWeight(container.cargo.weight) : '—'}</span></div>)}</div></div>}
            
            {railwayCargoContainers.length === 0 && cargoContainers.length === 0 && <div className="all-empty-message"><span>✓</span><div><strong>В заявке нет гружёных КТК</strong><p>Данные о грузе отсутствуют.</p></div></div>}
          </div>}

          {contentTab === 3 && !isRailway && cargoContainers.length > 0 && (config.kind === 'receiving' ? <VehicleReceivingCargoTable containers={order.containers} /> : <CargoView containers={cargoContainers} />)}
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
function CargoView({ containers }: { containers: OrderDetails['containers'] }) {
  return <div className="form-section">
    {containers.length === 0 ? <div className="all-empty-message"><span>✓</span><div><strong>В заявке нет гружёных КТК</strong><p>Все выбранные контейнеры порожние.</p></div></div> : <div className="view-data-table"><div className="view-data-header view-cargo-grid"><span>КТК</span><span>Груз</span><span>Масса, кг</span></div>{containers.map((container) => <div className="view-data-row view-cargo-grid" key={container.containerId}><strong>{container.containerName}</strong><span>{container.cargo?.etsngCodeName}</span><span>{container.cargo ? formatWeight(container.cargo.weight) : '—'}</span></div>)}</div>}
  </div>
}


