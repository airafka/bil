import { RecordRow } from '../components/RecordRow'
import { Notification } from '../components/Notification'
import { ActionIcon } from '../components/ActionIcon'
import { RowActions } from '../components/RowActions'
import { StatusBadge } from '../components/StatusBadge'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getOrders } from '../api'
import type { OrderConfig, PagedResponse, OrderSummary } from '../domain'
import { transportTypeLabel } from '../domain'

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
    <section className="registry-page transport-order-page">
      <div className="page-header">
        <h1>{config.title}</h1>
        <Link className="primary-button" to={config.createPath}><ActionIcon name="plus" /> Создать</Link>
      </div>

      {successCode && (
        <Notification kind="success">

          {config.successText} {successCode}
        </Notification>
      )}

      {error && <Notification kind="error">{error}<button type="button" className="secondary-button" onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>Повторить</button></Notification>}

      <div className="table-card" aria-busy={loading}>
        <div className="table-wrap">
          <table className="transport-order-registry" data-responsive-min-width={1180}>
            <colgroup>
              {[44, 105, 200, 165, 205, 120, 80, 80, 130, 120, 44].map((width, index) => <col key={index} style={{ width }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className="registry-index" scope="col">№</th>
                <th>Номер заявки</th>
                <th>Клиент</th>
                <th>Дата и время</th>
                <th>Площадка</th>
                <th>Вид транспорта</th>
                <th>Рейс</th>
                <th>Услуга</th>
                <th>Комментарий</th>
                <th>Статус</th><th className="registry-actions" scope="col" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={11} className="table-message">Загружаем заявки…</td></tr>
              )}
              {!loading && !error && data?.items.length === 0 && (
                <tr>
                  <td colSpan={11} className="empty-state">
                    <span className="empty-icon">◇</span>
                    <strong>Заявок пока нет</strong>
                    <p>Создайте первую заявку с помощью кнопки «Создать».</p>
                  </td>
                </tr>
              )}
              {!loading && data?.items.map((order, index) => (
                <RecordRow to={`${config.listPath}/${order.id}`} key={order.id}>
                  <td className="registry-index">{page * (data?.size ?? 20) + index + 1}</td>
                  <td>
                    <Link className="order-code" to={`${config.listPath}/${order.id}`}>
                      {order.code}
                    </Link>
                  </td>
                  <td>{order.clientName}</td>
                  <td className="transport-order-date">{order.plannedAt ? new Date(order.plannedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td>{order.terminalArea?.name ?? '—'}</td>
                  <td>{transportTypeLabel(order.transportType)}</td>
                  <td>{order.routeId && order.routeNumber != null ? <Link to={'/routes/' + order.routeId}>{order.routeNumber}</Link> : '—'}</td>
                  <td>{order.comprehensiveServiceOrderId && order.comprehensiveServiceOrderNumber != null ? <Link to={'/comprehensive-service-orders/' + order.comprehensiveServiceOrderId}>{order.comprehensiveServiceOrderNumber}</Link> : '—'}</td>
                  <td className="transport-order-comment" title={order.comment || undefined}>{order.comment || '—'}</td>
                  <td><StatusBadge status={order.status} /></td><td className="registry-actions"><RowActions label={'Действия с заявкой ' + order.code} actions={[{ label: 'Открыть', to: config.listPath + '/' + order.id }]} /></td>
                </RecordRow>
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

