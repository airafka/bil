import { Notification } from '../components/Notification'
import { ContainerStatusBadge } from '../components/ContainerStatusBadge'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getContainerStock, getOwnerHistory } from '../api'
import { historyOrderPath, type OwnerHistory, type StockOwner } from '../containerStock'
import { containerTypeLabel, type PagedResponse } from '../domain'

export function ContainerStockPage() {
  const [data, setData] = useState<PagedResponse<StockOwner> | null>(null)
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getContainerStock('', '', '', page).then(v => { if (active) { setData(v); setError('') } }).catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)) })
    return () => { active = false }
  }, [page])
  return <section className="registry-page">
    <div className="page-header"><h1>Остатки и собственники КТК</h1></div>
    <p className="composition-hint">В физических остатках учитываются КТК со статусами «В остатках» и «Ожидает вывоза». Ожидаемые поставки и КТК вне остатков показаны отдельно по статусу.</p>
    {error && <Notification kind="error">{error}</Notification>}
    <div className="table-card"><div className="table-wrap"><table><thead><tr><th>Номер КТК</th><th>Тип</th><th>Собственник</th><th>Состояние</th><th>История</th></tr></thead><tbody>
      {!data && !error && <tr><td colSpan={5}>Загружаем остатки…</td></tr>}
      {data?.items.length === 0 && <tr><td colSpan={5}>КТК не найдены. Для начала учёта подтвердите поставку и завершите разгрузку.</td></tr>}
      {data?.items.map(row => <tr key={row.id}><td>{row.containerName}</td><td>{containerTypeLabel(row.containerType as Parameters<typeof containerTypeLabel>[0])}</td><td>{row.clientName}</td><td><ContainerStatusBadge status={row.status} /></td><td><Link to={'/container-owners/' + row.containerId + '/history'}>История</Link></td></tr>)}
    </tbody></table></div>{data && data.totalPages > 1 && <div className="pagination"><button disabled={page === 0} onClick={() => { setPage(page - 1); setData(null) }}>Назад</button><span>{page + 1} / {data.totalPages}</span><button disabled={page + 1 >= data.totalPages} onClick={() => { setPage(page + 1); setData(null) }}>Далее</button></div>}</div>
  </section>
}

export function ContainerHistoryPage() {
  const { containerId = '' } = useParams()
  const [rows, setRows] = useState<OwnerHistory[] | null>(null), [error, setError] = useState('')
  useEffect(() => { let active = true; getOwnerHistory(containerId, true).then(v => { if (active) { setRows(v); setError('') } }).catch(e => { if (active) setError(String(e)) }); return () => { active = false } }, [containerId])
  return <section className="registry-page"><div className="page-header"><h1>История КТК</h1><Link className="close-button" to="/container-owners" aria-label="Закрыть" title="Закрыть">×</Link></div>
    {error && <Notification kind="error">{error}</Notification>}
    <div className="table-card"><div className="table-wrap"><table><thead><tr><th>Дата</th><th>Заявка</th><th>Прежний собственник</th><th>Новый собственник</th><th>Прежнее состояние</th><th>Новое состояние</th></tr></thead><tbody>
      {!rows && !error && <tr><td colSpan={6}>Загружаем историю…</td></tr>}{rows?.length === 0 && <tr><td colSpan={6}>Записей истории нет</td></tr>}
      {rows?.map(row => <tr key={row.id}><td>{new Date(row.createdAt + 'Z').toLocaleString('ru-RU')}</td><td><Link to={historyOrderPath(row)}>{row.orderType === 'SERVICE_ORDER' ? 'Смена собственника' : row.orderType === 'RECEIVING_ORDER' ? 'Поставка' : 'Вывоз'} № {row.orderNumber}</Link></td><td>{row.oldClientName || '—'}</td><td>{row.newClientName || '—'}</td><td><ContainerStatusBadge status={row.oldStatus} /></td><td><ContainerStatusBadge status={row.newStatus} /></td></tr>)}
    </tbody></table></div></div></section>
}
