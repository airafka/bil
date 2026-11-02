import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { createRoute } from '../api'
import type { TransportType } from '../domain'
import { transportTypeLabel } from '../domain'
import type { RouteSummary, RouteType } from '../routes'
import { routeDateLabel, routeTypeLabel } from '../routes'
import { UiInput, UiTextarea } from './FormControls'
import './RoutePicker.css'

type Props = {
  routes: RouteSummary[]
  routeType: RouteType
  transportType: TransportType
  terminalAreaId: string
  selectedId: string
  onSelect: (id: string) => void
  onCreated: (route: RouteSummary) => void
  onRefresh: () => void
  loading?: boolean
  error?: string
  disabled?: boolean
}
import { matchingRoutes } from '../routePickerOptions'
export function RoutePicker({routes,routeType,transportType,terminalAreaId,selectedId,onSelect,onCreated,onRefresh,loading=false,error='',disabled=false}:Props) {
  const [search,setSearch]=useState('')
  const [creating,setCreating]=useState(false)
  const [saving,setSaving]=useState(false)
  const [createError,setCreateError]=useState('')
  const [date,setDate]=useState(''),[carrier,setCarrier]=useState(''),[driver,setDriver]=useState(''),[vehicle,setVehicle]=useState(''),[comment,setComment]=useState('')
  const saveLock=useRef(false),createButton=useRef<HTMLButtonElement>(null)
  const rows=matchingRoutes(routes,routeType,transportType,terminalAreaId,search)
  const selected=routes.find(route=>route.id===selectedId)
  const close=()=>{if(!saveLock.current){setCreating(false);setCreateError('');createButton.current?.focus()}}
  const keys=(event:KeyboardEvent<HTMLElement>)=>{
    if(event.key==='Escape'){event.preventDefault();close()}
    if(event.key==='Tab'){
      const items=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')]
      const first=items[0],last=items[items.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
  }
  async function save(event:FormEvent){
    event.preventDefault();if(saveLock.current)return
    saveLock.current=true;setSaving(true);setCreateError('')
    try{
      const result=await createRoute({routeType,transportType,terminalAreaId,departureAt:new Date(date).toISOString(),carrier,driverName:driver,vehicleNumber:vehicle,comment,orderIds:[]})
      onCreated(result.route);onSelect(result.route.id);setCreating(false);setDate('');setCarrier('');setDriver('');setVehicle('');setComment('');createButton.current?.focus()
    }catch(cause){setCreateError(cause instanceof Error?cause.message:'Не удалось создать рейс')}
    finally{saveLock.current=false;setSaving(false)}
  }
  return <div className="route-picker">
    <div className="route-picker-toolbar"><div className="route-picker-actions"><button ref={createButton} type="button" className="outline-action-button" disabled={disabled||!terminalAreaId} onClick={()=>setCreating(true)}>Создать рейс</button><button type="button" className="outline-action-button" disabled={disabled||loading} onClick={onRefresh}>Обновить</button></div><UiInput aria-label="Поиск рейса" placeholder="Поиск" value={search} onChange={event=>setSearch(event.target.value)} /></div>
    {error&&<div className="notice error" role="alert">{error}</div>}
    {selected&&<div className="route-picker-selection">Выбран рейс {selected.code}<button type="button" disabled={disabled} onClick={()=>onSelect('')}>Снять выбор</button></div>}
    <div className="route-picker-scroll"><table className="route-picker-table" aria-label="Выбор рейса">
      <colgroup><col className="route-picker-choice"/><col className="route-picker-code"/><col/><col/><col className="route-picker-date"/><col/><col/><col/></colgroup>
      <thead><tr><th aria-label="Выбрать"/><th>Рейс</th><th>Заявки</th><th>Перевозчик / экспедитор</th><th>Дата и время</th><th>Номер ТС</th><th>ФИО водителя-экспедитора</th><th>Комментарий</th></tr></thead>
      <tbody>{loading?<tr><td colSpan={8}>Загружаем рейсы…</td></tr>:rows.length?rows.map(route=><tr key={route.id} className={selectedId===route.id?'route-picker-selected':''}>
        <td><UiInput type="checkbox" aria-label={`Выбрать рейс ${route.code}`} checked={selectedId===route.id} disabled={disabled} onChange={()=>onSelect(selectedId===route.id?'':route.id)}/></td>
        <td><Link to={'/routes/'+route.id} target="_blank" rel="noreferrer">{route.code}</Link></td>
        <td title={route.orderNumbers?.join(', ')}>{route.orderNumbers?.length?route.orderNumbers.join(', '):route.orderCount?`${route.orderCount} заявок`:'—'}</td>
        <td title={route.carrier??undefined}>{route.carrier||'—'}</td><td>{routeDateLabel(route.departureAt)}</td><td>{route.vehicleNumber||'—'}</td><td title={route.driverName??undefined}>{route.driverName||'—'}</td><td title={route.comment??undefined}>{route.comment||'—'}</td>
      </tr>):<tr><td colSpan={8}>{search?'Рейсы по запросу не найдены':'Подходящих черновых рейсов пока нет'}</td></tr>}</tbody>
    </table></div>
    {creating&&<div className="route-picker-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="route-picker-create-title" className="route-picker-dialog" onKeyDown={keys}>
      <div className="route-picker-dialog-heading"><h2 id="route-picker-create-title">Создать рейс</h2><button type="button" className="row-clear-button" aria-label="Закрыть создание рейса" disabled={saving} onClick={close}>×</button></div>
      <p>{routeTypeLabel(routeType)} · {transportTypeLabel(transportType)}</p>
      <form onSubmit={save}>
        <label className="field"><span>Дата и время <b>*</b></span><UiInput autoFocus required type="datetime-local" value={date} disabled={saving} onChange={e=>setDate(e.target.value)}/></label>
        <label className="field"><span>Перевозчик / экспедитор{transportType==='VEHICLE'&&' *'}</span><UiInput required={transportType==='VEHICLE'} value={carrier} maxLength={255} disabled={saving} onChange={e=>setCarrier(e.target.value)}/></label>
        <label className="field"><span>Номер ТС{transportType==='VEHICLE'&&' *'}</span><UiInput required={transportType==='VEHICLE'} value={vehicle} maxLength={100} disabled={saving} onChange={e=>setVehicle(e.target.value)}/></label>
        <label className="field"><span>ФИО водителя-экспедитора{transportType==='VEHICLE'&&' *'}</span><UiInput required={transportType==='VEHICLE'} value={driver} maxLength={255} disabled={saving} onChange={e=>setDriver(e.target.value)}/></label>
        <label className="field"><span>Комментарий</span><UiTextarea value={comment} maxLength={200} disabled={saving} onChange={e=>setComment(e.target.value)}/></label>
        {createError&&<div className="notice error" role="alert">{createError}</div>}
        <div className="route-picker-dialog-actions"><button type="button" className="secondary-button" disabled={saving} onClick={close}>Отмена</button><button type="submit" className="primary-button" disabled={saving}>{saving?'Создаём…':'Создать и выбрать'}</button></div>
      </form>
    </section></div>}
  </div>
}
