import { expect,it } from 'vitest'
import {containerAdditionsPayload,type DraftContainerAddition} from './orderContainerAdditions'
const row:DraftContainerAddition={key:'new:1',container:{id:'c',name:'KTK',empty:true,etsngCodeId:'',weight:''}}
it('rejects additions duplicating existing or pending KTK',()=>{
  expect(()=>containerAdditionsPayload([row],['c'])).toThrow('уже включён')
  expect(()=>containerAdditionsPayload([row,row],[])).toThrow('уже включён')
})
it('requires a numbered container and valid loaded cargo',()=>{
  expect(()=>containerAdditionsPayload([{...row,container:{...row.container,id:''}}],[])).toThrow('Выберите номер')
  expect(()=>containerAdditionsPayload([{...row,container:{...row.container,empty:false}}],[])).toThrow('Выберите груз')
})
it('preserves wagon identity and normalizes loaded mass',()=>{
  expect(containerAdditionsPayload([{...row,railwayCarriageId:'wagon',container:{...row.container,empty:false,etsngCodeId:'goods',weight:'100,125'}}],[])[0]).toMatchObject({railwayCarriageId:'wagon',container:{containerId:'c',empty:false,cargo:{etsngCodeId:'goods',weight:100.125}}})
})
