import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReceivingContainerAttributes } from './ReceivingContainerAttributes'

it('renders one container row with state and all attributes', () => {
  const html = renderToStaticMarkup(<ReceivingContainerAttributes showState containers={[{ id: 'c', name: 'DLRU0031010', empty: true, ownerClientName: 'Owner', sealNumbers: '0001', sealTypeName: 'Seal', hazardClassName: 'Hazard' }]} />)
  expect(html.match(/DLRU0031010/g)).toHaveLength(1)
  expect(html.match(/<table /g)).toHaveLength(1)
  for (const value of ['Порожний', 'Owner', '0001', 'Seal', 'Hazard']) expect(html).toContain(value)
})
