import type { SelectedContainer } from './orderForm'
import { containerPayload, validateContainerCargo } from './orderForm'
export type DraftContainerAddition = { key: string; railwayCarriageId?: string; container: SelectedContainer }
export function containerAdditionsPayload(rows: DraftContainerAddition[], existingIds: string[]) {
  const errors: string[] = [], ids=new Set(existingIds)
  for (const row of rows) {
    if(!row.container.id)errors.push('Выберите номер каждого добавляемого КТК')
    else if(ids.has(row.container.id))errors.push(`КТК ${row.container.name} уже включён в заявку`)
    ids.add(row.container.id)
  }
  validateContainerCargo(rows.map(row=>row.container),errors)
  if(errors.length)throw new Error([...new Set(errors)].join('. '))
  return rows.map(row=>({container:containerPayload(row.container),...(row.railwayCarriageId?{railwayCarriageId:row.railwayCarriageId}:{})}))
}
