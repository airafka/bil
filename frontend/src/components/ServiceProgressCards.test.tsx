import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServiceProgressCards } from './ServiceProgressCards'
import type { ServiceProgress } from '../comprehensiveServiceOrder'

const progress: ServiceProgress = {
  serviceName: 'Выбранная услуга из справочника',
  accepted: 10, shippingCreated: 8, shippingCompleted: 6, returnCreated: 0, returnCompleted: 0,
  total: 10, shippingMissing: 2, shippingOrderCount: 4, shippingOrdersCompleted: 3,
  returnOrderCount: 0, returnOrdersCompleted: 0,
}

function stage(html: string, id: string) {
  return html.match(new RegExp(`<section aria-labelledby="${id}-progress-title">(.*?)</section>`))?.[1] ?? ''
}

describe('Карточки этапов услуги', () => {
  it('разделяет заявки и КТК во всех трёх этапах', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={progress} initialOrderStatus="COMPLETED" />)
    expect(stage(html, 'shipping')).toContain('КТК: выполнено 6 из 8')
    expect(stage(html, 'shipping')).toContain('Заявки: выполнено 3 из 4')
    expect(stage(html, 'initial')).toContain('КТК: выполнено 10 из 10')
    expect(stage(html, 'initial')).toContain('Заявки: выполнено 1 из 1')
    expect(html.match(/<section /g)).toHaveLength(3)
    expect(html).toContain('Поставка - ЖД')
    expect(html).toContain('Вывоз - Авто')
    expect(html).toContain('Поставка - Авто')
    expect(html).toContain('Без заявки на вывоз: 2 КТК')
  })
  it('показывает созданную поставку Авто с двумя КТК до выполнения', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, returnCreated: 2, returnOrderCount: 1 }} initialOrderStatus="COMPLETED" />)
    expect(stage(html, 'return')).toContain('КТК: выполнено 0 из 2')
    expect(stage(html, 'return')).toContain('Заявки: выполнено 0 из 1')
  })
  it('определяет выполнение ЖД-заявки по статусу, а не по числу КТК', () => {
    for (const status of ['DRAFT', 'CONFIRMED']) {
      const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, accepted: 0 }} initialOrderStatus={status} />)
      expect(stage(html, 'initial')).toContain('КТК: выполнено 0 из 10')
      expect(stage(html, 'initial')).toContain('Заявки: выполнено 0 из 1')
    }
    const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, total: 0, accepted: 0 }} initialOrderStatus="COMPLETED" />)
    expect(stage(html, 'initial')).toContain('Заявки: выполнено 1 из 1')
  })
  it('отображает частичное выполнение возвратов и скрывает подсказку при нуле', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, shippingMissing: 0, returnCreated: 4, returnCompleted: 2, returnOrderCount: 2, returnOrdersCompleted: 1 }} initialOrderStatus="COMPLETED" />)
    expect(stage(html, 'return')).toContain('КТК: выполнено 2 из 4')
    expect(stage(html, 'return')).toContain('Заявки: выполнено 1 из 2')
    expect(html).not.toContain('Без заявки на вывоз')
  })
})

it('показывает только поставку Авто в отдельной автоуслуге', () => {
  const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, total: 2, returnCreated: 2, returnCompleted: 1, returnOrderCount: 1 }} initialOrderStatus="CONFIRMED" autoReturn />)
  expect(html.match(/<section /g)).toHaveLength(1)
  expect(html).not.toContain('Поставка - ЖД')
  expect(html).not.toContain('Вывоз - Авто')
  expect(html).toContain('КТК: выполнено 1 из 2')
  expect(html).not.toContain('Без заявки на возврат')
})
it('показывает КТК, для которых возврат ещё не создан вручную', () => {
  const html = renderToStaticMarkup(<ServiceProgressCards progress={progress} initialOrderStatus="COMPLETED" />)
  expect(html).toContain('Без заявки на возврат: 10 КТК.')
})
