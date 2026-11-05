import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

// Keep dialogs out of table cells and parent forms while retaining app control styles.
export function AppOverlay({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  const host = document.getElementById('app-overlay-root')
  return host ? createPortal(children, host) : null
}
