import type { SelectedWaybill } from './orderForm'

export type AvailableOrderService = {
  id: string
  name: string
  minWaybillContainers?: number | null
  maxWaybillContainers?: number | null
}

function accepts(service: AvailableOrderService, count: number) {
  return (service.minWaybillContainers == null || count >= service.minWaybillContainers)
    && (service.maxWaybillContainers == null || count <= service.maxWaybillContainers)
}

export function validateServiceWaybills(services: AvailableOrderService[], serviceId: string,
  waybills: Pick<SelectedWaybill, 'number' | 'containerCount'>[]): string[] {
  const selected = services.find(service => service.id === serviceId)
  if (!selected) return ['Выберите доступную комплексную услугу']
  return waybills.filter(bill => !accepts(selected, bill.containerCount)).map(bill => {
    const matching = services.find(service => accepts(service, bill.containerCount))
    const recommendation = matching ? 'Необходимо выбрать услугу «' + matching.name + '».' : 'Выберите другую накладную.'
    return 'В накладной №' + bill.number + ' — ' + bill.containerCount + ' КТК. Количество КТК не соответствует выбранной услуге. ' + recommendation
  })
}
