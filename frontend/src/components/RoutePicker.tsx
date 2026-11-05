import { AppOverlay } from './AppOverlay'
import { RouteLogisticsFields } from './RouteLogisticsFields'
import { Notification } from './Notification'
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
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
  loading?: boolean
  error?: string
  disabled?: boolean
}
import { matchingRoutes } from '../routePickerOptions'
export function RoutePicker({routes,routeType,transportType,terminalAreaId,selectedId,onSelect,onCreated,loading=false,error='',disabled=false}:Props) {
  const createFormId = useId()
  const [search,setSearch]=useState('')
  const [creating,setCreating]=useState(false)
  const [saving,setSaving]=useState(false)
  const [createError,setCreateError]=useState('')
  const [date,setDate]=useState(''),[carrier,setCarrier]=useState(''),[driver,setDriver]=useState(''),[vehicle,setVehicle]=useState(''),[comment,setComment]=useState('')
  const saveLock=useRef(false),createButton=useRef<HTMLButtonElement>(null)
  const rows=matchingRoutes(routes,routeType,transportType,terminalAreaId,search)
  const close=()=>{if(!saveLock.current){setCreating(false);setCreateError('');createButton.current?.focus()}}
  const keys=(event:KeyboardEvent<HTMLElement>)=>{
    if(event.key==='Escape'){event.preventDefault();close()}
    if(event.key==='Tab'){
      const items=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')]
      const first=items[0],last=items[items.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
  }
  async function save(event:FormEvent){
    event.preventDefault();event.stopPropagation();if(saveLock.current)return
    saveLock.current=true;setSaving(true);setCreateError('')
    try{
      const result=await createRoute({routeType,transportType,terminalAreaId,departureAt:new Date(date).toISOString(),carrierId:transportType==='VEHICLE'?carrier||null:null,driverId:transportType==='VEHICLE'?driver||null:null,vehicleId:transportType==='VEHICLE'?vehicle||null:null,comment,orderIds:[]})
      onCreated(result.route);onSelect(result.route.id);setCreating(false);setDate('');setCarrier('');setDriver('');setVehicle('');setComment('');createButton.current?.focus()
    }catch(cause){setCreateError(cause instanceof Error?cause.message:'Не удалось создать рейс')}
    finally{saveLock.current=false;setSaving(false)}
  }
  return <div className="route-picker">
    <div className="route-picker-toolbar"><div className="route-picker-actions"><button ref={createButton} type="button" className="outline-action-button" disabled={disabled||!terminalAreaId} onClick={()=>setCreating(true)}>Создать рейс</button></div><UiInput aria-label="Поиск рейса" placeholder="Поиск" value={search} onChange={event=>setSearch(event.target.value)} /></div>
    {error&&<Notification kind="error">{error}</Notification>}
    <div className="route-picker-scroll"><table className="route-picker-table" aria-label="Выбор рейса">
      <colgroup><col className="route-picker-choice"/><col className="route-picker-code"/><col/><col className="route-picker-date"/><col/></colgroup>
      <thead><tr><th aria-label="Выбрать"/><th>Рейс</th><th>Заявки</th><th>Дата и время</th><th>Комментарий</th></tr></thead>
      <tbody>{loading?<tr><td colSpan={5}>Загружаем рейсы…</td></tr>:rows.length?rows.map(route=><tr key={route.id}>
        <td><UiInput type="checkbox" aria-label={`Выбрать рейс ${route.code}`} checked={selectedId===route.id} disabled={disabled} onChange={()=>onSelect(selectedId===route.id?'':route.id)}/></td>
        <td><Link to={'/routes/'+route.id} target="_blank" rel="noreferrer">{route.code}</Link></td>
        <td title={route.orderNumbers?.join(', ')}>{route.orderNumbers?.length?route.orderNumbers.join(', '):route.orderCount?`${route.orderCount} заявок`:'—'}</td>
        <td>{routeDateLabel(route.departureAt)}</td><td title={route.comment??undefined}>{route.comment||'—'}</td>
      </tr>):<tr><td colSpan={5}>{search?'Рейсы по запросу не найдены':'Подходящих черновых рейсов пока нет'}</td></tr>}</tbody>
    </table></div>
    {creating&&<AppOverlay><div className="route-picker-backdrop" onDoubleClick={event=>event.stopPropagation()}><section role="dialog" aria-modal="true" aria-labelledby="route-picker-create-title" className="route-picker-dialog" onKeyDown={keys}>
      <div className="route-picker-dialog-heading route-dialog-heading"><h2 id="route-picker-create-title">Создать рейс</h2><div className="header-actions"><button type="submit" form={createFormId} className="primary-button create-action-button" disabled={saving}>{saving?'Создаём…':'Создать и выбрать'}</button><button type="button" className="close-button" title="Закрыть" aria-label="Закрыть создание рейса" disabled={saving} onClick={close}>×</button></div></div>
      <form id={createFormId} onSubmit={save}>
        <label className="field"><span>Дата и время <b>*</b></span><UiInput autoFocus required type="datetime-local" value={date} disabled={saving} onChange={e=>setDate(e.target.value)}/></label>
        {transportType==='VEHICLE' && <RouteLogisticsFields carrierId={carrier} driverId={driver} vehicleId={vehicle} onCarrier={setCarrier} onDriver={setDriver} onVehicle={setVehicle} disabled={saving} referenceInfo={<p>{routeTypeLabel(routeType)} · {transportTypeLabel(transportType)}</p>}>
        <label className="field"><span>Комментарий</span><UiTextarea value={comment} maxLength={200} disabled={saving} onChange={e=>setComment(e.target.value)}/></label>
        </RouteLogisticsFields>}
        {!(transportType==='VEHICLE') && <label className="field"><span>Комментарий</span><UiTextarea value={comment} maxLength={200} disabled={saving} onChange={e=>setComment(e.target.value)}/></label>}
        {transportType !== 'VEHICLE' && <section className="route-reference-section"><h2>Справочная информация</h2><p>{routeTypeLabel(routeType)} · {transportTypeLabel(transportType)}</p></section>}
        {createError&&<Notification kind="error">{createError}</Notification>}

      </form>
    </section></div></AppOverlay>}
  </div>
}
