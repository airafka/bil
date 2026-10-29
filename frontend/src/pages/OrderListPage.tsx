import { RegistryTools } from '../components/RegistryTools'
import { StatusBadge } from '../components/StatusBadge'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getOrders } from '../api'
import type { OrderConfig, PagedResponse, OrderSummary } from '../domain'
import { fillingTypeLabel, transportTypeLabel } from '../domain'

type NavigationState = { createdCode?: number }

export function OrderListPage({ config }: { config: OrderConfig }) {
  const [data, setData] = useState<PagedResponse<OrderSummary> | null>(null)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState({ query: '', status: '' })
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const navigationState = location.state as NavigationState | null
  const [successCode] = useState(navigationState?.createdCode)

  useEffect(() => {
    let active = true
    getOrders(config.apiPath, page, 20, filter.query, filter.status)
      .then((response) => active && setData(response))
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить заявки')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [config.apiPath, page, filter, attempt])

  const changePage = (nextPage: number) => {
    setLoading(true)
    setError('')
    setPage(nextPage)
  }

  useEffect(() => {
    if (navigationState?.createdCode) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, navigate, navigationState?.createdCode])

  return (
    <section className="registry-page">
      <div className="page-header">
        <h1>{config.title}</h1>
        <Link className="primary-button" to={config.createPath}><span>+</span> Создать заявку</Link>
      </div>

      {successCode && (
        <div className="notice success" role="status">
          <span>✓</span>
          {config.successText} {successCode}
        </div>
      )}

      {error && <div className="notice error" role="alert">{error}<button type="button" className="secondary-button" onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>Повторить</button></div>}

      <div className="table-card" aria-busy={loading}>
        <RegistryTools busy={loading} onApply={(query, status) => { setPage(0); setLoading(true); setError(''); setFilter({ query, status }) }} />
        <div className="table-toolbar">
          <strong>Реестр заявок</strong>
          <span>{loading ? '…' : data?.totalElements ?? 0} записей</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Номер</th>
                <th>Клиент</th>
                <th>Договор</th>
                <th>Заявка на услугу</th>
                <th>Площадка</th>
                <th>Транспорт</th>
                {config.kind === 'shipping' && <th>Тип вывоза / наличие данных</th>}
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={config.kind === 'shipping' ? 8 : 7} className="table-message">Загружаем заявки…</td></tr>
              )}
              {!loading && !error && data?.items.length === 0 && (
                <tr>
                  <td colSpan={config.kind === 'shipping' ? 8 : 7} className="empty-state">
                    <span className="empty-icon">◇</span>
                    <strong>{filter.query || filter.status ? 'Заявки не найдены' : 'Заявок пока нет'}</strong>
                    <p>{filter.query || filter.status ? 'Измените запрос или сбросьте фильтры.' : 'Создайте первую заявку с помощью кнопки «Создать заявку».'}</p>
                  </td>
                </tr>
              )}
              {!loading && data?.items.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link className="order-code" to={`${config.listPath}/${order.id}`}>
                      {order.code}
                    </Link>
                  </td>
                  <td>{order.clientName}</td><td>{order.contractName ?? '—'}</td><td>{order.serviceOrderId ? <Link to={'/service-orders/' + order.serviceOrderId}>Открыть</Link> : '—'}</td>
                  <td>{order.terminalArea?.name ?? '—'}</td>
                  <td>{transportTypeLabel(order.transportType)}</td>
                  {config.kind === 'shipping' && <td>{order.transportType === 'RAILWAY'
                    ? fillingTypeLabel(order.fillingType)
                    : '—'}</td>}
                  <td><StatusBadge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 0) > 1 && (
          <div className="pagination">
            <button disabled={loading || page === 0} onClick={() => changePage(page - 1)}>Назад</button>
            <span>Страница {page + 1} из {data?.totalPages}</span>
            <button disabled={loading || page + 1 >= (data?.totalPages ?? 0)} onClick={() => changePage(page + 1)}>Далее</button>
          </div>
        )}
      </div>
    </section>
  )
}

