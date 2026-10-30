import { useState } from 'react'
import type { OrderDetails } from '../domain'

export function VehicleReceivingCargoTable({ containers }: { containers: OrderDetails['containers'] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setCollapsed(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const loadedContainers = containers.filter(container => !container.empty && container.cargo)
  if (!loadedContainers.length) return null
  return <section className="form-section composition-section"><div className="table-wrap order-composition-wrap">
    <table className="composition-table composition-outline vehicle-cargo-table" aria-label="Груз по КТК">
      <thead><tr><th className="composition-index" scope="col">№</th><th scope="col">Код ЕТСНГ</th><th scope="col">Наименование груза</th><th scope="col">Масса груза, кг</th></tr></thead>
      {loadedContainers.map((container, index) => {
        const cargo = !container.empty ? container.cargo : null
        const open = !!cargo && !collapsed.has(container.containerId)
        const parts = cargo?.etsngCodeName.match(/^(\d{6})\s*(?:[—–-]\s*)?(.*)$/)
        return <tbody key={container.containerId}>
          <tr className="composition-group"><td className="composition-index composition-group-index" rowSpan={open ? 2 : 1}>{index + 1}</td>
            <th colSpan={3} scope="rowgroup">{cargo ? <button type="button" aria-expanded={open} onClick={() => toggle(container.containerId)}><svg className="composition-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4 10 8 6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>КТК № {container.containerName}</button> : <span className="cargo-container-label">КТК № {container.containerName}</span>}</th>
          </tr>
          {open && cargo && <tr className="composition-item"><td><span className="composition-value">{parts?.[1] || cargo.etsngCodeName}</span></td><td>{parts?.[2] || '—'}</td><td>{cargo.weight.toLocaleString('ru-RU', { maximumFractionDigits: 3 })}</td></tr>}
        </tbody>
      })}
      {!containers.length && <tbody><tr><td colSpan={4} className="composition-empty">КТК не найдены</td></tr></tbody>}
    </table>
  </div></section>
}
