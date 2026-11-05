import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {RailwayReceivingHierarchy} from './RailwayReceivingHierarchy'
import type {OrderDetails} from '../domain'

const waybills:OrderDetails['waybills']=[{id:'b1',number:'111',departureStation:1,destinationStation:2,payer:'payer',products:[],railwayCarriages:[
  {id:'w1',railwayCarriageId:'wagon1',number:'222',containers:[{containerId:'c1',number:'KTK-1',grossWeight:4000,tareWeight:3000,netWeight:1000,type:'STANDARD_40',loadCapacity:30000,owner:'Строка накладной'}]},
  {id:'w2',railwayCarriageId:'wagon2',number:'333',containers:[{containerId:'c2',number:'KTK-2',grossWeight:3000,tareWeight:3000,netWeight:0}]}]}]
it('renders the bill then nested wagons in one table with current container attributes',()=>{
  const html=renderToStaticMarkup(<RailwayReceivingHierarchy waybills={waybills} containers={[{containerId:'c1',containerName:'KTK-1',empty:false,cargo:null,ownerClientName:'Собственник заявки'}]}/>)
  const positions=['Накладная № 111','Вагон № 222','KTK-1','Вагон № 333','KTK-2'].map(text=>html.indexOf(text))
  expect(positions.every(position=>position>=0)).toBe(true)
  expect(positions).toEqual([...positions].sort((a,b)=>a-b))
  expect(html.match(/<table /g)).toHaveLength(1)
  expect(html.match(/<thead/g)).toHaveLength(1)
  expect(html.match(/Накладная № 111/g)).toHaveLength(1)
  expect(html).toContain('rowSpan="5"')
  expect(html).toContain('Класс опасности груза')
  expect(html).toContain('Статус КТК')
  expect(html).not.toContain('<details')
  expect(html).toContain('Собственник заявки')
  expect(html).not.toContain('Строка накладной')
  expect(html).toContain('Грузоподъёмность, кг')
  expect(html).toContain('Масса брутто, кг')
  expect(html).toContain('Стандартный 40')
  const header = html.match(/<thead>([\s\S]*?)<\/thead>/)![1]
  const headers = [...header.matchAll(/<th(?:\s[^>]*)?>(.*?)<\/th>/g)].map(match => match[1])
  const row = html.match(/<tr class="container-child-row">([\s\S]*?)<\/tr>/)![1]
  const cells = [...row.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/g)].map(match => match[1])
  // The group number is a shared rowSpan cell, so container rows have one fewer cell.
  expect(cells).toHaveLength(headers.length - 1)
  expect(cells[headers.indexOf('Порожний') - 1]).toContain('type="checkbox"')
  expect(cells[headers.indexOf('Класс опасности груза') - 1]).not.toContain('<input')
})
it('shows a clear empty state when there is no composition',()=>{
  expect(renderToStaticMarkup(<RailwayReceivingHierarchy waybills={[]} containers={[]}/>)).toContain('Накладные не найдены')
})

it('uses waybill seals, cargo classification and empty flag even when the ownership row is stale',()=>{
  const bills=waybills.map(b=>({...b,products:[{id:'p',etsngCodeId:'e',etsngCode:'cargo',weight:1,hazardClassName:'SOURCE HAZARD'}],railwayCarriages:b.railwayCarriages.map(w=>({...w,containers:w.containers.map(c=>({...c,sealNumbers:'SOURCE SEAL'}))}))}))
  const html=renderToStaticMarkup(<RailwayReceivingHierarchy waybills={bills} containers={[{containerId:'c1',containerName:'STALE NUMBER',empty:true,cargo:null,ownerClientId:'chosen',ownerClientName:'Chosen owner',sealNumbers:'STALE SEAL',hazardClassName:'STALE HAZARD'}]} onChange={()=>{}}/>)
  expect(html).toContain('SOURCE SEAL')
  expect(html).toContain('SOURCE HAZARD')
  expect(html).not.toContain('STALE')
  expect(html).toContain('Chosen owner')
  expect(html).not.toContain('aria-label="Номера ЗПУ')
  expect(html).not.toContain('aria-label="Класс опасности груза')
})
