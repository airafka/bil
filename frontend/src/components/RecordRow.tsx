import type { ComponentPropsWithoutRef } from 'react'
import { useNavigate } from 'react-router-dom'

type Props = Omit<ComponentPropsWithoutRef<'tr'>, 'onDoubleClick'> & { to: string }

export function RecordRow({ to, className = '', children, ...props }: Props) {
  const navigate = useNavigate()
  return <tr {...props} className={'record-row ' + className} onDoubleClick={event => {
    const target = event.target
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    if (!(target instanceof Element) || target.closest('a, button, input, select, textarea, label, [role="button"], [role="menu"], [role="menuitem"], [contenteditable]')) return
    navigate(to)
  }}>{children}</tr>
}
