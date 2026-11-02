import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {RailwayReceivingHierarchy} from './RailwayReceivingHierarchy'
import type {OrderDetails} from '../domain'

const waybills:OrderDetails['waybills']=[{id:'b1',number:'111',departureStation:1,destinationStation:2,payer:'payer',products:[],railwayCarriages:[
  {id:'w1',railwayCarriageId:'wagon1',number:'222',containers:[{containerId:'c1',number:'KTK-1',grossWeight:4000,tareWeight:3000,netWeight:1000,type:'STANDARD_40',loadCapacity:30000,owner:'Строка накладной'}]},
  {id:'w2',railwayCarriageId:'wagon2',number:'333',containers:[{containerId:'c2',number:'KTK-2',grossWeight:3000,tareWeight:3000,netWeight:0}]}]}]
it('renders one table with wagon group rows and the source bill beside each wagon',()=>{
  const html=renderToStaticMarkup(<RailwayReceivingHierarchy waybills={waybills} containers={[{containerId:'c1',containerName:'KTK-1',empty:false,cargo:null,ownerClientName:'Собственник заявки'}]}/>)
  const positions=['Вагон № 222','KTK-1','Вагон № 333','KTK-2'].map(text=>html.indexOf(text))
  expect(positions.every(position=>position>=0)).toBe(true)
  expect(positions).toEqual([...positions].sort((a,b)=>a-b))
  expect(html.match(/<table /g)).toHaveLength(1)
  expect(html.match(/<thead/g)).toHaveLength(1)
  expect(html.match(/Накладная ЭТРАН № 111/g)).toHaveLength(2)
  expect(html).not.toContain('<details')
  expect(html).toContain('Собственник заявки')
  expect(html).not.toContain('Строка накладной')
  expect(html).toContain('Грузоподъёмность, кг')
  expect(html).toContain('Масса брутто, кг')
  expect(html).toContain('Стандартный 40')
})
it('shows a clear empty state when there is no composition',()=>{
  expect(renderToStaticMarkup(<RailwayReceivingHierarchy waybills={[]} containers={[]}/>)).toContain('Накладные не найдены')
})
