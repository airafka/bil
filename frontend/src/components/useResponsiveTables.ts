import { useEffect } from 'react'
import { tableGeometry } from './tableGeometry'

/** Keep native tables, hierarchy and controls intact; only their frame scrolls. */
export function useResponsiveTables() {
  useEffect(() => {
    const root = document.querySelector('.app-shell')
    if (!root) return
    const tracked = new Map<HTMLTableElement, HTMLElement>()
    let frame = 0
    const update = () => {
      frame = 0
      for (const [table, parent] of tracked) if (!root.contains(table)) { resize.unobserve(parent); tracked.delete(table) }
      root.querySelectorAll<HTMLTableElement>('table').forEach(table => {
        const parent = table.parentElement
        if (!parent) return
        if (!tracked.has(table)) { tracked.set(table, parent); resize.observe(parent) }
        parent.classList.add('responsive-table-scroll')
        table.classList.add('responsive-table')
        const headings = [...(table.tHead?.rows ?? [])].at(-1)
        const columns = [...table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col')]
        const cells = [...(headings?.cells ?? [])]
        const geometry = cells.map((cell, index) => {
          const declared = columns[index]?.style.width || cell.style.width
          const hint = declared?.endsWith('px') ? Number.parseFloat(declared) : 0
          const label = cell.textContent?.trim() || ''
          const fixed = cell.matches('.composition-index,.registry-index,.registry-actions,.cargo-editor-actions,.route-picker-choice,.container-col-index,.container-col-action') || !!columns[index]?.matches('.route-picker-choice') || (hint > 0 && hint <= 60) || !!cell.querySelector('input[type="checkbox"]')
          const width = fixed ? 44 : hint || (/собственник|клиент|договор|услуг|отправитель|получатель|наименование|комментарий/i.test(label) ? 220 : 140)
          return { width, fixed }
        })
        const layout = tableGeometry(parent.clientWidth, geometry, Number(table.dataset.responsiveMinWidth) || 0)
        if (cells.every(cell => cell.colSpan === 1)) cells.forEach((cell, index) => {
          cell.style.setProperty('--responsive-column-width', layout.columns[index] + 'px')
        })
        table.style.setProperty('--responsive-table-width', layout.width + 'px')
        // Keyboard users can scroll the frame without changing table semantics.
        if (layout.width > parent.clientWidth + 1) {
          if (!parent.hasAttribute('tabindex')) { parent.tabIndex = 0; parent.dataset.tableScrollFocus = 'true' }
          if (!parent.hasAttribute('aria-label')) { parent.setAttribute('aria-label', 'Таблица с горизонтальной прокруткой'); parent.dataset.tableScrollLabel = 'true' }
        } else {
          if (parent.dataset.tableScrollFocus) { parent.removeAttribute('tabindex'); delete parent.dataset.tableScrollFocus }
          if (parent.dataset.tableScrollLabel) { parent.removeAttribute('aria-label'); delete parent.dataset.tableScrollLabel }
        }
      })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const resize = new ResizeObserver(schedule)
    const mutation = new MutationObserver(schedule)
    mutation.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] })
    update()
    window.addEventListener('resize', schedule)
    return () => { mutation.disconnect(); resize.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame) }
  }, [])
}
