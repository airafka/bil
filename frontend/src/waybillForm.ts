import type { ReferenceOption } from './domain'

export type WaybillContainerRow = Pick<import('./domain').ReceivingContainerAttributes, 'sealNumbers' | 'sealTypeId'> & {
  owner?: string
  containerId: string
  grossWeight: string
  tareWeight: number
  netWeightValue?: string
}
export type WaybillCarriageRow = { key: number; railwayCarriageId: string; containers: WaybillContainerRow[] }
export type WaybillFormState = {
  number?: string
  products?: Array<{ etsngCodeId: string; weight: string; dangerProductId?: string; signDanger?: string }>
  hazardClassId?: string
  etsngCodeId: string
  receivingOrderId: string; departureStation: string; destinationStation: string; payer: string
  railwayCarriages: WaybillCarriageRow[]
}
export type CreateWaybillPayload = {
  number?: string
  products: Array<{ etsngCodeId: string; weight: string; dangerProductId?: string; signDanger?: string }>
  hazardClassId?: string | null
  etsngCodeId: string | null
  receivingOrderId: string | null; departureStation: number; destinationStation: number; payer: string
  railwayCarriages: Array<{ railwayCarriageId: string; containers: Array<{ containerId: string; grossWeight: string; netWeight: string }> }>
}
export const initialWaybillFormState: WaybillFormState = {
  etsngCodeId: '', receivingOrderId: '', departureStation: '', destinationStation: '', payer: '', railwayCarriages: [],
}

// Work in grams so decimal subtraction has no floating-point rounding error.
export function massInGrams(value: string | number): bigint | null {
  const normalized = String(value).trim().replace(',', '.')
  if (!/^\d{1,13}(\.\d{1,3})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'))
}
export function netWeight(row: WaybillContainerRow): string | null {
  if (row.netWeightValue !== undefined && row.netWeightValue !== '') {
    const explicit = massInGrams(row.netWeightValue), gross = massInGrams(row.grossWeight)
    if (explicit === null || gross === null || explicit > gross) return null
    return `${explicit / 1000n}.${String(explicit % 1000n).padStart(3, '0')}`
  }
  const gross = massInGrams(row.grossWeight), tare = massInGrams(row.tareWeight)
  if (gross === null || tare === null || gross < tare) return null
  const grams = gross - tare
  return `${grams / 1000n}.${String(grams % 1000n).padStart(3, '0')}`
}
export function selectWaybillContainer(row: WaybillContainerRow, option?: ReferenceOption): WaybillContainerRow {
  return { ...row, containerId: option?.id ?? '', tareWeight: option?.tareWeight ?? 0, netWeightValue: undefined }
}
export function validateWaybillStep(state: WaybillFormState, step: number): string[] {
  const errors: string[] = []
  if (step >= 1) {
    if (!/^[-+]?\d+$/.test(state.departureStation)) errors.push('Введите станцию отправления целым числом')
    if (!/^[-+]?\d+$/.test(state.destinationStation)) errors.push('Введите станцию назначения целым числом')
    if (!state.payer.trim()) errors.push('Введите плательщика')
  }
  const carriages = new Set<string>(), containers = new Set<string>()
  for (const [i, carriage] of state.railwayCarriages.entries()) {
    if (step >= 2) {
      if (!carriage.railwayCarriageId) errors.push(`Выберите вагон в строке ${i + 1}`)
      else if (carriages.has(carriage.railwayCarriageId)) errors.push('Вагон не может повторяться в накладной')
      carriages.add(carriage.railwayCarriageId)
    }
    if (step < 3) continue
    for (const [j, container] of carriage.containers.entries()) {
      const label = `КТК ${j + 1} вагона ${i + 1}`
      if (!container.containerId) errors.push(`Выберите ${label}`)
      else if (containers.has(container.containerId)) errors.push('КТК не может повторяться в накладной')
      containers.add(container.containerId)
      const gross = massInGrams(container.grossWeight), tare = massInGrams(container.tareWeight)
      if (gross === null || gross <= 0n) errors.push(`${label}: укажите положительную массу брутто с точностью до 0,001 кг`)
      else if (tare === null || tare <= 0n) errors.push(`${label}: в справочнике отсутствует масса тары`)
      else if (netWeight(container) === null) errors.push(`${label}: нетто должно быть от нуля до брутто, с точностью до 0,001 кг`)
    }
  }
  if (step >= 4) {
    const products = productRows(state)
    if (!products.length || products.some(p => !p.etsngCodeId)) errors.push('выберите груз по ЕТСНГ для каждой строки накладной')
    if (products.length > 1 && containers.size !== 1) errors.push('Для нескольких грузов в накладной должен быть ровно один КТК')
    if (products.some(p => massInGrams(p.weight) === null)) errors.push('Укажите неотрицательную массу каждого груза с точностью до 0,001 кг')
  }
  return errors
}
export function totalNetWeight(state: WaybillFormState): string {
  const grams = state.railwayCarriages.flatMap(c => c.containers).reduce((sum, c) => sum + (massInGrams(netWeight(c) ?? '0') ?? 0n), 0n)
  return `${grams / 1000n}.${String(grams % 1000n).padStart(3, '0')}`
}
export function productRows(state: WaybillFormState) {
  return state.products ?? [{ etsngCodeId: state.etsngCodeId, weight: totalNetWeight(state), signDanger: undefined, dangerProductId: undefined as string | undefined }]
}
export const validateWaybillForm = (state: WaybillFormState) => validateWaybillStep(state, 4)
export function buildWaybillPayload(state: WaybillFormState): CreateWaybillPayload {
  return {
    ...(state.number?.trim() ? { number: state.number.trim() } : {}),
    products: productRows(state).map(p => ({ etsngCodeId: p.etsngCodeId, weight: p.weight.trim().replace(',', '.'), ...(p.dangerProductId ? { dangerProductId: p.dangerProductId } : {}), ...(p.signDanger?.trim() ? { signDanger: p.signDanger.trim() } : {}) })),
    etsngCodeId: null,
    receivingOrderId: state.receivingOrderId || null,
    departureStation: Number(state.departureStation), destinationStation: Number(state.destinationStation), payer: state.payer.trim(),
    railwayCarriages: state.railwayCarriages.map(carriage => ({
      railwayCarriageId: carriage.railwayCarriageId,
      containers: carriage.containers.map(row => ({ containerId: row.containerId,
        grossWeight: row.grossWeight.trim().replace(',', '.'),
        netWeight: netWeight(row) ?? '',
        ...(row.owner?.trim() ? { owner: row.owner.trim() } : {}),
        ...(row.sealNumbers?.trim() ? { sealNumbers: row.sealNumbers.trim() } : {}),
        ...(row.sealTypeId ? { sealTypeId: row.sealTypeId } : {}),
      })),
    })),
  }
}

export function hasLoadedContainers(state: WaybillFormState): boolean {
  return state.railwayCarriages.some(carriage => carriage.containers.some(row => {
    const net = netWeight(row)
    return net !== null && net !== '0.000'
  }))
}
