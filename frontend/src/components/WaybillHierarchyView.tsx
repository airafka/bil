import { useState } from 'react'
import { WaybillCompositionTable, type CompositionTab, type CompositionWaybill } from './WaybillCompositionTable'
import './WaybillHierarchy.css'

const tabs: { id: CompositionTab; title: string }[] = [
  { id: 'wagons', title: 'Вагоны' }, { id: 'containers', title: 'КТК' }, { id: 'cargo', title: 'Груз' },
]

export function WaybillHierarchyView({ waybills }: { waybills: CompositionWaybill[] }) {
  const [tab, setTab] = useState<CompositionTab>('containers')
  return <div className="waybill-hierarchy-view">
    <div className="stepper" aria-label="Состав накладных">
      {tabs.map(item => <button type="button" key={item.id} className={`step ${tab === item.id ? 'current' : ''}`} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.title}</button>)}
    </div>
    <WaybillCompositionTable waybills={waybills} tab={tab} showNetWeight wagonAttributes />
  </div>
}
