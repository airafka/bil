import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServiceProgressCards } from './ServiceProgressCards'
import type { ServiceProgress } from '../serviceOrder'

const progress: ServiceProgress = {
  initialServiceName: 'Приём и вывоз из справочника', returnServiceName: 'Возврат из справочника',
  accepted: 10, shippingCreated: 8, shippingCompleted: 6, returnCreated: 0, returnCompleted: 0,
  total: 10, shippingMissing: 2,
}

describe('Карточки оказания услуг', () => {
  it('считает вывоз по созданным заявкам и показывает недостающие КТК отдельно', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={progress} />)
    expect(html).toContain(progress.initialServiceName)
    expect(html).not.toContain(progress.returnServiceName)
    expect(html).toContain('10 / 10')
    expect(html).toContain('8 / 6')
    expect(html).toContain('Без заявки на вывоз: 2')
  })
  it('показывает возвраты уже при создании, до их выполнения', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, returnCreated: 2 }} />)
    expect(html).toContain(progress.returnServiceName)
    expect(html).toContain('2 / 0')
  })
  it('показывает состав поставки ещё в черновике', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, accepted: 0, shippingCompleted: 0 }} />)
    expect(html).toContain('10 / 0')
    expect(html).toContain('8 / 0')
    expect(html).toContain('Всего КТК / Выполнено')
  })
  it('отображает частично выполненные возвратные поставки', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, returnCreated: 4, returnCompleted: 2 }} />)
    expect(html).toContain('4 / 2')
  })
})
