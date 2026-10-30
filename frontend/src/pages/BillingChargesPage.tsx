import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBillingCharges } from '../api'
import type { BillingChargePage } from '../billing'

const money = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function BillingCharges({ serviceOrderId, refreshKey = '' }: { serviceOrderId?: string; refreshKey?: string }) {
  const [data, setData] = useState<BillingChargePage | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getBillingCharges(serviceOrderId, page).then(value => { if (active) { setData(value); setError('') } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить начисления') })
    return () => { active = false }
  }, [serviceOrderId, page, refreshKey, attempt])
  return <section className="service-order-section billing-charges-panel">
    {serviceOrderId && <h2>Начисления</h2>}
    {error && <div className="notice error" role="alert">{error}<button className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Повторить</button></div>}
    {!data && !error && <p>Загружаем начисления…</p>}
    {data && <>
      <dl className="details-grid"><div><dt>Начислено без НДС, ₽</dt><dd>{money(data.totalWithoutVat)}</dd></div><div><dt>Начислено с НДС, ₽</dt><dd>{money(data.totalWithVat)}</dd></div></dl>
      {data.items.length ? <div className="table-wrap service-compact-table"><table>
        <thead><tr>
          <th scope="col">Дата оказания</th>
          {!serviceOrderId && <><th scope="col">Клиент</th><th scope="col">Договор</th><th scope="col">Заявка на услугу</th></>}
          <th scope="col">КТК</th><th scope="col">Услуга</th><th scope="col">Без НДС, ₽</th><th scope="col">С НДС, ₽</th>
        </tr></thead>
        <tbody>{data.items.map(item => <tr key={item.id}>
          <td>{new Date(item.performedAt).toLocaleDateString('ru-RU')}</td>
          {!serviceOrderId && <><td>{item.clientName}</td><td>{item.contractName}</td><td><Link to={`/service-orders/${item.serviceOrderId}`}>{item.serviceOrderCode}</Link></td></>}
          <td>{item.containerName}</td><td>{item.serviceName}</td><td>{money(item.amountWithoutVat)}</td><td>{money(item.amountWithVat)}</td>
        </tr>)}</tbody>
      </table></div> : <div className="service-section-empty">Начислений пока нет</div>}
      {data.total > data.size && <div className="route-form-actions"><button className="secondary-button" disabled={page === 0} onClick={() => { setData(null); setError(''); setPage(value => value - 1) }}>Назад</button><span>{page + 1} / {Math.ceil(data.total / data.size)}</span><button className="secondary-button" disabled={(page + 1) * data.size >= data.total} onClick={() => { setData(null); setError(''); setPage(value => value + 1) }}>Далее</button></div>}
    </>}
  </section>
}

export function BillingChargesPage() {
  return <section className="form-page service-dashboard"><div className="page-header"><h1>Оказанные услуги</h1></div><BillingCharges /></section>
}


