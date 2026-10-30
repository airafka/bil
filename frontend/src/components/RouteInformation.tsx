import { Link } from 'react-router-dom'
import { transportTypeLabel } from '../domain'
import type { RouteSummary } from '../routes'
import { routeTypeLabel } from '../routes'
import { StatusBadge } from './StatusBadge'

const dateTime = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function RouteInformation({ route, linkNumber = false }: { route: RouteSummary; linkNumber?: boolean }) {
  return <div className="route-information">
    <section className="route-information-section" aria-label="Основная информация о рейсе">
      <h2>Основная информация</h2>
      <dl className="route-information-grid">
        <div><dt>Номер рейса:</dt><dd>{linkNumber ? <Link to={'/routes/' + route.id}>{route.code}</Link> : route.code}</dd></div>
        <div><dt>Вид транспорта:</dt><dd>{transportTypeLabel(route.transportType)}</dd></div>
        <div><dt>Тип рейса:</dt><dd>{routeTypeLabel(route.routeType)}</dd></div>
        <div><dt>Дата и время:</dt><dd>{dateTime.format(new Date(route.departureAt))} <span className="route-timezone">UTC+3</span></dd></div>
        <div><dt>Площадка:</dt><dd>{route.terminalAreaName}</dd></div>
        <div><dt>Статус:</dt><dd><StatusBadge status={route.status} /></dd></div>
      </dl>
    </section>
    {route.transportType === 'VEHICLE' && <section className="route-information-section" aria-label="Логистика рейса">
      <h2>Логистика</h2>
      <dl className="route-information-grid">
        <div><dt>Перевозчик / экспедитор:</dt><dd>{route.carrier || '—'}</dd></div>
        <div><dt>Номер ТС:</dt><dd>{route.vehicleNumber || '—'}</dd></div>
        <div><dt>ФИО водителя — экспедитора:</dt><dd>{route.driverName || '—'}</dd></div>
      </dl>
    </section>}
    <section className="route-information-section" aria-label="Дополнительная информация о рейсе">
      <h2>Дополнительно</h2>
      <dl className="route-information-grid"><div className="route-information-wide"><dt>Комментарий:</dt><dd>{route.comment || '—'}</dd></div></dl>
    </section>
  </div>
}
