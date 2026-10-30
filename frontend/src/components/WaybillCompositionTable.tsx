import { containerTypeLabel } from '../domain'
import { useId, useState, type ReactNode } from 'react'
import type { OrderWaybillProductDetails, WaybillCarriageSummary, WaybillContainerSummary, WaybillProductSummary } from '../domain'

export type CompositionTab = 'wagons' | 'containers' | 'cargo'
export type CompositionWaybill = {
  id: string
  number: string
  departureStation: number
  destinationStation: number
  railwayCarriages?: WaybillCarriageSummary[]
  containers?: WaybillContainerSummary[]
  railwayCarriageCount?: number
  containerCount?: number
  products: (WaybillProductSummary | OrderWaybillProductDetails)[]
}

const headings: Record<CompositionTab, string[]> = {
  wagons: ['Номер вагона', 'Род вагона', 'Модель вагона', 'Грузоподъёмность, кг', 'Дата следующего ДР'],
  containers: ['Номер КТК', 'Тип КТК', 'Масса тары, кг', 'Масса брутто, кг', 'Грузоподъёмность, кг', 'Собственник КТК', 'Номера ЗПУ', 'Тип ЗПУ'],
  cargo: ['Код ЕТСНГ', 'Наименование груза', 'Масса брутто, кг', 'Класс опасности груза'],
}
const titles: Record<CompositionTab, string> = { wagons: 'Вагоны', containers: 'КТК', cargo: 'Груз' }
const weight = (value: number | null) => value == null ? 'Не указана' : value.toLocaleString('ru-RU', { maximumFractionDigits: 3 })

export function WaybillCompositionTable({ waybills, tab, draft = false, wagonAttributes = false }: {
  waybills: CompositionWaybill[]; tab: CompositionTab; draft?: boolean; wagonAttributes?: boolean
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const prefix = useId()
  const columns = tab === 'wagons' && !wagonAttributes ? ['Номер вагона'] : headings[tab]
  const toggle = (key: string) => setCollapsed(current => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })
  function cells(values: ReactNode[], key: string) {
    return <tr key={key} className="composition-item">{values.map((value, index) => <td key={index}>
      <span className="composition-value">{value}</span>
    </td>)}</tr>
  }
  function containers(rows: WaybillContainerSummary[], key: string) {
    return rows.map(item => cells([item.number, item.type ? containerTypeLabel(item.type) : '—', weight(item.tareWeight), weight(item.grossWeight), item.loadCapacity == null ? '—' : weight(item.loadCapacity), item.ownerClientName || '—', item.sealNumbers || '—', item.sealTypeName || '—'], `${key}-${item.containerId}`))
  }
  function empty(text: string, key: string) { return <tr key={key}><td colSpan={columns.length} className="composition-empty">{text}</td></tr> }

  return <section className="form-section composition-section" aria-label={titles[tab]}>
    {draft && <p className="composition-hint">Состав получен из выбранных накладных. Чтобы изменить его, вернитесь на вкладку «Накладные».</p>}
    <div className="table-wrap order-composition-wrap"><table className={`composition-table composition-outline composition-${tab} ${draft ? 'composition-draft' : ''}`} aria-label={`${titles[tab]} по накладным`}>
      <thead><tr><th scope="col" className="composition-index">№</th>{columns.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      {waybills.length === 0 && <tbody><tr><td colSpan={columns.length + 1} className="composition-empty">Накладные не выбраны</td></tr></tbody>}
      {waybills.map((bill, billIndex) => {
        const open = !collapsed.has(bill.id)
        const groupId = `${prefix}-${tab}-${bill.id}`
        const rows: ReactNode[] = []
        if (open) {
          if (tab === 'wagons') {
            rows.push(...(bill.railwayCarriages?.length ? bill.railwayCarriages.map(wagon => cells(wagonAttributes ? [wagon.number, wagon.typeName || '—', wagon.modelName || '—', wagon.loadCapacity == null ? '—' : weight(wagon.loadCapacity), wagon.nextDepotRepairDate ? wagon.nextDepotRepairDate.split('-').reverse().join('.') : '—'] : [wagon.number], wagon.id))
              : [empty(bill.railwayCarriageCount ? `Вагонов: ${bill.railwayCarriageCount}. Детальный состав недоступен.` : 'Вагонов нет', bill.id)]))
          } else if (tab === 'containers') {
            if (bill.railwayCarriages?.length) {
              for (const wagon of bill.railwayCarriages) {
                const key = `${bill.id}-${wagon.id}`
                const wagonOpen = !collapsed.has(key)
                rows.push(<tr className="composition-subgroup" key={key}><th colSpan={columns.length} scope="row">
                  <button type="button" aria-expanded={wagonOpen} onClick={() => toggle(key)}><DisclosureChevron />Вагон № {wagon.number}</button>
                </th></tr>)
                if (wagonOpen) rows.push(...(wagon.containers.length ? containers(wagon.containers, key) : [empty('КТК в вагоне нет', `${key}-empty`)]))
              }
            } else rows.push(...(bill.containers?.length ? containers(bill.containers, bill.id) : [empty(bill.containerCount ? `КТК: ${bill.containerCount}. Детальный состав недоступен.` : 'КТК нет', bill.id)]))
          } else {
            rows.push(...(bill.products.length ? bill.products.map(product => {
              const [code, ...name] = 'etsngCode' in product ? product.etsngCode.split(/\s+[—–-]\s+/) : [product.code, product.name]
              return cells([code, name.join(' — ') || '—', weight(product.grossWeight ?? null), product.hazardClassName || '—'], product.id)
            }) : [empty('Грузов нет', bill.id)]))
          }
        }
        return <tbody key={bill.id} id={groupId}>
          <tr className="composition-group">
            <td rowSpan={1 + rows.length} className="composition-index composition-group-index">{billIndex + 1}</td>
            <th scope="rowgroup" colSpan={columns.length}>
              <button type="button" aria-expanded={open} aria-controls={groupId} onClick={() => toggle(bill.id)}><DisclosureChevron />Накладная № {bill.number}</button>
            </th>
          </tr>
          {rows}
        </tbody>
      })}
    </table></div>
  </section>
}

function DisclosureChevron() {
  return <svg className="composition-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path d="M6 4 L10 8 L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
