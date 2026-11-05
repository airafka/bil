import { Children, createContext, isValidElement, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ActionIcon } from './ActionIcon'
import './Notification.css'

const NotificationHost = createContext<HTMLDivElement | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  return <NotificationHost.Provider value={host}>
    {children}
    {typeof document !== 'undefined' && createPortal(
      <div className="notification-stack" ref={setHost} aria-label="Уведомления" role="region" />,
      document.body,
    )}
  </NotificationHost.Provider>
}

function contentText(children: ReactNode): string {
  return Children.toArray(children).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child)
    return isValidElement<{ children?: ReactNode }>(child) ? contentText(child.props.children) : ''
  }).join(' ')
}

type NotificationProps = {
  kind: 'error' | 'success'
  title?: string
  children: ReactNode
  onDismiss?: () => void
}

export function Notification(props: NotificationProps) {
  // A changed message is a new notification, including after dismissing the previous one.
  return <NotificationCard key={props.kind + ':' + props.title + ':' + contentText(props.children)} {...props} />
}

function NotificationCard({ kind, title, children, onDismiss }: NotificationProps) {
  const host = useContext(NotificationHost)
  const [dismissed, setDismissed] = useState(false)
  if (!host || dismissed) return null
  return createPortal(<div className={'notification-card notification-' + kind} role={kind === 'error' ? 'alert' : 'status'} aria-atomic="true">
    <svg className="notification-symbol" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      {kind === 'error' ? <><path d="M12 7v6" /><circle cx="12" cy="17" r=".7" fill="currentColor" stroke="none" /></> : <path d="m7.5 12 3 3 6-6" />}
    </svg>
    <div className="notification-content"><strong>{title || (kind === 'error' ? 'Ошибка' : 'Успешно')}</strong><div className="notification-message">{children}</div></div>
    <button type="button" className="notification-close" aria-label="Закрыть уведомление" onClick={() => { setDismissed(true); onDismiss?.() }}><ActionIcon name="close" /></button>
  </div>, host)
}
