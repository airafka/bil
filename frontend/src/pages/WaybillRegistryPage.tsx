import { UiInput } from '../components/FormControls'
import { Fragment, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getGroupedWaybills } from '../api'
import type { GroupedWaybillFilter, GroupedWaybillPage } from '../domain'
import { getWaybillStationName } from '../waybillOptions'

type NavigationState = { createdNumber?: string }

export function WaybillRegistryPage() {
  const [departureStation, setDepartureStation] = useState('')
  const [destinationStation, setDestinationStation] = useState('')
  const [payer, setPayer] = useState('')
  const [filter, setFilter] = useState<GroupedWaybillFilter>({})
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
    getGroupedWaybills(filter, page)
      .then((response) => active && setData(response))
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить накладные')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [filter, page])

  useEffect(() => {
    if (navigationState?.createdNumber) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, navigationState?.createdNumber])

  const applyFilters = () => {
    setLoading(true)
    setError('')
    setPage(0)
    setFilter({
      departureStation: departureStation ? Number(departureStation) : undefined,
      destinationStation: destinationStation ? Number(destinationStation) : undefined,
      payer: payer.trim() || undefined,
    })
  }

  const resetFilters = () => {
    setDepartureStation('')
    setDestinationStation('')
    setPayer('')
    setError('')
    setLoading(true)
    setPage(0)
    setFilter({})
  }

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
        <Link className="primary-button" to="/waybills/create"><span>+</span> Создать накладную</Link>
      </div>

      {createdNumber && <div className="notice success" role="status"><span>✓</span>Накладная {createdNumber} создана</div>}
      {error && <div className="notice error" role="alert">{error}</div>}

      <form className="registry-filters" onSubmit={event => { event.preventDefault(); applyFilters() }}>
        <label className="field"><span>Станция отправления</span><UiInput type="number" step="1" value={departureStation} onChange={(event) => setDepartureStation(event.target.value)} /></label>
        <label className="field"><span>Станция назначения</span><UiInput type="number" step="1" value={destinationStation} onChange={(event) => setDestinationStation(event.target.value)} /></label>
        <label className="field"><span>Плательщик</span><UiInput value={payer} onChange={(event) => setPayer(event.target.value)} /></label>
        <div className="filter-actions"><button className="primary-button" type="submit">Найти</button><button type="button" className="secondary-button" onClick={resetFilters}>Сбросить</button></div>
      </form>

      <div className="table-card waybill-registry-card">
        <div className="table-toolbar"><strong>Агрегированный реестр</strong><span>{data?.totalElements ?? 0} групп</span></div>
        <div className="table-wrap">
          <table className="waybill-registry-table">
            <thead><tr><th>Станция отправления</th><th>Станция назначения</th><th>Плательщик</th><th>Груз</th><th>Вагонов</th><th>КТК</th><th>Накладных</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="table-message">Загружаем накладные…</td></tr>}
              {!loading && data?.content.length === 0 && <tr><td colSpan={7} className="empty-state"><span className="empty-icon">◇</span><strong>{Object.values(filter).some(Boolean) ? 'Накладные не найдены' : 'Накладных пока нет'}</strong><p>Измените фильтры или создайте накладную.</p></td></tr>}
              {!loading && data?.content.map((group) => {
                const isExpanded = expanded.has(group.groupKey)
                const firstProduct = group.products[0]
                return (
                  <Fragment key={group.groupKey}>
                    <tr className={isExpanded ? 'expanded-group' : ''}>
                      <td><button className="expand-button" onClick={() => toggleGroup(group.groupKey)} aria-expanded={isExpanded}><span>{isExpanded ? '⌄' : '›'}</span>{getWaybillStationName(group.departureStation)}</button></td>
                      <td>{getWaybillStationName(group.destinationStation)}</td><td>{group.payer}</td>
                      <td className="product-preview">{firstProduct ? `${firstProduct.code} ${firstProduct.name}` : '—'}{group.products.length > 1 && <small> +{group.products.length - 1}</small>}</td>
                      <td>{group.railwayCarriageCount}</td><td>{group.containerCount}</td><td>{group.waybillCount}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="waybill-expanded-row">
                        <td colSpan={7}>
                          <div className="expanded-content">
                            <div className="expanded-block"><strong>Накладные</strong><div className="waybill-chip-grid">{group.waybills.map((waybill) => <span className="waybill-chip" key={waybill.id}>{waybill.number}</span>)}</div></div>
                            <div className="expanded-block"><strong>Массы КТК, кг</strong><div className="table-wrap"><table><thead><tr><th>Накладная</th><th>КТК</th><th>Брутто</th><th>Тара</th><th>Груз</th></tr></thead><tbody>{group.waybills.flatMap(waybill => (waybill.containers ?? []).map(container => <tr key={waybill.id + container.containerId}><td>{waybill.number}</td><td>{container.number}</td><td>{container.grossWeight.toLocaleString('ru-RU')}</td><td>{container.tareWeight.toLocaleString('ru-RU')}</td><td>{container.netWeight.toLocaleString('ru-RU')}</td></tr>))}</tbody></table></div></div>
                            <div className="expanded-block"><strong>Грузы</strong>{group.products.length === 0 ? <span className="expanded-empty">Нет грузов</span> : <div className="expanded-products">{group.products.map((product) => <span key={product.id}>{product.code} {product.name}{product.weight != null ? ` — ${product.weight.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг` : ''}</span>)}</div>}</div>
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

