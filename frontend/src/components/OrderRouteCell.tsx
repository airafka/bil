import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createRoute, getOrder, getRoute } from '../api'
import type { OrderDetails } from '../domain'
import type { RouteType } from '../routes'
import { transportTypeLabel } from '../domain'
import { UiInput, UiTextarea } from './FormControls'

export function OrderRouteCell({ id, kind }: { id: string; kind: RouteType }) {
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [route, setRoute] = useState<{ id: string; code: number } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let active = true
    getOrder(kind === 'SHIPPING' ? '/api/shipping-orders' : '/api/receiving-orders', id).then(async value => {
      if (!active) return
      setOrder(value)
      if (value.routeId) {
        const result = await getRoute(value.routeId)
        if (active) setRoute(result.route)
      }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить рейс') })
    return () => { active = false }
  }, [id, kind, attempt])
  if (route) return <Link className="order-code" to={'/routes/' + route.id}>Рейс {route.code}</Link>
  if (error) return <button type="button" className="text-action-button" title={error} onClick={() => { setError(''); setAttempt(value => value + 1) }}>Повторить загрузку</button>
  if (!order || order.routeId) return <span>Загрузка…</span>
  return <>
    <button type="button" className="secondary-button" disabled={order.status !== 'DRAFT'} title={order.status !== 'DRAFT' ? 'Добавление в рейс доступно для черновика заявки' : undefined} onClick={() => setOpen(true)}>Создать рейс</button>
    {open && <RouteDrawer order={order} kind={kind} onClose={() => setOpen(false)} onCreated={value => { setRoute(value); setOpen(false) }} />}
  </>
}

function RouteDrawer({ order, kind, onClose, onCreated }: { order: OrderDetails; kind: RouteType; onClose: () => void; onCreated: (route: { id: string; code: number }) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [date, setDate] = useState('')
  const [carrier, setCarrier] = useState('')
  const [driver, setDriver] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [comment, setComment] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || !order.terminalArea || !order.transportType) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await createRoute({ routeType: kind, transportType: order.transportType, terminalAreaId: order.terminalArea.id,
        departureAt: new Date(date).toISOString(), carrier, driverName: driver, vehicleNumber: vehicle, comment, orderIds: [order.id] })
      onCreated(result.route)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать рейс') }
    finally { lock.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="route-side-dialog" aria-labelledby="route-drawer-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={save}>
      <header><h2 id="route-drawer-title">Создать рейс</h2><button type="button" className="secondary-button" aria-label="Закрыть форму рейса" disabled={busy} onClick={onClose}>×</button></header>
      <div className="route-drawer-body">
        <p>{kind === 'SHIPPING' ? 'Вывоз' : 'Поставка'} {order.code} будет добавлен в рейс.</p>
        <label>Тип рейса<UiInput readOnly value={kind === 'SHIPPING' ? 'Вывоз' : 'Поставка'} /></label>
        <label>Площадка<UiInput readOnly value={order.terminalArea?.name ?? ''} /></label>
        <label>Транспорт<UiInput readOnly value={transportTypeLabel(order.transportType)} /></label>
        <label>Дата и время *<UiInput autoFocus type="datetime-local" required value={date} disabled={busy} onChange={event => setDate(event.target.value)} /></label>
        {order.transportType === 'VEHICLE' && <>
          <label>Перевозчик *<UiInput required maxLength={255} value={carrier} disabled={busy} onChange={event => setCarrier(event.target.value)} /></label>
          <label>ФИО водителя *<UiInput required maxLength={255} value={driver} disabled={busy} onChange={event => setDriver(event.target.value)} /></label>
          <label>Госномер *<UiInput required maxLength={100} value={vehicle} disabled={busy} onChange={event => setVehicle(event.target.value)} /></label>
        </>}
        <label>Комментарий<UiTextarea maxLength={200} value={comment} disabled={busy} onChange={event => setComment(event.target.value)} /></label>
        {error && <div className="notice error" role="alert">{error}</div>}
      </div>
      <footer><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Отмена</button><button type="submit" className="primary-button" disabled={busy || !order.terminalArea || !order.transportType}>{busy ? 'Создаём…' : 'Создать рейс'}</button></footer>
    </form>
  </dialog>
}
