import { statusLabel } from '../domain'

export function StatusBadge({ status }: { status: string }) {
  return <span className="status-badge" data-status={status}>{statusLabel(status)}</span>
}
