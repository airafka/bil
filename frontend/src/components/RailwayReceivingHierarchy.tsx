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
  const groups:ContainerTableGroup[]=waybills.map(bill=>({key:bill.id,label:'Накладная № '+bill.number,rows:[],children:bill.railwayCarriages.map(wagon=>({
    key:bill.id+'-'+wagon.id,label:'Вагон № '+wagon.number,
    rows:wagon.containers.map(source=>{
      const row=containers.find(item=>item.containerId===source.containerId)
      return {...row,key:source.containerId,containerId:source.containerId,name:source.number,
        empty:source.netWeight===0,readOnly:!row,
        sealNumbers:source.sealNumbers,sealTypeName:source.sealTypeName,
        hazardClassName:[...new Set(bill.products.map(p=>p.hazardClassName).filter(Boolean))].join(', ') || null,
        containerType:source.type,loadCapacity:source.loadCapacity,tareWeight:source.tareWeight,grossWeight:source.grossWeight}
    })
  }))}))
  return <section className="form-section composition-section" aria-label="КТК по накладным и вагонам"><OrderContainerTable rows={groups.flatMap(group=>group.children?.flatMap(wagon=>wagon.rows)??group.rows)} groups={groups} attributesReadOnly showPhysicalAttributes defaultOwnerId={defaultOwnerId} onChange={onChange}/></section>
}
