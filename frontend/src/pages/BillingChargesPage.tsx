import { Notification } from '../components/Notification'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { getBillingCharges } from '../api'
import type { BillingChargePage } from '../billing'

const money = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function BillingCharges({ comprehensiveServiceOrderId, refreshKey = '', totalsTarget }: { comprehensiveServiceOrderId?: string; refreshKey?: string; totalsTarget?: HTMLElement | null }) {
  const [data, setData] = useState<BillingChargePage | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getBillingCharges(comprehensiveServiceOrderId, page).then(value => { if (active) { setData(value); setError('') } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить начисления') })
    return () => { active = false }
  }, [comprehensiveServiceOrderId, page, refreshKey, attempt])
  const errorNotification = error ? <Notification kind="error">{error}<button className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Повторить</button></Notification> : null


  const totals = data ? <dl className="service-charge-totals"><div><dt>Начислено без НДС, ₽</dt><dd>{money(data.totalWithoutVat)}</dd></div><div><dt>Начислено с НДС, ₽</dt><dd>{money(data.totalWithVat)}</dd></div></dl> : null

  return <section id={comprehensiveServiceOrderId ? 'service-charges' : undefined} className="service-order-section billing-charges-panel">

    {errorNotification}
    {!data && !error && <p>Загружаем начисления…</p>}
    {data && <>
      {totalsTarget ? createPortal(totals, totalsTarget) : totals}
      {data.items.length ? <div className="table-wrap service-compact-table"><table className={comprehensiveServiceOrderId ? 'service-charge-table' : 'billing-charge-registry-table'} data-responsive-min-width={comprehensiveServiceOrderId ? 800 : 1100}>
        <colgroup>{(comprehensiveServiceOrderId ? [44, 115, 145, 440, 125, 125] : [110, 170, 100, 110, 135, 400, 115, 115]).map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
        <thead><tr>
          {comprehensiveServiceOrderId && <th scope="col" className="composition-index">№</th>}
          <th scope="col">Дата оказания</th>
          {!comprehensiveServiceOrderId && <><th scope="col">Клиент</th><th scope="col">Договор</th><th scope="col">Заявка на услугу</th></>}
          <th scope="col">КТК</th><th scope="col">Услуга</th><th scope="col">Без НДС, ₽</th><th scope="col">С НДС, ₽</th>
        </tr></thead>
        <tbody>{data.items.map((item, index) => <tr key={item.id}>
          {comprehensiveServiceOrderId && <td className="composition-index">{data.page * data.size + index + 1}</td>}
          <td>{new Date(item.performedAt).toLocaleDateString('ru-RU')}</td>
          {!comprehensiveServiceOrderId && <><td>{item.clientName}</td><td>{item.contractName}</td><td><Link to={`/comprehensive-service-orders/${item.comprehensiveServiceOrderId}`}>{item.comprehensiveServiceOrderCode}</Link></td></>}
          <td>{item.containerName}</td><td>{item.serviceName}</td><td>{money(item.amountWithoutVat)}</td><td>{money(item.amountWithVat)}</td>
        </tr>)}</tbody>
      </table></div> : <div className="service-section-empty">Начислений пока нет</div>}
      {data.total > data.size && <div className="pagination"><button disabled={page === 0} onClick={() => { setData(null); setError(''); setPage(value => value - 1) }}>Назад</button><span>Страница {page + 1} из {Math.ceil(data.total / data.size)}</span><button disabled={(page + 1) * data.size >= data.total} onClick={() => { setData(null); setError(''); setPage(value => value + 1) }}>Далее</button></div>}
    </>}
  </section>
}

export function BillingChargesPage() {
  return <section className="form-page service-dashboard"><div className="page-header"><h1>Оказанные услуги</h1></div><BillingCharges /></section>
}


