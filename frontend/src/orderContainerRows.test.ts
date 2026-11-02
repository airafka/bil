import { expect, it } from 'vitest'
import { receivingWaybillRows } from './orderContainerRows'
import type { SelectedWaybill } from './orderForm'

const bill: SelectedWaybill = { id:'bill',number:'1',groupKey:'group',departureStation:1,destinationStation:2,payer:'payer',railwayCarriageCount:1,containerCount:1,
  products:[{id:'p',etsngCodeId:'e',code:'1',name:'Груз',weight:100,hazardClassId:'hazard',hazardClassName:'Класс'}],
  containers:[{containerId:'ktk',number:'ABCD',netWeight:100,grossWeight:4000,tareWeight:3900,owner:'Текст накладной',sealNumbers:'0001',sealTypeId:'seal'}] }
it('uses the receipt default owner instead of the waybill owner string and carries source attributes',()=>{
  const rows=receivingWaybillRows([bill,bill],'owner',[{id:'owner',name:'Выбранный собственник'}])
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ownerClientId:'owner',ownerClientName:'Выбранный собственник',hazardClassId:'hazard',sealNumbers:'0001',empty:false})
})
it('does not choose one danger class when products have different classes',()=>{
  expect(receivingWaybillRows([{...bill,products:[...bill.products,{...bill.products[0],id:'other',hazardClassId:'different'}]}],'owner',[])[0].hazardClassId).toBeNull()
})
