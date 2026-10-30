import { ActionIcon } from '../components/ActionIcon'
import { RowActions } from '../components/RowActions'
import { WaybillCompositionTable } from '../components/WaybillCompositionTable'
import { Fragment, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getGroupedWaybills } from '../api'
import type { GroupedWaybillPage } from '../domain'
import { getWaybillStationName } from '../waybillOptions'

type NavigationState = { createdNumber?: string }

export function WaybillRegistryPage() {
  const [data, setData] = useState<GroupedWaybillPage | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const location = useLocation()
  const navigate = useNavigate()
  const navigationState = location.state as NavigationState | null
  const [createdNumber] = useState(navigationState?.createdNumber)

  useEffect(() => {
    let active = true
    getGroupedWaybills({}, page)
      .then((response) => active && setData(response))
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить накладные')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [page])

  useEffect(() => {
    if (navigationState?.createdNumber) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, navigationState?.createdNumber])

  const changePage = (nextPage: number) => {
    setLoading(true)
    setError('')
    setPage(nextPage)
  }

  const toggleGroup = (groupKey: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  return (
    <section className="registry-page">
      <div className="page-header">
        <h1>Накладные</h1>
        <Link className="primary-button" to="/waybills/create"><ActionIcon name="plus" /> Создать</Link>
      </div>

      {createdNumber && <div className="notice success" role="status"><span>✓</span>Накладная {createdNumber} создана</div>}
      {error && <div className="notice error" role="alert">{error}</div>}

      <div className="table-card waybill-registry-card">
        <div className="table-wrap">
          <table className="waybill-registry-table">
            <thead><tr><th className="registry-index" scope="col">№</th><th>Станция отправления</th><th>Станция назначения</th><th>Плательщик</th><th>Груз</th><th>Вагонов</th><th>КТК</th><th>Накладных</th><th className="registry-actions" scope="col" aria-label="Действия" /></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="table-message">Загружаем накладные…</td></tr>}
              {!loading && data?.content.length === 0 && <tr><td colSpan={9} className="empty-state"><span className="empty-icon">◇</span><strong>Накладных пока нет</strong><p>Создайте накладную с помощью кнопки «Создать».</p></td></tr>}
              {!loading && data?.content.map((group, index) => {
                const isExpanded = expanded.has(group.groupKey)
                const firstProduct = group.products[0]
                return (
                  <Fragment key={group.groupKey}>
                    <tr className={isExpanded ? 'expanded-group' : ''}>
                      <td className="registry-index">{page * (data?.size ?? 20) + index + 1}</td>
                      <td><button className="expand-button" onClick={() => toggleGroup(group.groupKey)} aria-expanded={isExpanded}><svg className="composition-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>{getWaybillStationName(group.departureStation)}</button></td>
                      <td>{getWaybillStationName(group.destinationStation)}</td><td>{group.payer}</td>
                      <td className="product-preview">{firstProduct ? `${firstProduct.code} ${firstProduct.name}` : '—'}{group.products.length > 1 && <small> +{group.products.length - 1}</small>}</td>
                      <td>{group.railwayCarriageCount}</td><td>{group.containerCount}</td><td>{group.waybillCount}</td><td className="registry-actions"><RowActions label={'Действия с группой накладных ' + (index + 1)} actions={[{ label: isExpanded ? 'Свернуть' : 'Открыть', onClick: () => toggleGroup(group.groupKey) }]} /></td>
                    </tr>
                    {isExpanded && (
                      <tr className="waybill-expanded-row">
                        <td colSpan={9}>
                          <div className="expanded-content">
                            <div className="expanded-block"><strong>Накладные</strong><div className="waybill-chip-grid">{group.waybills.map((waybill) => <span className="waybill-chip" key={waybill.id}>{waybill.number}</span>)}</div></div>
                            <div className="expanded-block"><strong>КТК</strong><div className="table-wrap"><table><thead><tr><th>Накладная</th><th>КТК</th><th>Брутто</th><th>Тара</th><th>Груз</th><th>Собственник КТК</th><th>Номера ЗПУ</th><th>Тип ЗПУ</th></tr></thead><tbody>{group.waybills.flatMap(waybill => (waybill.containers ?? []).map(container => <tr key={waybill.id + container.containerId}><td>{waybill.number}</td><td>{container.number}</td><td>{container.grossWeight.toLocaleString('ru-RU')}</td><td>{container.tareWeight.toLocaleString('ru-RU')}</td><td>{container.netWeight.toLocaleString('ru-RU')}</td><td>{container.ownerClientName || '—'}</td><td>{container.sealNumbers || '—'}</td><td>{container.sealTypeName || '—'}</td></tr>))}</tbody></table></div></div>
                            <WaybillCompositionTable waybills={group.waybills.map(bill => ({ ...bill, departureStation: group.departureStation, destinationStation: group.destinationStation }))} tab="cargo" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {(data?.totalPages ?? 0) > 1 && <div className="pagination"><button disabled={page === 0} onClick={() => changePage(page - 1)}>Назад</button><span>Страница {page + 1} из {data?.totalPages}</span><button disabled={page + 1 >= (data?.totalPages ?? 0)} onClick={() => changePage(page + 1)}>Далее</button></div>}
      </div>
    </section>
  )
}

