import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createServiceReturns, getReturnContracts, type CreatedReturns, type ReturnTariffContract } from '../api'
import type { OrderDetails } from '../domain'
import { AppOverlay } from './AppOverlay'
import { UiInput, UiSelect } from './FormControls'
import { Notification } from './Notification'

export function CreateReturnDialog({ order, onClose, onCreated }: { order: OrderDetails; onClose: () => void; onCreated: (result: CreatedReturns) => void }) {
  const returned = new Set(order.returnOrders?.flatMap(item => item.containerIds) ?? [])
  const available = order.containers.filter(item => !returned.has(item.containerId))
  return <ReturnSelectionDialog context={order} serviceId={order.comprehensiveServiceOrderId!} containers={available} selectInitially onClose={onClose} onCreated={onCreated} />
}

type ReturnContext = { clientId: string; clientName: string; contractId: string | null; contractName: string | null }
type Candidate = { containerId: string; containerName: string }
export function ReturnSelectionDialog({ context: order, serviceId, containers: available, selectInitially = false, onClose, onCreated }: {
  context: ReturnContext; serviceId: string; containers: Candidate[]; selectInitially?: boolean
  onClose: () => void; onCreated: (result: CreatedReturns) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  const [selected, setSelected] = useState<string[]>(selectInitially ? available.map(item => item.containerId) : [])
  const [currentClient, setCurrentClient] = useState(false)
  const [contracts, setContracts] = useState<ReturnTariffContract[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [clientId, setClientId] = useState('')
  const [contractId, setContractId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    let active = true
    getReturnContracts().then(value => { if (active) setContracts(value) })
      .catch(cause => { if (active) setLoadError(cause instanceof Error ? cause.message : 'Не удалось загрузить договоры') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const clients = [...new Map(contracts.map(item => [item.clientId, item])).values()]
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); event.stopPropagation()
    if (lock.current || !selected.length || (!currentClient && (!clientId || !contractId))) return
    lock.current = true; setBusy(true); setError('')
    try { onCreated(await createServiceReturns(serviceId, { containerIds: selected, useCurrentClient: currentClient, ...(!currentClient ? { clientId, contractId } : {}) })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать возврат') }
    finally { lock.current = false; setBusy(false) }
  }
  return <AppOverlay><dialog ref={dialog} className="route-side-dialog return-dialog" aria-labelledby="return-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={submit}>
      <header className="route-dialog-heading"><h2 id="return-dialog-title">Создать возврат</h2><div className="header-actions"><button type="submit" className="primary-button" disabled={busy || !selected.length || (!currentClient && (!clientId || !contractId))}>{busy ? 'Создаём…' : 'Создать возврат'}</button><button type="button" className="close-button" aria-label="Закрыть форму возврата" disabled={busy} onClick={onClose}>×</button></div></header>
      <div className="route-drawer-body">
        <section className="return-form-section return-customer-section" aria-label="Клиент и договор возврата">
          {currentClient ? <dl className="return-client-details"><div><dt>Клиент</dt><dd>{order.clientName}</dd></div><div><dt>Договор</dt><dd>{order.contractName}</dd></div></dl> : <>
            <div className="return-party-fields">
              <label className="return-party-field"><span>Клиент <b>*</b></span><UiSelect aria-label="Клиент возврата" required value={clientId} disabled={busy || loading} onChange={event => { setClientId(event.target.value); setContractId('') }}><option value="" hidden disabled />{clients.map(item => <option key={item.clientId} value={item.clientId}>{item.clientName}</option>)}</UiSelect></label>
              <label className="return-party-field"><span>Договор <b>*</b></span><UiSelect aria-label="Договор возврата" required value={contractId} disabled={busy || !clientId || loading} onChange={event => setContractId(event.target.value)}><option value="" hidden disabled />{contracts.filter(item => item.clientId === clientId).map(item => <option key={item.contractId} value={item.contractId}>{item.contractName}</option>)}</UiSelect></label>
            </div>
            {loading && <p role="status">Загружаем договоры…</p>}
            {loadError && <Notification kind="error">{loadError}</Notification>}
            {!loading && !loadError && !contracts.length && <p>Добавьте активный тариф приёма автотранспортом в разделе <Link to="/complex-services">«Комплексные услуги»</Link>, чтобы выбрать другой договор.</p>}
          </>}
          <label className="return-current-client"><UiInput type="checkbox" checked={currentClient} disabled={busy} onChange={event => setCurrentClient(event.target.checked)} />Использовать данные исходной заявки</label>
        </section>
        <section className="return-form-section" aria-labelledby="return-containers-title">
          <div className="return-section-heading"><h3 id="return-containers-title">КТК к возврату</h3></div>
          <div className="table-wrap return-container-scroll">
            <table className="return-container-table" data-responsive-min-width={300} aria-label="КТК к возврату">
              <colgroup><col style={{width:44}}/><col/></colgroup>
              <thead><tr><th scope="col" className="composition-index"><UiInput type="checkbox" aria-label="Выбрать все КТК" title="Выбрать все КТК" disabled={busy || !available.length} checked={available.length > 0 && selected.length === available.length} ref={element => { if (element) element.indeterminate = selected.length > 0 && selected.length < available.length }} onChange={event => setSelected(event.target.checked ? available.map(item => item.containerId) : [])} /></th><th scope="col">Номер КТК</th></tr></thead>
              <tbody>{available.map(item => <tr key={item.containerId} data-selected={selected.includes(item.containerId)}>
                <td className="composition-index"><UiInput type="checkbox" aria-label={`Выбрать КТК ${item.containerName}`} disabled={busy} checked={selected.includes(item.containerId)} onChange={event => setSelected(value => event.target.checked ? [...value, item.containerId] : value.filter(id => id !== item.containerId))} /></td>
                <td>{item.containerName}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
        {error && <Notification kind="error">{error}</Notification>}
      </div>
    </form>
  </dialog></AppOverlay>
}
