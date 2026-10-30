import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionIcon } from './ActionIcon'

type RowAction = { label: string; to: string; onClick?: never } | { label: string; to?: never; onClick: () => void }

export function RowActions({ label, actions, disabled = false }: { label: string; actions: RowAction[]; disabled?: boolean }) {
  const id = useId()
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="row-actions-button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={event => {
      if (menu.current?.matches(':popover-open')) { menu.current.hidePopover(); return }
      const rect = event.currentTarget.getBoundingClientRect()
      const height = actions.length * 40 + 8
      setPosition({ left: Math.max(8, Math.min(rect.right - 200, window.innerWidth - 208)), top: rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - height - 4) })
      menu.current?.showPopover()
      menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    }}><ActionIcon name="more" /></button>
    <div ref={menu} id={id} role="menu" aria-label={label} popover="auto" className="row-actions-menu" style={position} onToggle={event => setOpen(event.newState === 'open')} onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      const index = items.indexOf(document.activeElement as HTMLElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }}>
      {actions.map(action => action.to !== undefined ? <Link key={action.label} role="menuitem" to={action.to} onClick={() => menu.current?.hidePopover()}>{action.label}</Link> : <button key={action.label} type="button" role="menuitem" onClick={() => { menu.current?.hidePopover(); action.onClick() }}>{action.label}</button>)}
    </div>
  </>
}
