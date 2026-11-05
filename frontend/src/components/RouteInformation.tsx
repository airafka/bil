import { catalogPath } from '../transportCatalogs'
import { Link } from 'react-router-dom'
import { type TransportType, transportTypeLabel } from '../domain'
import type { RouteSummary, RouteType } from '../routes'
import { routeIntervalLabel, routeTypeLabel } from '../routes'
import { StatusBadge } from './StatusBadge'

export function RouteInformation({ route, linkNumber = false, transportType, routeType }: { route?: RouteSummary; linkNumber?: boolean; transportType?: TransportType | null; routeType?: RouteType }) {
  const displayTransport = route?.transportType ?? transportType
  const displayType = route?.routeType ?? routeType
  return <div className="route-information">
    <section className="route-information-section" aria-label="Основная информация о рейсе">
      <h2>Основная информация</h2>
      <dl className="route-information-grid">
        <div><dt>Номер рейса:</dt><dd>{route ? (linkNumber ? <Link to={'/routes/' + route.id}>{route.code}</Link> : route.code) : ''}</dd></div>
        <div><dt>Вид транспорта:</dt><dd>{route ? transportTypeLabel(route.transportType) : ''}</dd></div>
        <div><dt>Тип рейса:</dt><dd>{route ? routeTypeLabel(route.routeType) : ''}</dd></div>
        <div><dt>{displayTransport === 'RAILWAY' ? (displayType === 'RECEIVING' ? 'Дата и время поставки:' : 'Дата и время вывоза:') : 'Дата и время:'}</dt><dd>{route && <>{routeIntervalLabel(route.departureAt)} <span className="route-timezone">UTC+3</span></>}</dd></div>
        <div><dt>Площадка:</dt><dd>{route?.terminalAreaName ?? ''}</dd></div>
        <div><dt>Статус:</dt><dd>{route && <StatusBadge status={route.status} />}</dd></div>
      </dl>
    </section>
    {displayTransport === 'VEHICLE' && <section className="route-information-section" aria-label="Логистика рейса">
      <h2>Логистика</h2>
      <dl className="route-information-grid">
        <div><dt>Перевозчик / экспедитор:</dt><dd>{route ? route.carrier || '—' : ''}</dd></div>
        <div><dt>Номер ТС:</dt><dd>{route ? route.vehicleId && route.vehicleNumber ? <Link to={catalogPath('vehicles') + '/' + route.vehicleId}>{route.vehicleNumber}</Link> : route.vehicleNumber || '—' : ''}</dd></div>
        <div><dt>ФИО водителя-экспедитора:</dt><dd>{route ? route.driverId && route.driverName ? <Link to={catalogPath('drivers') + '/' + route.driverId}>{route.driverName}</Link> : route.driverName || '—' : ''}</dd></div>
        <div><dt>Номер страхования:</dt><dd>{route ? route.insuranceNumber || '—' : ''}</dd></div>
        <div><dt>Номер телефона:</dt><dd>{route ? route.phoneNumber || '—' : ''}</dd></div>
        <div><dt>Наличие прицепа:</dt><dd>{route ? route.withTrailer == null ? '—' : route.withTrailer ? 'Да' : 'Нет' : ''}</dd></div>
        <div><dt>Номер доверенности:</dt><dd>{route ? route.poaNumber || '—' : ''}</dd></div>
        <div><dt>Номер прицепа:</dt><dd>{route ? route.trailerNumber || '—' : ''}</dd></div>
      </dl>
    </section>}
    <section className="route-information-section" aria-label="Дополнительная информация о рейсе">
      <h2>Дополнительно</h2>
      <dl className="route-information-grid"><div className="route-information-wide"><dt>Комментарий:</dt><dd>{route ? route.comment || '—' : ''}</dd></div></dl>
    </section>
  </div>
}
