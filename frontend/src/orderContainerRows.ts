import type { SelectedWaybill } from './orderForm'
import type { ReferenceOption } from './domain'
import type { ContainerTableRow } from './components/OrderContainerTable'

export function receivingWaybillRows(waybills: SelectedWaybill[], defaultOwnerId: string | undefined, clients: ReferenceOption[]): ContainerTableRow[] {
  const result = new Map<string, ContainerTableRow>()
  for (const bill of waybills) {
    const classes = [...new Map(bill.products.filter(p => p.hazardClassId).map(p => [p.hazardClassId, p])).values()]
    for (const c of bill.railwayCarriages?.flatMap(w => w.containers) ?? bill.containers ?? []) {
      if (result.has(c.containerId)) continue
      result.set(c.containerId, { key:c.containerId, containerId:c.containerId, name:c.number, empty:c.netWeight===0,
        ownerClientId:defaultOwnerId, ownerClientName:clients.find(client => client.id===defaultOwnerId)?.name,
        containerType:c.type, loadCapacity:c.loadCapacity, tareWeight:c.tareWeight, grossWeight:c.grossWeight,
        sealNumbers:c.sealNumbers, sealTypeId:c.sealTypeId, sealTypeName:c.sealTypeName,
        hazardClassId:classes.length===1 ? classes[0].hazardClassId : null,
        hazardClassName:classes.length===1 ? classes[0].hazardClassName : null })
    }
  }
  return [...result.values()]
}
