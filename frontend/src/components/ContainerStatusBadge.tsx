import { containerStatusLabel } from '../containerStock'
import './ContainerStatusBadge.css'

const tones: Record<string, string> = {
  EXPECTED: 'expected', ON_TERMINAL: 'in-stock', RESERVED_OUT: 'outbound', DEPARTED: 'departed',
}

export function ContainerStatusBadge({ status }: { status?: string | null }) {
  const tone = status ? tones[status] : undefined
  if (!tone) return <span className="container-status-empty">{containerStatusLabel(status ?? null)}</span>
  return <span className={`container-status-badge container-status-badge--${tone}`}>
    {containerStatusLabel(status ?? null)}
  </span>
}
