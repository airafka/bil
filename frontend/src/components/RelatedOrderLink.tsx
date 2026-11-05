import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getComprehensiveServiceOrder, getOrder } from '../api'
import { Notification } from './Notification'

type Kind = 'comprehensive-service-orders' | 'receiving-orders' | 'shipping-orders'
export function RelatedOrderLink({ id, kind }: { id: string; kind: Kind }) {
  return <NumberLink key={kind + id} id={id} kind={kind} />
}
function NumberLink({ id, kind }: { id: string; kind: Kind }) {
  const [number, setNumber] = useState<number | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const result = kind === 'comprehensive-service-orders'
      ? getComprehensiveServiceOrder(id).then(value => value.order.code)
      : getOrder('/api/' + kind, id).then(value => value.code)
    result.then(value => { if (active) setNumber(value) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить номер связанной заявки') })
    return () => { active = false }
  }, [id, kind])
  return <><Link to={'/' + kind + '/' + id} aria-busy={number === null && !error}>{number ?? (error ? 'Номер недоступен' : '…')}</Link>{error && <Notification kind="error">{error}</Notification>}</>
}
