export type TableColumn = { width: number; fixed: boolean }

/** Declared widths are minima/weights, never measurements of a previous render. */
export function tableGeometry(available: number, columns: TableColumn[], minimum = 0) {
  const natural = columns.reduce((sum, column) => sum + column.width, 0)
  const width = Math.max(available, natural, minimum)
  const flexible = columns.filter(column => !column.fixed).reduce((sum, column) => sum + column.width, 0)
  const spare = width - natural
  return { width, columns: columns.map(column => column.width + (!column.fixed && flexible ? spare * column.width / flexible : 0)) }
}
