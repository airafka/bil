import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VehicleReceivingCargoTable } from './VehicleReceivingCargoTable'

it('renders nothing when no containers have cargo', () => {
  const html = renderToStaticMarkup(<VehicleReceivingCargoTable containers={[
    { containerId: 'empty', containerName: 'EMPTY001', empty: true, cargo: null },
    { containerId: 'missing', containerName: 'MISSING001', empty: false, cargo: null },
  ]} />)
  expect(html).toBe('')
  expect(html).not.toContain('MISSING001')
  expect(html).not.toContain('composition-item')
  expect(html).not.toContain('<button')
})

it('renders actual cargo under its container with separate ETSNG code and name', () => {
  const html = renderToStaticMarkup(<VehicleReceivingCargoTable containers={[
    { containerId: 'loaded', containerName: 'LOADED001', empty: false, cargo: { etsngCodeId: 'wheat', etsngCodeName: '011005 — ПШЕНИЦА', weight: 250 } },
  ]} />)
  expect(html).toContain('aria-expanded="true"')
  expect(html).toContain('composition-item')
  expect(html).toContain('011005</span>')
  expect(html).toContain('<td>ПШЕНИЦА</td>')
  expect(html).toContain('<td>250</td>')
})
