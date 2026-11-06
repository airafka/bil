import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const mobileQuery = '(max-width: 640px)'
function subscribe(listener: () => void) {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

// Mobile navigation has no footer; keep section actions next to its tabs there.
export function SidebarActions({ children }: { children: ReactNode }) {
  const mobile = useSyncExternalStore(subscribe, () => window.matchMedia(mobileQuery).matches, () => true)
  const host = typeof document === 'undefined' ? null : document.getElementById('sidebar-actions')
  const actions = <div className="service-bulk-actions" role="group" aria-label="Массовые действия текущего раздела">{children}</div>
  return !mobile && host ? createPortal(actions, host) : actions
}
