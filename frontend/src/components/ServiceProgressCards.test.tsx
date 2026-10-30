import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServiceProgressCards } from './ServiceProgressCards'
import type { ServiceProgress } from '../serviceOrder'

const progress: ServiceProgress = {
  initialServiceName: 'Приём и вывоз из справочника', returnServiceName: 'Возврат из справочника',
  accepted: 10, shippingCreated: 8, shippingCompleted: 6, returnCreated: 0, returnCompleted: 0,
  total: 10, shippingMissing: 2, shippingOrderCount: 4, shippingOrdersCompleted: 3,
  returnOrderCount: 0, returnOrdersCompleted: 0,
}

function table(html: string, label: string) {
  return html.match(new RegExp(`<tbody[^>]+aria-label="${label}"[^>]*>(.*?)</tbody>`))?.[1] ?? ''
}

describe('Карточки оказания услуг', () => {
  it('разделяет количество КТК и заявок, не добавляя счётчик заявок к приёму', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={progress} />)
    const shipping = table(html, 'Вывоз КТК')
    expect(shipping).toContain('КТК</th><td>8</td><td>6</td>')
    expect(shipping).toContain('Заявки</th><td>4</td><td>3</td>')
    expect(table(html, 'Первоначальная поставка КТК')).toContain('КТК</th><td>10</td><td>10</td>')
    expect(table(html, 'Первоначальная поставка КТК')).not.toContain('Заявки')
    expect(html.match(/<table /g)).toHaveLength(1)
    expect(html).not.toContain(progress.returnServiceName)
    expect(html).toContain('Без заявки на вывоз: 2 КТК')
  })
  it('показывает созданную возвратную заявку с двумя КТК до выполнения', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, returnCreated: 2, returnOrderCount: 1 }} />)
    expect(html).toContain(progress.returnServiceName)
    expect(table(html, 'Возвратная поставка КТК')).toContain('КТК</th><td>2</td><td>0</td>')
    expect(table(html, 'Возвратная поставка КТК')).toContain('Заявки</th><td>1</td><td>0</td>')
  })
  it('показывает состав поставки ещё в черновике', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, accepted: 0, shippingCompleted: 0, shippingOrdersCompleted: 0 }} />)
    expect(table(html, 'Первоначальная поставка КТК')).toContain('КТК</th><td>10</td><td>0</td>')
    expect(table(html, 'Вывоз КТК')).toContain('КТК</th><td>8</td><td>0</td>')
    expect(html).toContain('Поставка КТК')
  })
  it('отображает частичное выполнение возвратов и скрывает подсказку при нуле', () => {
    const html = renderToStaticMarkup(<ServiceProgressCards progress={{ ...progress, shippingMissing: 0, returnCreated: 4, returnCompleted: 2, returnOrderCount: 2, returnOrdersCompleted: 1 }} />)
    expect(table(html, 'Возвратная поставка КТК')).toContain('КТК</th><td>4</td><td>2</td>')
    expect(table(html, 'Возвратная поставка КТК')).toContain('Заявки</th><td>2</td><td>1</td>')
    expect(html).not.toContain('Без заявки на вывоз')
  })
})
