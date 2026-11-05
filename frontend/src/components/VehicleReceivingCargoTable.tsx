import { useId, useState } from 'react'
import type { OrderDetails } from '../domain'
import { DisclosureChevron } from './WaybillCompositionTable'

export function VehicleReceivingCargoTable({ containers }: { containers: OrderDetails['containers'] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const prefix = useId()
  const toggle = (id: string) => setCollapsed(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const groups = containers.filter(container => !container.empty).map(container => ({
    ...container, items: container.cargoItems ?? (container.cargo ? [container.cargo] : []),
  })).filter(container => container.items.length > 0)
  if (!groups.length) return null
  return <section className="form-section composition-section vehicle-cargo-section"><div className="table-wrap order-composition-wrap">
    <table className="composition-table composition-outline vehicle-cargo-table" aria-label="Груз по КТК">
      <thead><tr><th className="composition-index" scope="col">№</th><th scope="col">Код ЕТСНГ</th><th scope="col">Наименование груза</th><th scope="col">Масса брутто, кг</th><th scope="col">Класс опасности груза</th></tr></thead>
      {groups.map((container, index) => {
        const open = !collapsed.has(container.containerId)
        const groupId = prefix + '-' + container.containerId
        return <tbody key={container.containerId} id={groupId}>
          <tr className="composition-group"><td className="composition-index composition-group-index" rowSpan={open ? 1 + container.items.length : 1}>{index + 1}</td>
            <th colSpan={4} scope="rowgroup"><button type="button" aria-expanded={open} aria-controls={groupId} onClick={() => toggle(container.containerId)}><DisclosureChevron />КТК № {container.containerName}</button></th>
          </tr>
          {open && container.items.map((item, cargoIndex) => {
            const parts = item.etsngCodeName.match(/^(\d{6})\s*(?:[—–-]\s*)?(.*)$/)
            return <tr key={cargoIndex} className="composition-item"><td><span className="composition-value">{parts?.[1] || item.etsngCodeName}</span></td><td>{parts?.[2] || '—'}</td><td>{item.weight.toLocaleString('ru-RU', { maximumFractionDigits: 3 })}</td><td>{container.hazardClassName || '—'}</td></tr>
          })}
        </tbody>
      })}
    </table>
  </div></section>
}
