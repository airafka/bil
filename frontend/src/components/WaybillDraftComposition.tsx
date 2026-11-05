import { useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { containerTypeLabel, type DangerProductOption, type ReferenceOption } from '../domain'
import { netWeight, productRows, selectWaybillContainer, type WaybillCarriageRow, type WaybillContainerRow, type WaybillFormState } from '../waybillForm'
import { UiInput, UiSelect } from './FormControls'
import { DisclosureChevron, type CompositionTab } from './WaybillCompositionTable'
import './WaybillHierarchy.css'
import type { RailwayCarriage } from '../railwayCarriages'

type Props = {
  tab: CompositionTab
  form: WaybillFormState
  onChange: Dispatch<SetStateAction<WaybillFormState>>
  carriages: RailwayCarriage[]
  containers: ReferenceOption[]
  cargoOptions: ReferenceOption[]
  dangerProducts: DangerProductOption[]
  sealTypes: ReferenceOption[]
  disabled?: boolean
}
const columns: Record<CompositionTab, string[]> = {
  wagons: ['Номер вагона', 'Род вагона', 'Модель вагона', 'Грузоподъёмность, кг', 'Дата следующего ДР'],
  containers: ['Номер КТК', 'Тип КТК', 'Масса тары, кг', 'Масса брутто, кг', 'Масса нетто, кг', 'Грузоподъёмность, кг', 'Номера ЗПУ', 'Тип ЗПУ'],
  cargo: ['Груз по ЕТСНГ', 'Масса брутто, кг', 'Класс опасности груза'],
}
const mass = (value?: number | null) => value == null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: 3 })

export function WaybillDraftComposition({ tab, form, onChange, carriages, containers, cargoOptions, dangerProducts, sealTypes, disabled = false }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const nextKey = useRef(Math.max(0, ...form.railwayCarriages.map(row => row.key)) + 1)
  const groupId = useId()
  const toggle = (key: string) => setCollapsed(current => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })
  const updateCarriage = (key: number, update: (row: WaybillCarriageRow) => WaybillCarriageRow) => onChange(current => ({
    ...current, railwayCarriages: current.railwayCarriages.map(row => row.key === key ? update(row) : row),
  }))
  const updateContainer = (key: number, index: number, change: Partial<WaybillContainerRow>) => updateCarriage(key, row => ({
    ...row, containers: row.containers.map((item, i) => i === index ? { ...item, ...change } : item),
  }))
  const updateProduct = (index: number, change: Partial<ReturnType<typeof productRows>[number]>) => onChange(current => ({
    ...current, products: productRows(current).map((row, i) => i === index ? { ...row, ...change } : row),
  }))
  const addCarriage = () => {
    const key = nextKey.current++
    onChange(current => ({ ...current, railwayCarriages: [...current.railwayCarriages, { key, railwayCarriageId: '', containers: [] }] }))
    setCollapsed(current => { const next = new Set(current); next.delete('bill'); return next })
  }
  const addContainer = (key: number) => {
    updateCarriage(key, row => ({ ...row, containers: [...row.containers, { containerId: '', grossWeight: '', tareWeight: 0 }] }))
    setCollapsed(current => { const next = new Set(current); next.delete('wagon-' + key); return next })
  }
  const headings = columns[tab]
  const span = headings.length + 1
  const open = !collapsed.has('bill')
  const rows: ReactNode[] = []
  const empty = (message: string, key: string) => <tr key={key}><td colSpan={span} className="composition-empty">{message}</td></tr>

  if (open && tab === 'wagons') {
    for (const [index, row] of form.railwayCarriages.entries()) {
      const wagon = carriages.find(item => item.id === row.railwayCarriageId)
      rows.push(<tr className="composition-item" key={row.key}>
        <td><UiSelect aria-label={`Номер вагона ${index + 1}`} value={row.railwayCarriageId} onChange={e => updateCarriage(row.key, item => ({ ...item, railwayCarriageId: e.target.value }))}>
          <option value="" hidden disabled />{carriages.map(item => <option key={item.id} value={item.id} disabled={item.id !== row.railwayCarriageId && form.railwayCarriages.some(c => c.railwayCarriageId === item.id)}>{item.name}</option>)}
        </UiSelect></td>
        <td>{wagon?.carriageTypeName || '—'}</td><td>{wagon?.modelName || '—'}</td><td>{mass(wagon?.loadCapacity)}</td><td>{wagon?.nextDepotRepairDate?.split('-').reverse().join('.') || '—'}</td>
        <td className="registry-actions"><button type="button" className="row-clear-button" aria-label={`Удалить вагон ${index + 1}`} onClick={() => onChange(current => ({ ...current, railwayCarriages: current.railwayCarriages.filter(c => c.key !== row.key) }))}>×</button></td>
      </tr>)
    }
    if (!rows.length) rows.push(empty('Вагоны не добавлены', 'empty'))
  }
  if (open && tab === 'containers') {
    for (const [wagonIndex, wagon] of form.railwayCarriages.entries()) {
      const key = 'wagon-' + wagon.key
      const wagonOpen = !collapsed.has(key)
      const wagonName = carriages.find(item => item.id === wagon.railwayCarriageId)?.name || `не выбран (${wagonIndex + 1})`
      rows.push(<tr className="composition-subgroup" key={key}><th colSpan={span} scope="row">
        <div className="waybill-hierarchy-group-actions"><button type="button" aria-expanded={wagonOpen} onClick={() => toggle(key)}><DisclosureChevron />Вагон № {wagonName}</button>
          <button type="button" className="secondary-button" aria-label={`Добавить КТК в вагон ${wagonName}`} onClick={() => addContainer(wagon.key)}>+ Добавить КТК</button></div>
      </th></tr>)
      if (!wagonOpen) continue
      if (!wagon.containers.length) rows.push(empty('КТК в вагоне не добавлены', key + '-empty'))
      wagon.containers.forEach((row, index) => {
        const option = containers.find(item => item.id === row.containerId)
        const label = `КТК ${index + 1} вагона ${wagonIndex + 1}`
        rows.push(<tr className="composition-item" key={key + '-' + index}>
          <td><UiSelect aria-label={label} value={row.containerId} onChange={e => updateContainer(wagon.key, index, selectWaybillContainer(row, containers.find(item => item.id === e.target.value)))}>
            <option value="" hidden disabled />{containers.map(item => <option key={item.id} value={item.id} disabled={item.id !== row.containerId && form.railwayCarriages.some(c => c.containers.some(ct => ct.containerId === item.id))}>{item.name}</option>)}
          </UiSelect></td>
          <td>{option?.type ? containerTypeLabel(option.type) : '—'}</td><td>{row.containerId ? mass(row.tareWeight) : '—'}</td>
          <td><UiInput aria-label={`Масса брутто ${label}`} inputMode="decimal" value={row.grossWeight} onChange={e => updateContainer(wagon.key, index, { grossWeight: e.target.value })} /></td>
          <td><UiInput aria-label={`Масса нетто ${label}`} inputMode="decimal" value={row.netWeightValue ?? netWeight(row) ?? ''} onChange={e => updateContainer(wagon.key, index, { netWeightValue: e.target.value })} /></td>
          <td>{mass(option?.loadCapacity)}</td>
          <td><UiInput aria-label={`Номера ЗПУ ${label}`} maxLength={1000} value={row.sealNumbers ?? ''} onChange={e => updateContainer(wagon.key, index, { sealNumbers: e.target.value })} /></td>
          <td><UiSelect aria-label={`Тип ЗПУ ${label}`} value={row.sealTypeId ?? ''} onChange={e => updateContainer(wagon.key, index, { sealTypeId: e.target.value })}>
            <option value="" hidden disabled />{sealTypes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </UiSelect></td>
          <td className="registry-actions"><button type="button" className="row-clear-button" aria-label={`Удалить ${label}`} onClick={() => updateCarriage(wagon.key, item => ({ ...item, containers: item.containers.filter((_, i) => i !== index) }))}>×</button></td>
        </tr>)
      })
    }
    if (!rows.length) rows.push(empty('Вагоны не добавлены', 'empty'))
  }
  if (open && tab === 'cargo') {
    productRows(form).forEach((row, index) => {
      const danger = dangerProducts.find(item => item.id === row.dangerProductId || (!row.dangerProductId && item.identifier === -1))
      rows.push(<tr className="composition-item" key={index}>
        <td><UiSelect aria-label={`Груз ${index + 1} по ЕТСНГ`} value={row.etsngCodeId} onChange={e => updateProduct(index, { etsngCodeId: e.target.value })}>
          <option value="" hidden disabled />{cargoOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </UiSelect></td>
        <td><UiInput aria-label={`Масса брутто груза ${index + 1}`} inputMode="decimal" value={row.weight} onChange={e => updateProduct(index, { weight: e.target.value })} /></td>
        <td><UiSelect aria-label={`Класс опасности груза ${index + 1}`} value={danger?.id ?? ''} onChange={e => updateProduct(index, { dangerProductId: e.target.value })}>
          <option value="" hidden disabled />{[...new Map(dangerProducts.map(item => [item.dangerClassId, item])).values()].map(item => { const option = danger?.dangerClassId === item.dangerClassId ? danger : item; return <option key={item.dangerClassId} value={option.id}>{item.dangerClassName}</option> })}
        </UiSelect></td>
        <td className="registry-actions">{productRows(form).length > 1 && <button type="button" className="row-clear-button" aria-label={`Удалить груз ${index + 1}`} onClick={() => onChange(current => ({ ...current, products: productRows(current).filter((_, i) => i !== index) }))}>×</button>}</td>
      </tr>)
    })
  }
  return <fieldset className="waybill-hierarchy-editor" disabled={disabled} aria-label="Состав создаваемой накладной">
    {tab === 'wagons' && <div className="waybill-hierarchy-toolbar"><button type="button" className="outline-action-button" onClick={addCarriage}>+ Добавить вагон</button></div>}
    {tab === 'cargo' && <div className="waybill-hierarchy-toolbar"><button type="button" className="outline-action-button" disabled={form.railwayCarriages.reduce((sum, row) => sum + row.containers.length, 0) !== 1} onClick={() => {
      onChange(current => ({ ...current, products: [...productRows(current), { etsngCodeId: '', weight: '' }] }))
      setCollapsed(current => { const next = new Set(current); next.delete('bill'); return next })
    }}>+ Добавить груз</button></div>}
    <div className="table-wrap order-composition-wrap"><table className={`composition-table composition-outline composition-${tab} waybill-draft-table waybill-draft-${tab}`} aria-label={`Состав накладной: ${tab === 'wagons' ? 'вагоны' : tab === 'containers' ? 'КТК' : 'груз'}`}>
      <colgroup><col className="composition-index" />{headings.map((title, index) => <col key={title} className={index === 0 ? 'waybill-hierarchy-number' : undefined} />)}<col className="registry-actions" /></colgroup>
      <thead><tr><th scope="col" className="composition-index">№</th>{headings.map(title => <th scope="col" key={title}>{title}</th>)}<th scope="col" className="registry-actions" aria-label="Действия" /></tr></thead>
      <tbody id={groupId}><tr className="composition-group"><td className="composition-index composition-group-index" rowSpan={rows.length + 1}>1</td><th scope="rowgroup" colSpan={span}>
        <button type="button" aria-expanded={open} aria-controls={groupId} onClick={() => toggle('bill')}><DisclosureChevron />{form.number?.trim() ? `Накладная № ${form.number.trim()}` : 'Новая накладная'}</button>
      </th></tr>{rows}</tbody>
    </table></div>
  </fieldset>
}
