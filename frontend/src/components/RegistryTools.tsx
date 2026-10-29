import { useState } from 'react'
import { UiInput, UiSelect } from './FormControls'

export function RegistryTools({ onApply, busy = false }: { onApply: (query: string, status: string) => void; busy?: boolean }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  return <form className="registry-tools" role="search" onSubmit={event => { event.preventDefault(); onApply(query.trim(), status) }}>
    <label>Поиск по заявкам<UiInput type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Номер, клиент или договор" /></label>
    <label>Статус<UiSelect value={status} onChange={event => setStatus(event.target.value)}><option value="">Все статусы</option><option value="DRAFT">Черновик</option><option value="CONFIRMED">Подтверждено</option><option value="COMPLETED">Выполнено</option></UiSelect></label>
    <button type="submit" className="primary-button" disabled={busy}>Найти</button>
    <button type="button" className="secondary-button" disabled={busy} onClick={() => { setQuery(''); setStatus(''); onApply('', '') }}>Сбросить</button>
  </form>
}
