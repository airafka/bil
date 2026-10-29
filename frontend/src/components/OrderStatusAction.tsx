import { useRef, useState } from 'react'
import { changeOrderStatus } from '../api'
import { statusLabel } from '../domain'

const statuses = ['DRAFT', 'CONFIRMED', 'COMPLETED']
export function OrderStatusAction({ apiPath, id, status, onChanged }: {
  apiPath: string; id: string; status: string; onChanged: (status: string) => void
}) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const index = statuses.indexOf(status)
  const next = index >= 0 ? statuses[index + 1] : undefined
  async function advance() {
    if (!next || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const updated = await changeOrderStatus(apiPath, id, status, next)
      onChanged(updated.status)
      setMessage(`Статус изменён: ${statusLabel(updated.status)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить статус')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <div className="order-status-control">
    {next && <button type="button" className="primary-button" disabled={busy} onClick={advance}>{busy ? 'Сохраняем…' : next === 'CONFIRMED' ? 'Подтвердить' : 'Выполнить'}</button>}
    {error && <div className="notice error" role="alert">{error}</div>}
    <span className="service-sr-only" role="status">{message}</span>
  </div>
}
