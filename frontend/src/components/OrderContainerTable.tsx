import { Notification } from './Notification'
import { useEffect, useId, useState, type ReactNode } from 'react'
import type { ReceivingContainerAttributes, ReferenceOption } from '../domain'
import { containerTypeLabel } from '../domain'
import { getReferenceOptions, lookupContainerStock } from '../api'
import type { ContainerStockLookup } from '../containerStock'
import { ContainerStatusBadge } from './ContainerStatusBadge'
import { UiInput, UiSelect } from './FormControls'
import './OrderContainerTable.css'
import { DisclosureChevron } from './WaybillCompositionTable'

export type ContainerTableRow = ReceivingContainerAttributes & {
  key: string
  containerId: string
  name: string
  empty: boolean
  containerStatus?: string | null
  readOnly?: boolean
  containerType?: import('../domain').ContainerType | null
  loadCapacity?: number | null
  tareWeight?: number | null
  grossWeight?: number | null
}
export type ContainerTableGroup = { key: string; label: string; hint?: string; rows: ContainerTableRow[]; children?: ContainerTableGroup[] }
type Change = ReceivingContainerAttributes & { empty?: boolean }
type Props = {
  rows: ContainerTableRow[]
  groups?: ContainerTableGroup[]
  showPhysicalAttributes?: boolean
  columnWidths?: number[]
  attributesReadOnly?: boolean
  ownerReadOnly?: boolean
  defaultOwnerId?: string
  options?: ReferenceOption[]
  selectedIds?: string[]
  onSelect?: (key: string, id: string) => void
  onChange?: (key: string, change: Change) => void
  onRemove?: (key: string) => void
  onAdd?: () => void
  selectableKeys?: string[]
  removableKeys?: string[]
  addDisabled?: boolean
  allowEmptyEdit?: boolean
}
export function OrderContainerTable({ rows, attributesReadOnly = false, ownerReadOnly = false, defaultOwnerId, options = [], selectedIds, onSelect, onChange, onRemove, onAdd, allowEmptyEdit = false, selectableKeys, removableKeys, addDisabled = false, groups, showPhysicalAttributes = false, columnWidths }: Props) {
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set())
  const groupPrefix=useId()
  const [references, setReferences] = useState<ReferenceOption[][]>([[], [], []])
  const [stock, setStock] = useState<Record<string, ContainerStockLookup>>({})
  const [referenceError, setReferenceError] = useState('')
  const [stockError, setStockError] = useState('')
  const [loading, setLoading] = useState(false)
  const editing = !!onChange
  const selecting = !!onSelect
  const idsKey = [...new Set(rows.map(row => row.containerId).filter(Boolean))].sort().join(',')
  useEffect(() => {
    if (!editing) return
    let active = true
    Promise.all([ownerReadOnly ? Promise.resolve([]) : getReferenceOptions('clients'), getReferenceOptions('seal-types'), getReferenceOptions('hazard-classes')])
      .then(value => { if (active) { setReferences(value); setReferenceError('') } })
      .catch(error => { if (active) setReferenceError(error instanceof Error ? error.message : 'Не удалось загрузить справочники') })
    return () => { active = false }
  }, [editing, ownerReadOnly])
  useEffect(() => {
    if (!selecting || !idsKey) return
    let active = true
    lookupContainerStock(idsKey.split(','))
      .then(value => { if (active) { setStock(Object.fromEntries(value.map(item => [item.containerId, item]))); setStockError('') } })
      .catch(error => { if (active) setStockError(error instanceof Error ? error.message : 'Не удалось загрузить данные КТК') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selecting, idsKey])
  const select = (row: ContainerTableRow, key: 'ownerClientId' | 'sealTypeId' | 'hazardClassId', label: string, items: ReferenceOption[], name?: string | null) => {
    const value = row[key] ?? (key === 'ownerClientId' ? defaultOwnerId : '') ?? ''
    return <UiSelect aria-label={`${label} — ${row.name || 'строка ' + (rows.findIndex(item => item.key === row.key) + 1)}`} value={value} disabled={!row.containerId || !!referenceError}
      onChange={event => onChange?.(row.key, { [key]: event.target.value || null })}>
      <option value="" hidden disabled />
      {value && !items.some(item => item.id === value) && <option value={value}>{name || value}</option>}
      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </UiSelect>
  }
  const showActions = !groups || !!onRemove
  const columnCount=(showPhysicalAttributes?12:8)+(showActions?1:0)
  const mass=(value: number|null|undefined)=>value==null?'—':value.toLocaleString('ru-RU',{maximumFractionDigits:3})
  const toggle=(key:string)=>setCollapsed(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next})
  function renderRow(row:ContainerTableRow,index:number,grouped=false) {
    const rowSelecting=selecting&&!row.readOnly&&(!selectableKeys||selectableKeys.includes(row.key))
    const rowEditing=editing&&!row.readOnly
    const currentStock=stock[row.containerId]
    const ownerName=rowSelecting&&ownerReadOnly?currentStock?.ownerClientName:row.ownerClientName
    const dangerCell=<td>{rowEditing&&!attributesReadOnly?select(row,'hazardClassId','Класс опасности груза',references[2],row.hazardClassName):row.hazardClassName||'—'}</td>
    return <tr key={row.key} className={grouped?'container-child-row':undefined}>
      {!grouped&&<td>{index+1}</td>}
      <td>{onSelect&&rowSelecting?<UiSelect aria-label={'Номер КТК — строка '+(index+1)} value={row.containerId} onChange={event=>{setLoading(true);onSelect(row.key,event.target.value)}}><option value="" hidden disabled />{options.map(option=><option key={option.id} value={option.id} disabled={row.containerId!==option.id&&(selectedIds??rows.map(item=>item.containerId)).includes(option.id)}>{option.name}</option>)}</UiSelect>:<span>{row.name}</span>}</td>
      {showPhysicalAttributes&&<><td>{row.containerType?containerTypeLabel(row.containerType):'—'}</td><td>{mass(row.tareWeight)}</td><td>{mass(row.grossWeight)}</td><td>{mass(row.loadCapacity)}</td></>}
      <td>{rowEditing&&!ownerReadOnly?select(row,'ownerClientId','Собственник КТК',references[0],row.ownerClientName):<span className="container-readonly" title={ownerName||undefined}>{ownerName||(loading&&row.containerId?'Загрузка…':'—')}</span>}</td>
      <td>{rowEditing&&!attributesReadOnly?<UiInput aria-label={'Номера ЗПУ — '+row.name} disabled={!row.containerId} value={row.sealNumbers??''} maxLength={1000} placeholder="Введите номера" onChange={event=>onChange?.(row.key,{sealNumbers:event.target.value})}/>:row.sealNumbers||'—'}</td>
      <td>{rowEditing&&!attributesReadOnly?select(row,'sealTypeId','Тип ЗПУ',references[1],row.sealTypeName):row.sealTypeName||'—'}</td>

      {!showPhysicalAttributes&&dangerCell}
      <td className="container-empty-cell"><UiInput type="checkbox" aria-label={'Порожний — '+(row.name||'строка '+(index+1))} checked={row.empty} disabled={!row.containerId||!allowEmptyEdit||row.readOnly||!!selectableKeys&&!selectableKeys.includes(row.key)} onChange={event=>onChange?.(row.key,{empty:event.target.checked})}/></td>
      {showPhysicalAttributes&&dangerCell}
      <td><ContainerStatusBadge status={row.containerStatus??currentStock?.status}/></td>
      {showActions&&<td>{onRemove&&(!removableKeys||removableKeys.includes(row.key))&&<button type="button" className="row-clear-button" aria-label={'Удалить КТК — строка '+(index+1)} onClick={()=>onRemove(row.key)}>×</button>}</td>}
    </tr>
  }
  return <div className="order-container-section">

    {(referenceError||stockError)&&<Notification kind="error">{referenceError||stockError}</Notification>}
    <div className="order-container-scroll"><table className={'order-container-table'+(groups?' order-container-table--grouped composition-table composition-outline composition-containers':'')+(showPhysicalAttributes?' order-container-table--physical':'')} aria-label="КТК заявки">
      {columnWidths ? <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup> : <colgroup><col className="container-col-index"/><col className="container-col-number"/>{showPhysicalAttributes&&<><col className="container-col-type"/><col className="container-col-mass"/><col className="container-col-mass"/><col className="container-col-mass"/></>}<col className="container-col-owner"/><col/><col/>{showPhysicalAttributes?<><col className="container-col-empty"/><col className="container-col-danger"/></>:<><col className="container-col-danger"/><col className="container-col-empty"/></>}<col className="container-col-status"/>{showActions&&<col className="container-col-action"/>}</colgroup>}
      <thead><tr><th className="composition-index">№</th><th className="container-col-number">Номер КТК{selecting&&<b> *</b>}</th>{showPhysicalAttributes&&<><th>Тип КТК</th><th>Масса тары, кг</th><th>Масса брутто, кг</th><th>Грузоподъёмность, кг</th></>}<th>Собственник КТК</th><th>Номера ЗПУ</th><th>Тип ЗПУ</th>{showPhysicalAttributes?<><th className="container-col-empty">Порожний</th><th>Класс опасности груза</th></>:<><th>Класс опасности груза</th><th className="container-col-empty">Порожний</th></>}<th className="container-col-status">Статус КТК</th>{showActions&&<th className="registry-actions" aria-label="Действия"/>}</tr></thead>
      {groups?.length?groups.map((group,index)=>{
        const open=!collapsed.has(group.key),id=groupPrefix+'-'+group.key
        const children: ReactNode[]=[]
        if(open) {
          for(const wagon of group.children??[]) {
            const wagonOpen=!collapsed.has(wagon.key)
            children.push(<tr className="composition-subgroup" key={wagon.key}><th colSpan={columnCount-1} scope="row"><button type="button" aria-expanded={wagonOpen} onClick={()=>toggle(wagon.key)}><DisclosureChevron/>{wagon.label}</button></th></tr>)
            if(wagonOpen) children.push(...(wagon.rows.length?wagon.rows.map((row,i)=>renderRow(row,i,true)):[<tr key={wagon.key+'-empty'}><td colSpan={columnCount-1} className="composition-empty">КТК в вагоне нет</td></tr>]))
          }
          if(!group.children?.length) children.push(...(group.rows.length?group.rows.map((row,i)=>renderRow(row,i,true)):[<tr key={group.key+'-empty'}><td colSpan={columnCount-1} className="composition-empty">КТК нет</td></tr>]))
        }
        return <tbody key={group.key} id={id}>
          <tr className="composition-group"><td rowSpan={1+children.length} className="composition-index composition-group-index">{index+1}</td><th colSpan={columnCount-1} scope="rowgroup">
            <button type="button" aria-expanded={open} aria-controls={id} onClick={()=>toggle(group.key)}><DisclosureChevron/>{group.label}</button>
          </th></tr>
          {children}
        </tbody>
      }):<tbody>{rows.map((row,index)=>renderRow(row,index))}{!rows.length&&<tr><td colSpan={columnCount} className="inline-empty">КТК не выбраны</td></tr>}</tbody>}
    </table></div>
    {onAdd&&<div className="ktk-toolbar table-bottom-toolbar"><button type="button" className="outline-action-button" disabled={addDisabled} onClick={onAdd}>⊕ Добавить</button></div>}
  </div>
}
