import { useId, useState } from 'react'
import type { ReferenceOption } from '../domain'
import { containerCargoItems, type SelectedContainer, type SelectedContainerCargo } from '../orderForm'
import { UiInput, UiSelect } from './FormControls'
import { RowActions } from './RowActions'
import { DisclosureChevron } from './WaybillCompositionTable'

type Props = {
  containers: SelectedContainer[]
  cargoOptions: ReferenceOption[]
  disabled?: boolean
  onChange: (containerId: string, items: SelectedContainerCargo[]) => void
}

export function VehicleCargoEditor({ containers, cargoOptions, disabled = false, onChange }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const prefix = useId()
  const toggle = (id: string) => setCollapsed(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  return <div className="table-wrap order-composition-wrap">
    <table className="composition-table composition-outline vehicle-cargo-table vehicle-cargo-editor" aria-label="Добавление груза по КТК">
      <colgroup><col className="composition-index" /><col /><col /><col /><col className="cargo-editor-actions" /></colgroup>
      <thead><tr><th scope="col">№</th><th scope="col">Код ЕТСНГ <span className="cargo-required">*</span></th><th scope="col">Наименование груза</th><th scope="col">Масса брутто, кг <span className="cargo-required">*</span></th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead>
      {containers.filter(container => !container.empty).map((container, index) => {
        const items = containerCargoItems(container)
        const open = !collapsed.has(container.id)
        const groupId = `${prefix}-${container.id}`
        const addCargo = () => {
          onChange(container.id, [...items, { etsngCodeId: '', weight: '' }])
          setCollapsed(current => { const next = new Set(current); next.delete(container.id); return next })
        }
        return <tbody key={container.id} id={groupId}>
          <tr className="composition-group">
            <td className="composition-index composition-group-index" rowSpan={open ? items.length + 1 : 1}>{index + 1}</td>
            <th colSpan={4} scope="rowgroup"><div className="cargo-editor-group">
              <button type="button" aria-expanded={open} aria-controls={groupId} onClick={() => toggle(container.id)}><DisclosureChevron />КТК № {container.name}</button>
              <button type="button" className="cargo-editor-add" disabled={disabled} aria-label={`Добавить груз для ${container.name}`} onClick={addCargo}>⊕ Добавить груз</button>
            </div></th>
          </tr>
          {open && items.map((item, cargoIndex) => {
            const option = cargoOptions.find(option => option.id === item.etsngCodeId)
            const name = option?.name.replace(/^\d{6}\s*(?:[—–-]\s*)?/, '') || '—'
            const label = `${container.name}, груз ${cargoIndex + 1}`
            const update = (field: keyof SelectedContainerCargo, value: string) => onChange(container.id, items.map((cargo, i) => i === cargoIndex ? { ...cargo, [field]: value } : cargo))
            return <tr key={cargoIndex} className="composition-item">
              <td><UiSelect required disabled={disabled} aria-label={`Код ЕТСНГ: ${label}`} value={item.etsngCodeId} onChange={event => update('etsngCodeId', event.target.value)}>
                <option value="" hidden disabled />
                {cargoOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
              </UiSelect></td>
              <td>{name}</td>
              <td><UiInput required disabled={disabled} aria-label={`Масса брутто, кг: ${label}`} inputMode="decimal" placeholder="Введите массу" value={item.weight} onChange={event => update('weight', event.target.value)} /></td>
              <td><RowActions label={`Действия с грузом: ${label}`} disabled={disabled} actions={[
                { label: 'Добавить груз', onClick: addCargo },
                { label: 'Удалить', onClick: () => onChange(container.id, items.filter((_, i) => i !== cargoIndex)) },
              ]} /></td>
            </tr>
          })}
        </tbody>
      })}
    </table>
  </div>
}
