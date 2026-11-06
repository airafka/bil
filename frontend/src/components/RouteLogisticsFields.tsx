import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { getTransportCatalog } from '../api'
import type { TransportCatalogEntry, TransportCatalogKind } from '../transportCatalogs'
import { catalogDate } from '../transportCatalogs'
import { UiInput, UiSelect } from './FormControls'
import { Notification } from './Notification'

type Props = {carrierId:string;driverId:string;vehicleId:string;onCarrier:(id:string)=>void;onDriver:(id:string)=>void;onVehicle:(id:string)=>void;disabled?:boolean;children?:ReactNode;referenceInfo?:ReactNode;showHeading?:boolean;showReferenceInfo?:boolean}
export function RouteLogisticsFields({carrierId,driverId,vehicleId,onCarrier,onDriver,onVehicle,disabled,children,referenceInfo,showHeading=true,showReferenceInfo=true}:Props) {
 const [data,setData]=useState<Record<TransportCatalogKind,TransportCatalogEntry[]>>({carriers:[],drivers:[],vehicles:[]})
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 useEffect(()=>{let active=true;Promise.all([getTransportCatalog('carriers'),getTransportCatalog('drivers'),getTransportCatalog('vehicles')])
 .then(([carriers,drivers,vehicles])=>{if(active)setData({carriers,drivers,vehicles})}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Не удалось загрузить справочники')}).finally(()=>{if(active)setLoading(false)})
 return ()=>{active=false}},[])
 const driver=data.drivers.find(x=>x.id===driverId),vehicle=data.vehicles.find(x=>x.id===vehicleId)
 const select=(kind:TransportCatalogKind,id:string,onChange:(value:string)=>void,label:string)=><label className="field horizontal-field"><span>{label} <b>*</b></span><UiSelect required value={id} disabled={disabled||loading} onChange={e=>onChange(e.target.value)}><option value="" hidden disabled />{data[kind].filter(x=>x.active||x.id===id).map(x=><option key={x.id} value={x.id} disabled={!x.active}>{x.name}{!x.active?' (неактивный)':''}</option>)}</UiSelect></label>
 const field=(label:string,value:string|null|undefined)=><div className="field horizontal-field"><span>{label}</span><span className="ui-readonly-value">{value||'—'}</span></div>
 return <><section className={`form-section ui-form-section ui-section-divider${showHeading?'':' route-logistics-fields--plain'}`} aria-label="Логистика">
 {showHeading&&<h2 className="form-section-heading">Логистика</h2>}
 {error&&<Notification kind="error">{error}</Notification>}
 {loading&&<p role="status">Загружаем справочники…</p>}
 <div className="form-fields-grid"><div className="form-fields-column">
 {select('carriers',carrierId,onCarrier,'Перевозчик / экспедитор')}
 {select('drivers',driverId,onDriver,'ФИО водителя-экспедитора')}
 </div><div className="form-fields-column">
 {select('vehicles',vehicleId,onVehicle,'Номер ТС')}
 </div></div></section>
 {children}
 {showReferenceInfo&&<section className="form-section ui-form-section ui-section-divider route-reference-section"><h2 className="form-section-heading">Справочная информация</h2>
 {referenceInfo}
 <div className="form-fields-grid"><div className="form-fields-column">
 {field('Телефон',driver?.phoneNumber)}{field('Доверенность',driver?.poaNumber)}{field('Доверенность действительна до',catalogDate(driver?.poaValidTo))}
 </div><div className="form-fields-column">
 {field('Страховка',vehicle?.insuranceNumber)}
 <div className="field horizontal-field"><span>Наличие прицепа</span><span className="ui-readonly-value">{vehicle?.withTrailer==null?'—':<UiInput aria-label="Наличие прицепа" type="checkbox" checked={vehicle.withTrailer} disabled />}</span></div>
 {field('Номер прицепа',vehicle?.trailerNumber)}
 </div></div></section>}</>
}
