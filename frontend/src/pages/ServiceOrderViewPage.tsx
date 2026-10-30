import { OrderRouteCell } from '../components/OrderRouteCell'
import { ServiceProgressCards } from '../components/ServiceProgressCards'
import { StatusBadge } from '../components/StatusBadge'
import { BillingCharges } from './BillingChargesPage'
import { OrderStatusAction } from '../components/OrderStatusAction'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createServiceShippingOrder, createServiceReturns, getServiceOrder } from '../api'
import { UiInput } from '../components/FormControls'
import type { ServiceOrderDetails } from '../serviceOrder'
import { transportTypeLabel } from '../domain'

function cargoLabel(value: string) {
  const match = value.match(/^(.+?)\s+[—–-]\s+(.+)$/)
  return match ? `${match[2]} (${match[1]})` : value
}

const serviceTabs = [
  { id: 'main', label: 'Основное' },
  { id: 'receiving', label: 'Заявки на поставку' },
  { id: 'shipping', label: 'Заявки на вывоз' },
  { id: 'returns', label: 'Возвратные заявки' },
] as const
type ServiceTab = typeof serviceTabs[number]['id']

export function ServiceOrderViewPage() {
  const { serviceOrderId = '' } = useParams()
  return <ServiceOrderDashboard key={serviceOrderId} serviceOrderId={serviceOrderId} />
}

function ServiceOrderDashboard({ serviceOrderId }: { serviceOrderId: string }) {
  const [activeTab, setActiveTab] = useState<ServiceTab>('main')
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([])
  const [data, setData] = useState<ServiceOrderDetails | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selectedContainerIds, setSelectedContainerIds] = useState<string[]>([])
  const [creatingShipping, setCreatingShipping] = useState(false)
  const [shippingError, setShippingError] = useState('')
  const [selectingReturns, setSelectingReturns] = useState(false)
  const [selectedShippingIds, setSelectedShippingIds] = useState<string[]>([])
  const [savingReturns, setSavingReturns] = useState(false)
  const [returnError, setReturnError] = useState('')
  const [returnNotice, setReturnNotice] = useState('')
  const returnLock = useRef(false)
  async function createSelectedReturns() {
    if (returnLock.current || !selectedShippingIds.length) return
    returnLock.current = true; setSavingReturns(true); setReturnError(''); setReturnNotice('')
    try {
      const results = await createServiceReturns(serviceOrderId, selectedShippingIds)
      setReturnNotice('Возвратные поставки оформлены: ' + results.map(item => item.code).join(', '))
      setSelectingReturns(false); setSelectedShippingIds([])
      try { setData(await getServiceOrder(serviceOrderId)) }
      catch { setError('Возвраты оформлены, но список не обновился. Нажмите «Попробовать снова».') }
    } catch (cause) { setReturnError(cause instanceof Error ? cause.message : 'Не удалось создать возвраты') }
    finally { returnLock.current = false; setSavingReturns(false) }
  }

  useEffect(() => {
    let active = true
    getServiceOrder(serviceOrderId).then(value => { if (active) setData(value) })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Не удалось загрузить заявку') })
    return () => { active = false }
  }, [serviceOrderId, attempt])

  function toggleContainer(id: string) {
    setSelectedContainerIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : current.length < 2 ? [...current, id] : current)
  }

  async function createSelectedShippingOrder() {
    if (selectedContainerIds.length < 1 || selectedContainerIds.length > 2) return
    setCreatingShipping(true)
    setShippingError('')
    try {
      const updated = await createServiceShippingOrder(serviceOrderId, selectedContainerIds)
      setData(updated)
      setSelectedContainerIds([])
    } catch (cause) { setShippingError(cause instanceof Error ? cause.message : 'Не удалось создать заявку на вывоз') }
    finally { setCreatingShipping(false) }
  }

  const removals = data?.shippingOrders ?? []
  const receiving = data?.receivingOrder
  const waybills = receiving?.waybills ?? []
  const containerCount = new Set(waybills.flatMap(bill => bill.railwayCarriages.flatMap(carriage => carriage.containers.map(container => container.containerId)))).size
  const cargo = [...new Set(waybills.flatMap(bill => bill.products.map(product => cargoLabel(product.etsngCode))))]

  return <section className="form-page service-dashboard">
    <Link className="service-back" to="/service-orders"><span aria-hidden="true">←</span> Заявки на услугу</Link>
    <header className="service-header"><div className="view-title"><h1>Заявка на услугу{data ? ` ${data.order.code}` : ''}</h1></div><div className="service-header-actions">{data && <OrderStatusAction apiPath="/api/service-orders" id={data.order.id} status={data.order.status} onChanged={status => setData(value => value ? { ...value, order: { ...value.order, status } } : value)} />}</div></header>
    {error && <div className="service-error"><div className="notice error" role="alert">{error}</div><button className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Попробовать снова</button></div>}
    {!data && !error && <div className="service-loading" role="status" aria-label="Загружаем заявку"><span>Загружаем заявку…</span><div /><div /><div /></div>}
    {data && receiving && <>
      <div className="stepper view-tabs service-tabs" role="tablist" aria-label="Разделы заявки на услугу">
        {serviceTabs.map((tab, index) => <button
          key={tab.id}
          ref={element => { tabButtons.current[index] = element }}
          type="button"
          role="tab"
          id={`service-tab-${tab.id}`}
          aria-controls={`service-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={`step ${activeTab === tab.id ? 'current' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          onKeyDown={event => {
            let nextIndex: number
            if (event.key === 'ArrowRight') nextIndex = (index + 1) % serviceTabs.length
            else if (event.key === 'ArrowLeft') nextIndex = (index + serviceTabs.length - 1) % serviceTabs.length
            else if (event.key === 'Home') nextIndex = 0
            else if (event.key === 'End') nextIndex = serviceTabs.length - 1
            else return
            event.preventDefault()
            setActiveTab(serviceTabs[nextIndex].id)
            tabButtons.current[nextIndex]?.focus()
          }}
        >{tab.label}</button>)}
      </div>
      <div id="service-panel-main" role="tabpanel" aria-labelledby="service-tab-main" tabIndex={0} hidden={activeTab !== 'main'}>
      <section className="service-main-panel" aria-labelledby="service-main-title">
        <h2 id="service-main-title">Основная информация</h2>
        <dl className="details-grid">
          <div><dt>Клиент</dt><dd>{data.order.clientName}</dd></div>
          <div><dt>Договор</dt><dd>{data.order.contractName}</dd></div>
          <div><dt>Статус</dt><dd><StatusBadge status={data.order.status} /></dd></div>
        </dl>
      </section>
      {data.progress && <ServiceProgressCards progress={data.progress} />}
      <div id="service-charges"><BillingCharges serviceOrderId={serviceOrderId} refreshKey={data.order.status} /></div>
      </div>
      <div id="service-panel-receiving" role="tabpanel" aria-labelledby="service-tab-receiving" tabIndex={0} hidden={activeTab !== 'receiving'}>
      <section className="service-order-section" aria-label="Заявки на поставку">

        <div className="table-wrap service-compact-table service-receiving-table"><table>
          <thead><tr><th scope="col">Номер заявки</th><th scope="col">Количество КТК</th><th scope="col">Груз</th><th scope="col">Площадка</th><th scope="col">Вид транспорта</th><th scope="col">Рейс</th><th scope="col">Статус</th></tr></thead>
          <tbody><tr>
            <td><Link className="order-code" to={`/receiving-orders/${receiving.id}`}>{receiving.code}</Link></td>
            <td>{containerCount}</td>
            <td>{cargo.length ? cargo.map(name => <span className="service-cargo-item" key={name}>{name}</span>) : '—'}</td>
            <td>{receiving.terminalArea?.name ?? '—'}</td>
            <td>{transportTypeLabel(receiving.transportType)}</td>
            <td><OrderRouteCell id={receiving.id} kind="RECEIVING" /></td>
            <td><StatusBadge status={receiving.status} /></td>
          </tr></tbody>
        </table></div>
      </section>
      </div>
      <div id="service-panel-shipping" role="tabpanel" aria-labelledby="service-tab-shipping" tabIndex={0} hidden={activeTab !== 'shipping'}>
      <section className="service-order-section" aria-label="Заявки на вывоз">
        <div className="bulk-return-heading">
          {!selectingReturns && <button type="button" className="secondary-button" disabled={!removals.some(order => !order.returnReceivingOrderId)} onClick={() => { setSelectingReturns(true); setReturnError(''); setReturnNotice('') }}>Создать возвратные заявки</button>}
        </div>
        {selectingReturns && <div className="bulk-return-actions">
          <span>Выбрано: {selectedShippingIds.length}. Все КТК выбранного вывоза вернутся порожними в одной поставке.</span>
          <button type="button" className="secondary-button" disabled={savingReturns} onClick={() => setSelectedShippingIds(removals.filter(order => !order.returnReceivingOrderId).map(order => order.id))}>Выбрать все</button>
          <button type="button" className="secondary-button" disabled={savingReturns} onClick={() => { setSelectingReturns(false); setSelectedShippingIds([]); setReturnError('') }}>Отмена</button>
          <button type="button" className="primary-button" disabled={savingReturns || !selectedShippingIds.length} onClick={createSelectedReturns}>{savingReturns ? 'Создаём…' : 'Создать выбранные возвраты'}</button>
        </div>}
        {returnError && <div className="notice error" role="alert">{returnError}</div>}
        {returnNotice && <div className="notice success" role="status">{returnNotice}</div>}
        <div className="table-wrap service-compact-table"><table>
          <thead><tr>{selectingReturns && <th scope="col">Выбрать</th>}<th scope="col">Номер заявки</th><th scope="col">Номер КТК</th><th scope="col">Рейс</th><th scope="col">Статус</th></tr></thead>
          <tbody>{removals.map(order => <tr key={order.id}>
            {selectingReturns && <td>{order.returnReceivingOrderId ? <Link to={'/receiving-orders/' + order.returnReceivingOrderId}>Возврат оформлен</Link> : <UiInput type="checkbox" aria-label={'Выбрать вывоз ' + order.code} checked={selectedShippingIds.includes(order.id)} disabled={savingReturns} onChange={event => setSelectedShippingIds(current => event.target.checked ? [...current, order.id] : current.filter(id => id !== order.id))} />}</td>}
            <td><Link className="order-code" to={`/shipping-orders/${order.id}`}>{order.code}</Link></td>
            <td>{order.containerNames.map(name => <span className="service-cargo-item" key={name}>{name}</span>)}</td>
            <td><OrderRouteCell id={order.id} kind="SHIPPING" /></td><td><StatusBadge status={order.status} /></td>
          </tr>)}</tbody>
        </table></div>
        {removals.length === 0 && <div className="service-section-empty">Заявок на вывоз пока нет</div>}
        {data.selectableContainers.length > 0 && <div className="service-pending-containers">
          <h3>КТК стандарта 20 без заявки на вывоз</h3>
          <p>Выберите один или два КТК для одной машины.</p>
          <div className="table-wrap service-compact-table"><table><thead><tr><th scope="col">Выбрать</th><th scope="col">Номер КТК</th><th scope="col">Типоразмер</th></tr></thead><tbody>
            {data.selectableContainers.map(container => <tr key={container.containerId}><td><UiInput type="checkbox" aria-label={`Выбрать КТК ${container.containerName}`} checked={selectedContainerIds.includes(container.containerId)} disabled={data.order.status === 'COMPLETED' || (selectedContainerIds.length === 2 && !selectedContainerIds.includes(container.containerId))} onChange={() => toggleContainer(container.containerId)} /></td><td>{container.containerName}</td><td>Стандартный 20</td></tr>)}
          </tbody></table></div>
          {shippingError && <div className="notice error" role="alert">{shippingError}</div>}
          <div className="route-form-actions"><span>{selectedContainerIds.length} из 2 выбрано</span><button type="button" className="primary-button" disabled={creatingShipping || selectedContainerIds.length === 0 || data.order.status === 'COMPLETED'} onClick={createSelectedShippingOrder}>{creatingShipping ? 'Создаём…' : 'Создать заявку на вывоз'}</button></div>
        </div>}
      </section>
      </div>
      <div id="service-panel-returns" role="tabpanel" aria-labelledby="service-tab-returns" tabIndex={0} hidden={activeTab !== 'returns'}>
      <section className="service-order-section" aria-label="Возвратные заявки">

        {data.returnOrders.length ? <div className="table-wrap service-compact-table"><table><thead><tr><th>Номер заявки</th><th>КТК</th><th>Рейс</th><th>Статус</th></tr></thead><tbody>{data.returnOrders.map(item => <tr key={item.id}><td><Link className="order-code" to={`/receiving-orders/${item.id}`}>{item.code}</Link></td><td>{item.containerNames.join(', ')}</td><td><OrderRouteCell id={item.id} kind="RECEIVING" /></td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div> : <div className="service-section-empty">Возвратных поставок пока нет</div>}
      </section>
      </div>
    </>}
  </section>
}

