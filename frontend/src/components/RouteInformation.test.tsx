import { renderToStaticMarkup } from 'react-dom/server'
import { RouteInformation } from './RouteInformation'
import { describe, expect, it } from 'vitest'
import { routeIntervalLabel } from '../routes'

describe('Интервал рейса по документации', () => {
  it('показывает часовой интервал в московском времени', () => {
    expect(routeIntervalLabel('2025-09-17T10:00:00Z')).toBe('17.09.2025 13:00 – 14:00')
  })
  it('указывает дату окончания при переходе через полночь', () => {
    expect(routeIntervalLabel('2025-12-31T20:30:00Z')).toBe('31.12.2025 23:30 – 01.01.2026 00:30')
  })
})
// Empty route cards must keep the layout without inventing route data.
it('keeps vehicle fields empty when no route is selected', () => {
  const html = renderToStaticMarkup(<RouteInformation transportType="VEHICLE" routeType="RECEIVING" />)
  expect(html.match(/<dd><\/dd>/g)).toHaveLength(15)
  expect(html).toContain('Логистика')
  expect(html).not.toContain('UTC+3')
  expect(html).not.toContain('Черновик')
})
it('keeps railway direction labels without vehicle fields', () => {
  const html = renderToStaticMarkup(<RouteInformation transportType="RAILWAY" routeType="SHIPPING" />)
  expect(html).toContain('Дата и время вывоза:')
  expect(html.match(/<dd><\/dd>/g)).toHaveLength(7)
  expect(html).not.toContain('Логистика')
})