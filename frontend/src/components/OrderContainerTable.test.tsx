import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OrderContainerTable } from './OrderContainerTable'

it('shows the full container row with the frozen order owner and register status', () => {
  const html=renderToStaticMarkup(<OrderContainerTable ownerReadOnly rows={[{ key:'1',containerId:'1',name:'ABCD1234567',empty:true,ownerClientName:'Собственник Б',sealNumbers:'0001, 0023',sealTypeName:'ЗПУ',hazardClassName:'Отсутствует',containerStatus:'RESERVED_OUT' }]} />)
  for(const value of ['Номер КТК','Собственник КТК','Номера ЗПУ','Тип ЗПУ','Класс опасности груза','Порожний','Статус КТК','Собственник Б','0001, 0023','Ожидает вывоза'])expect(html).toContain(value)
  expect(html).not.toContain('<select')
  expect(html).not.toContain('Номер КТК неизвестен')
})
it('keeps the shipping owner read-only while seal and danger fields are editable', () => {
  const html=renderToStaticMarkup(<OrderContainerTable ownerReadOnly rows={[{key:'1',containerId:'1',name:'ABCD',empty:false,ownerClientName:'Собственник Б'}]} onChange={()=>{}} />)
  expect(html).toContain('Собственник Б')
  expect(html).not.toContain('aria-label="Собственник КТК —')
  expect(html).toContain('aria-label="Тип ЗПУ — ABCD"')
})
