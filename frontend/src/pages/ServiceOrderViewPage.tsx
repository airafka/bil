import { StatusBadge } from '../components/StatusBadge'
import { BillingCharges } from './BillingChargesPage'
import { OrderStatusAction } from '../components/OrderStatusAction'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createServiceShippingOrder, getRoute, getServiceOrder } from '../api'
import { UiInput } from '../components/FormControls'
import type { ServiceOrderDetails } from '../serviceOrder'
import { transportTypeLabel } from '../domain'

function cargoLabel(value: string) {
  const match = value.match(/^(.+?)\s+[—–-]\s+(.+)$/)
  return match ? `${match[2]} (${match[1]})` : value
}

export function ServiceOrderViewPage() {
  const { serviceOrderId = '' } = useParams()
  return <ServiceOrderDashboard key={serviceOrderId} serviceOrderId={serviceOrderId} />
}

function ServiceOrderDashboard({ serviceOrderId }: { serviceOrderId: string }) {
  const [data, setData] = useState<ServiceOrderDetails | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [receivingRouteCode, setReceivingRouteCode] = useState<number | null>(null)
  const [selectedContainerIds, setSelectedContainerIds] = useState<string[]>([])
  const [creatingShipping, setCreatingShipping] = useState(false)
  const [shippingError, setShippingError] = useState('')

  useEffect(() => {
    let active = true
    getServiceOrder(serviceOrderId).then(value => { if (active) setData(value) })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Не удалось загрузить заявку') })
    return () => { active = false }
  }, [serviceOrderId, attempt])

  const receivingRouteId = data?.receivingOrder.routeId
  useEffect(() => {
    if (!receivingRouteId) return
    let active = true
    getRoute(receivingRouteId).then(result => { if (active) setReceivingRouteCode(result.route.code) })
      .catch(() => { if (active) setReceivingRouteCode(null) })
    return () => { active = false }
  }, [receivingRouteId])

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
    <header className="service-header"><div className="view-title"><h1>Заявка на услугу{data ? ` ${data.order.code}` : ''}</h1></div><div className="service-header-actions"><span className="service-terminal">Контейнерная площадка</span>{data && <OrderStatusAction apiPath="/api/service-orders" id={data.order.id} status={data.order.status} onChanged={status => setData(value => value ? { ...value, order: { ...value.order, status } } : value)} />}</div></header>
    {error && <div className="service-error"><div className="notice error" role="alert">{error}</div><button className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Попробовать снова</button></div>}
    {!data && !error && <div className="service-loading" role="status" aria-label="Загружаем заявку"><span>Загружаем заявку…</span><div /><div /><div /></div>}
    {data && receiving && <>
      <nav className="section-shortcuts" aria-label="Разделы заявки на услугу"><a href="#service-main-title">Основное</a><a href="#service-receiving-title">Поставка</a><a href="#service-shipping-title">Вывозы · {removals.length}</a><a href="#service-returns-title">Возвраты · {data.returnOrders.length}</a><a href="#service-charges">Начисления</a></nav>
      <section className="service-main-panel" aria-labelledby="service-main-title">
        <h2 id="service-main-title">Основная информация</h2>
        <dl className="details-grid">
          <div><dt>Клиент</dt><dd>{data.order.clientName}</dd></div>
          <div><dt>Договор</dt><dd>{data.order.contractName}</dd></div>
          <div><dt>Статус</dt><dd><StatusBadge status={data.order.status} /></dd></div>
        </dl>
      </section>
      <section className="service-order-section" aria-labelledby="service-receiving-title">
        <h2 id="service-receiving-title">Заявки на поставку</h2>
        <div className="table-wrap service-compact-table service-receiving-table"><table>
          <thead><tr><th scope="col">Номер заявки</th><th scope="col">Количество КТК</th><th scope="col">Груз</th><th scope="col">Площадка</th><th scope="col">Вид транспорта</th><th scope="col">Рейс</th><th scope="col">Статус</th></tr></thead>
          <tbody><tr>
            <td><Link className="order-code" to={`/receiving-orders/${receiving.id}`}>{receiving.code}</Link></td>
            <td>{containerCount}</td>
            <td>{cargo.length ? cargo.map(name => <span className="service-cargo-item" key={name}>{name}</span>) : '—'}</td>
            <td>{receiving.terminalArea?.name ?? '—'}</td>
            <td>{transportTypeLabel(receiving.transportType)}</td>
            <td>{receiving.routeId ? <Link className="order-code" to={'/routes/' + receiving.routeId}>{receivingRouteCode ?? 'Открыть рейс'}</Link> : '—'}</td>
            <td><StatusBadge status={receiving.status} /></td>
          </tr></tbody>
        </table></div>
      </section>
      <section className="service-order-section" aria-labelledby="service-shipping-title">
        <h2 id="service-shipping-title">Заявки на вывоз</h2>
        <div className="table-wrap service-compact-table"><table>
          <thead><tr><th scope="col">Номер заявки</th><th scope="col">Номер КТК</th><th scope="col">Статус</th></tr></thead>
          <tbody>{removals.map(order => <tr key={order.id}>
            <td><Link className="order-code" to={`/shipping-orders/${order.id}`}>{order.code}</Link></td>
            <td>{order.containerNames.map(name => <span className="service-cargo-item" key={name}>{name}</span>)}</td>
            <td><StatusBadge status={order.status} /></td>
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
      <section className="service-order-section" aria-labelledby="service-returns-title">
        <h2 id="service-returns-title">Возвратные поставки</h2>
        {data.returnOrders.length ? <div className="table-wrap service-compact-table"><table><thead><tr><th>Номер заявки</th><th>КТК</th><th>Статус</th></tr></thead><tbody>{data.returnOrders.map(item => <tr key={item.id}><td><Link className="order-code" to={`/receiving-orders/${item.id}`}>{item.code}</Link></td><td>{item.containerNames.join(', ')}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div> : <div className="service-section-empty">Возвратных поставок пока нет</div>}
      </section>
      <div id="service-charges"><BillingCharges serviceOrderId={serviceOrderId} refreshKey={data.order.status} /></div>
    </>}
  </section>
}

