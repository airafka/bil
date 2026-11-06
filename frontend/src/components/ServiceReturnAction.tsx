import { useRef, useState } from 'react'
import { getServiceReturnCandidates, type CreatedReturns, type ReturnCandidate } from '../api'
import type { ComprehensiveServiceOrderSummary } from '../comprehensiveServiceOrder'
import { ReturnSelectionDialog } from './CreateReturnDialog'

export function ServiceReturnAction({ service, disabled, onCreated, onError }: {
  service: ComprehensiveServiceOrderSummary; disabled: boolean
  onCreated: (result: CreatedReturns) => void; onError: (message: string) => void
}) {
  const [candidates, setCandidates] = useState<ReturnCandidate[] | null>(null)
  const [loading, setLoading] = useState(false)
  const lock = useRef(false)
  async function open() {
    if (lock.current || disabled) return
    lock.current = true; setLoading(true)
    try {
      const available = await getServiceReturnCandidates(service.id)
      if (!available.length) onError('Нет КТК для возврата: для всех вывезенных КТК уже оформлены возвратные заявки либо ещё не созданы заявки на вывоз.')
      else { onError(''); setCandidates(available) }
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'Не удалось загрузить КТК для возврата') }
    finally { lock.current = false; setLoading(false) }
  }
  return <>
    <button type="button" className="secondary-button" disabled={disabled || loading} onClick={() => void open()}>{loading ? 'Загружаем КТК…' : 'Создать возврат'}</button>
    {candidates && <ReturnSelectionDialog context={service} serviceId={service.id} containers={candidates} onClose={() => setCandidates(null)} onCreated={result => { setCandidates(null); onCreated(result) }} />}
  </>
}
