import { useEffect } from 'react'

/** Enhance native tables without replacing their controls, focus or React state. */
export function useResponsiveTables() {
  useEffect(() => {
    const root = document.querySelector('.app-shell')
    if (!root) return
    const tracked = new Map<HTMLTableElement, Element>()
    let frame = 0
    const update = () => {
      frame = 0
      for (const [table, parent] of tracked) if (!root.contains(table)) { resize.unobserve(parent); tracked.delete(table) }
      root.querySelectorAll<HTMLTableElement>('table').forEach(table => {
        const parent = table.parentElement
        if (!parent) return
        if (!tracked.has(table)) { tracked.set(table, parent); resize.observe(parent) }
        table.classList.add('responsive-table')
        const headings = [...(table.tHead?.rows ?? [])].at(-1)
        const labels: string[] = []
        for (const cell of headings?.cells ?? []) {
          const text = cell.textContent?.trim() || cell.getAttribute('aria-label') || cell.querySelector('[aria-label]')?.getAttribute('aria-label') || 'Выбрать'
          for (let i = 0; i < cell.colSpan; i++) labels.push(text)
          cell.dataset.responsiveInteractive = String(!!cell.querySelector('input,button,select,a'))
          cell.dataset.responsiveLabel = text
        }
        const occupied: number[] = []
        for (const body of table.tBodies) {
          occupied.fill(0)
          for (const row of body.rows) {
            let column = 0
            for (const cell of row.cells) {
              while ((occupied[column] ?? 0) > 0) column++
              cell.dataset.responsiveLabel = cell.colSpan === 1 ? labels[column] || '' : ''
              cell.dataset.responsiveWide = String(cell.colSpan > 1)
              for (let i = 0; i < cell.colSpan; i++) occupied[column + i] = cell.rowSpan
              column += cell.colSpan
            }
            for (let i = 0; i < occupied.length; i++) occupied[i] = Math.max(0, occupied[i] - 1)
          }
        }
        const width = parent.getBoundingClientRect().width
        table.style.setProperty('--responsive-table-width', `${width}px`)
        // Allow enough room for dates and editable values before switching to labelled records.
        const threshold = Math.max(Number(table.dataset.responsiveMinWidth) || 560, labels.length * (table.querySelector('tbody input:not([type="checkbox"]),tbody select') ? 130 : 95))
        table.classList.toggle('responsive-table--records', width > 0 && width < threshold)
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
