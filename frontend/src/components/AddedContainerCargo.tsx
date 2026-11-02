import type { DraftContainerAddition } from '../orderContainerAdditions'
import type { ReferenceOption } from '../domain'
import { UiInput, UiSelect } from './FormControls'
export function AddedContainerCargo({rows,options,onChange}:{rows:DraftContainerAddition[];options:ReferenceOption[];onChange:(key:string,field:'etsngCodeId'|'weight',value:string)=>void}) {
  const loaded=rows.filter(row=>row.container.id&&!row.container.empty)
  if(!loaded.length)return null
  return <div className="added-container-cargo"><h3>Груз добавляемых КТК</h3>{loaded.map(row=><div className="added-container-cargo-row" key={row.key}>
    <span>{row.container.name}</span>
    <label className="field"><span>Груз по ЕТСНГ *</span><UiSelect aria-label={'Груз по ЕТСНГ — '+row.container.name} value={row.container.etsngCodeId} onChange={e=>onChange(row.key,'etsngCodeId',e.target.value)}><option value="">Выберите груз</option>{options.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</UiSelect></label>
    <label className="field"><span>Масса, кг *</span><UiInput aria-label={'Масса, кг — '+row.container.name} inputMode="decimal" value={row.container.weight} onChange={e=>onChange(row.key,'weight',e.target.value)} placeholder="0,000"/></label>
  </div>)}</div>
}
