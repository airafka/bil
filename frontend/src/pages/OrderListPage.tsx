import { ActionIcon } from '../components/ActionIcon'
import { RowActions } from '../components/RowActions'
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
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const navigationState = location.state as NavigationState | null
  const [successCode] = useState(navigationState?.createdCode)

  useEffect(() => {
    let active = true
    getOrders(config.apiPath, page, 20)
      .then((response) => active && setData(response))
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить заявки')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [config.apiPath, page, attempt])

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
        <Link className="primary-button" to={config.createPath}><ActionIcon name="plus" /> Создать</Link>
      </div>

      {successCode && (
        <div className="notice success" role="status">
          <span>✓</span>
          {config.successText} {successCode}
        </div>
      )}

      {error && <div className="notice error" role="alert">{error}<button type="button" className="secondary-button" onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>Повторить</button></div>}

      <div className="table-card" aria-busy={loading}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="registry-index" scope="col">№</th>
                <th>Номер заявки</th>
                <th>Клиент</th>
                <th>Договор</th>
                <th>Заявка на услугу</th>
                <th>Площадка</th>
                <th>Вид транспорта</th>
                {config.kind === 'shipping' && <th>Тип вывоза / наличие данных</th>}
                <th>Статус</th><th className="registry-actions" scope="col" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={config.kind === 'shipping' ? 10 : 9} className="table-message">Загружаем заявки…</td></tr>
              )}
              {!loading && !error && data?.items.length === 0 && (
                <tr>
                  <td colSpan={config.kind === 'shipping' ? 10 : 9} className="empty-state">
                    <span className="empty-icon">◇</span>
                    <strong>Заявок пока нет</strong>
                    <p>Создайте первую заявку с помощью кнопки «Создать».</p>
                  </td>
                </tr>
              )}
              {!loading && data?.items.map((order, index) => (
                <tr key={order.id}>
                  <td className="registry-index">{page * (data?.size ?? 20) + index + 1}</td>
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
                  <td><StatusBadge status={order.status} /></td><td className="registry-actions"><RowActions label={'Действия с заявкой ' + order.code} actions={[{ label: 'Открыть', to: config.listPath + '/' + order.id }]} /></td>
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

