import { expect, it } from 'vitest'
import { matchingRoutes } from './routePickerOptions'
import type { RouteSummary } from './routes'
const route: RouteSummary={id:'r',code:100,routeType:'SHIPPING',departureAt:'2026-11-02T09:00:00Z',terminalAreaId:'area',terminalAreaName:'Площадка',transportType:'VEHICLE',carrier:'Перевозчик',driverName:'Иванов',vehicleNumber:'А123АА',comment:'Хрупкий товар',status:'DRAFT',orderCount:2,orderNumbers:[17,25]}
it('offers only draft routes with matching direction, transport and area',()=>{
  expect(matchingRoutes([route,{...route,id:'done',status:'COMPLETED'},{...route,id:'other',routeType:'RECEIVING'},{...route,id:'rail',transportType:'RAILWAY'},{...route,id:'area',terminalAreaId:'other'}],'SHIPPING','VEHICLE','area','').map(r=>r.id)).toEqual(['r'])
})
it('searches actual order numbers, vehicle, driver and comment',()=>{
  for(const query of ['25','а123аа','ИВАНОВ','хрупкий','100'])expect(matchingRoutes([route],'SHIPPING','VEHICLE','area',query)).toEqual([route])
  expect(matchingRoutes([route],'SHIPPING','VEHICLE','area','несуществующий')).toEqual([])
})
