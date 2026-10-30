import { ActionIcon } from '../components/ActionIcon'
import { RowActions } from '../components/RowActions'
import { StatusBadge } from '../components/StatusBadge'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getServiceOrders } from '../api'
import type { PagedResponse } from '../domain'
import type { ServiceOrderSummary } from '../serviceOrder'


export function ServiceOrderRegistryPage() {
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<PagedResponse<ServiceOrderSummary> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getServiceOrders(page).then(value => { if (active) setData(value) })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Не удалось загрузить заявки') })
    return () => { active = false }
  }, [page, attempt])
  return <section className="registry-page">
    <div className="page-header"><h1>Заявки на услугу</h1><Link className="primary-button" to="/service-orders/new"><ActionIcon name="plus" /> Создать</Link></div>
    {error && <div className="notice error" role="alert">{error}<button type="button" className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Повторить</button></div>}
    <div className="table-card" aria-busy={!data && !error}>
      <div className="table-wrap"><table><thead><tr><th className="registry-index" scope="col">№</th><th>Номер заявки</th><th>Клиент</th><th>Договор</th><th>Статус</th><th className="registry-actions" scope="col" aria-label="Действия" /></tr></thead><tbody>
        {!data && !error && <tr><td colSpan={6} className="table-message">Загружаем заявки…</td></tr>}
        {data?.items.length === 0 && <tr><td colSpan={6} className="empty-state"><strong>Заявок пока нет</strong><p>Создайте заявку, выбрав клиента, договор и накладные.</p></td></tr>}
        {data?.items.map((order, index) => <tr key={order.id}><td className="registry-index">{page * (data?.size ?? 20) + index + 1}</td><td><Link className="order-code" to={`/service-orders/${order.id}`}>{order.code}</Link></td><td>{order.clientName}</td><td>{order.contractName}</td><td><StatusBadge status={order.status} /></td><td className="registry-actions"><RowActions label={'Действия с заявкой ' + order.code} actions={[{ label: 'Открыть', to: '/service-orders/' + order.id }]} /></td></tr>)}
      </tbody></table></div>
      {data && data.totalPages > 1 && <div className="pagination"><button disabled={page === 0} onClick={() => { setData(null); setPage(page - 1) }}>Назад</button><span>Страница {page + 1} из {data.totalPages}</span><button disabled={page + 1 >= data.totalPages} onClick={() => { setData(null); setPage(page + 1) }}>Далее</button></div>}
    </div>
  </section>
}

