import type { OrderDetails, ReceivingContainerAttributes } from '../domain'
import { OrderContainerTable, type ContainerTableGroup } from './OrderContainerTable'
import './RailwayReceivingHierarchy.css'

export function RailwayReceivingHierarchy({waybills,containers,defaultOwnerId,onChange}:{
  waybills:OrderDetails['waybills']
  containers:OrderDetails['containers']
  defaultOwnerId?:string
  onChange?:(id:string,change:ReceivingContainerAttributes)=>void
}) {
  if(!waybills.length)return <div className="inline-empty">Накладные не найдены</div>
  const groups:ContainerTableGroup[]=waybills.flatMap(bill=>bill.railwayCarriages.map(wagon=>({
    key:bill.id+'-'+wagon.id,label:'Вагон № '+wagon.number,hint:'Накладная ЭТРАН № '+bill.number,
    rows:wagon.containers.map(source=>{
      const row=containers.find(item=>item.containerId===source.containerId)
      return {...row,key:source.containerId,containerId:source.containerId,name:row?.containerName??source.number,
        empty:row?.empty??source.netWeight===0,readOnly:!row,
        sealNumbers:row?row.sealNumbers:source.sealNumbers,sealTypeName:row?row.sealTypeName:source.sealTypeName,
        containerType:source.type,loadCapacity:source.loadCapacity,tareWeight:source.tareWeight,grossWeight:source.grossWeight}
    })
  })))
  return <section className="form-section" aria-label="КТК по накладным и вагонам"><OrderContainerTable rows={groups.flatMap(group=>group.rows)} groups={groups} showPhysicalAttributes defaultOwnerId={defaultOwnerId} onChange={onChange}/></section>
}
