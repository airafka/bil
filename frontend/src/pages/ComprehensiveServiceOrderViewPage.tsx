import { SidebarActions } from '../components/SidebarActions'
import { ServiceReturnAction } from '../components/ServiceReturnAction'
import type { CreatedReturns } from '../api'
import { RelatedOrderLink } from '../components/RelatedOrderLink'
import { ActionIcon } from '../components/ActionIcon'
import { Notification } from '../components/Notification'
import { OrderRouteCell } from '../components/OrderRouteCell'
import { ServiceProgressCards } from '../components/ServiceProgressCards'
import { StatusBadge } from '../components/StatusBadge'
import { BillingCharges } from './BillingChargesPage'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { completeServiceSection, prepareServiceTransport, createServiceShippingOrder, getComprehensiveServiceOrder, updateServiceTransportMetadata, getReferenceOptions } from '../api'
import { UiInput, UiSelect } from '../components/FormControls'
import type { ComprehensiveServiceOrderDetails, ServiceTransportMetadataChange } from '../comprehensiveServiceOrder'
import type { ReferenceOption } from '../domain'

function cargoLabel(value: string) {
  const match = value.match(/^(.+?)\s+[—–-]\s+(.+)$/)
  return match ? `${match[2]} (${match[1]})` : value
}

const serviceTabs = [
  { id: 'main', label: 'Основное' },
  { id: 'receiving', label: 'Заявки на поставку - ЖД' },
  { id: 'shipping', label: 'Заявки на вывоз - Авто' },
  { id: 'returns', label: 'Заявки на поставку - Авто' },
  { id: 'charges', label: 'Начисления' },
] as const
type ServiceTab = typeof serviceTabs[number]['id']
type MetadataDraft = { plannedAt: string; partyName: string }
const metadataKey = (kind: ServiceTransportMetadataChange['kind'],id:string) => kind+':'+id
const plannedLabel = (value?:string|null) => value ? value.slice(0,10).split('-').reverse().join('.')+' '+value.slice(11,16) : 'Не указаны'

export function ComprehensiveServiceOrderViewPage() {
  const { comprehensiveServiceOrderId = '' } = useParams()
  return <ComprehensiveServiceOrderDashboard key={comprehensiveServiceOrderId} comprehensiveServiceOrderId={comprehensiveServiceOrderId} />
}

function ComprehensiveServiceOrderDashboard({ comprehensiveServiceOrderId }: { comprehensiveServiceOrderId: string }) {
  const [preparing,setPreparing]=useState(false)
  const preparationLock=useRef(false)
  const [routeRevision,setRouteRevision]=useState(0)
  const [preparationNotice,setPreparationNotice]=useState('')
  async function prepareSection(){
    if(preparationLock.current||activeTab==='main'||activeTab==='charges')return
    const section=activeTab==='receiving'?'INITIAL_RECEIVING':activeTab==='shipping'?'SHIPPING':'RETURN_RECEIVING'
    preparationLock.current=true;setPreparing(true);setMetadataError('');setPreparationNotice('')
    try{setData(await prepareServiceTransport(comprehensiveServiceOrderId,section));setRouteRevision(v=>v+1);setPreparationNotice('Дата, время и контрагенты заполнены. Рейсы подготовлены.')}
    catch(e){setMetadataError(e instanceof Error?e.message:'Не удалось подготовить заявки и рейсы')}
    finally{preparationLock.current=false;setPreparing(false)}
  }
  async function completeSection(){
    if(preparationLock.current||activeTab==='main'||activeTab==='charges')return
    const section=activeTab==='receiving'?'INITIAL_RECEIVING':activeTab==='shipping'?'SHIPPING':'RETURN_RECEIVING'
    preparationLock.current=true;setPreparing(true);setMetadataError('');setPreparationNotice('')
    try{setData(await completeServiceSection(comprehensiveServiceOrderId,section,needsConfirmation?'CONFIRM_ROUTES':'COMPLETE_ORDERS'));setRouteRevision(v=>v+1);setPreparationNotice(needsConfirmation?'Рейсы подтверждены. Теперь можно выполнить заявки.':'Заявки раздела выполнены.')}
    catch(e){setMetadataError(e instanceof Error?e.message:'Не удалось подтвердить рейсы и выполнить заявки')}
    finally{preparationLock.current=false;setPreparing(false)}
  }
  const [activeTab, setActiveTab] = useState<ServiceTab>('main')
  const [chargesTotalsTarget, setChargesTotalsTarget] = useState<HTMLDivElement | null>(null)
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([])
  const [data, setData] = useState<ComprehensiveServiceOrderDetails | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [createdReturn, setCreatedReturns] = useState<CreatedReturns | null>(null)
  async function returnCreated(result: CreatedReturns) {
    setCreatedReturns(result); setMetadataError('')
    try { setData(await getComprehensiveServiceOrder(comprehensiveServiceOrderId)); setRouteRevision(value => value + 1) }
    catch (cause) { setMetadataError(cause instanceof Error ? cause.message : 'Возврат создан, но не удалось обновить список заявок') }
  }
  const [selectedContainerIds, setSelectedContainerIds] = useState<string[]>([])
  const [creatingShipping, setCreatingShipping] = useState(false)
  const [shippingError, setShippingError] = useState('')
  const [editingMetadata,setEditingMetadata]=useState(false)
  const [metadataBusy,setMetadataBusy]=useState(false)
  const [metadataDraft,setMetadataDraft]=useState<Record<string,MetadataDraft>>({})
  const [metadataError,setMetadataError]=useState('')
  const [partyClients,setPartyClients]=useState<ReferenceOption[]>([])
  const metadataLock=useRef(false)
  async function startMetadataEditing(){
    if(metadataLock.current)return
    metadataLock.current=true;setMetadataBusy(true);setMetadataError('')
    try{
      const [fresh,clients]=await Promise.all([getComprehensiveServiceOrder(comprehensiveServiceOrderId),getReferenceOptions('clients')])
      setPartyClients(clients)
      setData(fresh)
      const draft:Record<string,MetadataDraft>={}
      if(fresh.order.workflow!=='AUTO_RETURN'&&fresh.receivingOrder.status==='DRAFT') draft[metadataKey('INITIAL_RECEIVING',fresh.receivingOrder.id)]={plannedAt:fresh.receivingOrder.arrivalAt?.slice(0,16)||'',partyName:fresh.receivingOrder.consignor||''}
      fresh.shippingOrders.filter(o=>o.status==='DRAFT').forEach(o=>{draft[metadataKey('SHIPPING',o.id)]={plannedAt:o.plannedAt?.slice(0,16)||'',partyName:o.consignee||''}})
      fresh.returnOrders.filter(o=>o.comprehensiveServiceOrderId===comprehensiveServiceOrderId&&o.status==='DRAFT').forEach(o=>{draft[metadataKey('RETURN_RECEIVING',o.id)]={plannedAt:o.plannedAt?.slice(0,16)||'',partyName:o.consignor||''}})
      setMetadataDraft(draft);setEditingMetadata(true)
      if(activeTab!=='receiving'&&activeTab!=='shipping'&&activeTab!=='returns')setActiveTab(fresh.order.workflow!=='AUTO_RETURN'&&fresh.receivingOrder.status==='DRAFT'?'receiving':fresh.shippingOrders.some(o=>o.status==='DRAFT')?'shipping':'returns')
    }catch(e){setMetadataError(e instanceof Error?e.message:'Не удалось загрузить реквизиты заявок')}
    finally{metadataLock.current=false;setMetadataBusy(false)}
  }
  async function saveMetadata(){
    if(metadataLock.current||!data)return
    if([...document.querySelectorAll<HTMLInputElement>('.service-metadata-table input')].some(input=>!input.checkValidity())){setMetadataError('Проверьте дату и время в редактируемых заявках');return}
    const changes:ServiceTransportMetadataChange[]=[]
    const add=(kind:ServiceTransportMetadataChange['kind'],id:string,originalPlannedAt?:string|null,originalPartyName?:string|null)=>{
      const value=metadataDraft[metadataKey(kind,id)];if(!value)return
      const partyName=value.partyName.trim()||null
      if(value.plannedAt===(originalPlannedAt?.slice(0,16)||'')&&partyName===(originalPartyName?.trim()||null))return
      changes.push({id,kind,plannedAt:value.plannedAt===(originalPlannedAt?.slice(0,16)||'')?originalPlannedAt||null:value.plannedAt||null,partyName,originalPlannedAt:originalPlannedAt||null,originalPartyName:originalPartyName||null})
    }
    if(data.order.workflow!=='AUTO_RETURN')add('INITIAL_RECEIVING',data.receivingOrder.id,data.receivingOrder.arrivalAt,data.receivingOrder.consignor)
    data.shippingOrders.forEach(o=>add('SHIPPING',o.id,o.plannedAt,o.consignee));data.returnOrders.filter(o=>o.comprehensiveServiceOrderId===comprehensiveServiceOrderId).forEach(o=>add('RETURN_RECEIVING',o.id,o.plannedAt,o.consignor))
    if(!changes.length){setEditingMetadata(false);setMetadataDraft({});setMetadataError('');return}
    metadataLock.current=true;setMetadataBusy(true);setMetadataError('')
    try{setData(await updateServiceTransportMetadata(comprehensiveServiceOrderId,changes));setEditingMetadata(false);setMetadataDraft({})}
    catch(e){setMetadataError(e instanceof Error?e.message:'Не удалось сохранить реквизиты заявок')}
    finally{metadataLock.current=false;setMetadataBusy(false)}
  }
  function metadataCells(kind:ServiceTransportMetadataChange['kind'],order:{id:string;code:number;status:string;plannedAt?:string|null},party?:string|null){
    const key=metadataKey(kind,order.id),draft=metadataDraft[key]
    const dateTitle=kind==='SHIPPING'?'Дата и время вывоза':'Дата и время поставки',partyTitle=kind==='SHIPPING'?'Грузополучатель':'Грузоотправитель'
    const editable=editingMetadata&&order.status==='DRAFT'&&draft
    const update=(field:keyof MetadataDraft,value:string)=>setMetadataDraft(current=>({...current,[key]:{...current[key],[field]:value}}))
    return <><td className="service-metadata-date">{editable?<UiInput type="datetime-local" step={60} aria-label={dateTitle+' '+order.code} value={draft.plannedAt} disabled={metadataBusy} onChange={e=>update('plannedAt',e.target.value)}/>:plannedLabel(order.plannedAt)}</td><td className="service-metadata-party" title={party||undefined}>{editable?<UiSelect aria-label={partyTitle+' '+order.code} value={draft.partyName} disabled={metadataBusy || !partyClients.length} onChange={e=>update('partyName',e.target.value)}><option value="" hidden disabled />{partyClients.map(client=><option key={client.id} value={client.name}>{client.name}</option>)}</UiSelect>:party||'Не указан'}</td></>
  }
  useEffect(() => {
    let active = true
    getComprehensiveServiceOrder(comprehensiveServiceOrderId).then(value => { if (active) setData(value) })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Не удалось загрузить заявку') })
    return () => { active = false }
  }, [comprehensiveServiceOrderId, attempt])

  function toggleContainer(id: string) {
    setSelectedContainerIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : current.length < 2 ? [...current, id] : current)
  }

  async function createSelectedShippingOrder() {
    if (selectedContainerIds.length < 1 || selectedContainerIds.length > 2) return
    setCreatingShipping(true)
    setShippingError('')
    try {
      const updated = await createServiceShippingOrder(comprehensiveServiceOrderId, selectedContainerIds)
      setData(updated)
      setSelectedContainerIds([])
    } catch (cause) { setShippingError(cause instanceof Error ? cause.message : 'Не удалось создать заявку на вывоз') }
    finally { setCreatingShipping(false) }
  }

  const isAutoReturn = data?.order.workflow === 'AUTO_RETURN'
  const visibleServiceTabs = serviceTabs.filter(tab => !isAutoReturn || ['main', 'returns', 'charges'].includes(tab.id))
  const ownReturns = data?.returnOrders.filter(item => item.comprehensiveServiceOrderId === comprehensiveServiceOrderId) ?? []
  const removals = data?.shippingOrders ?? []
  const receiving = data?.receivingOrder
  const waybills = receiving?.waybills ?? []
  const sectionOrders=activeTab==='receiving'?(receiving?[receiving]:[]):activeTab==='shipping'?removals:activeTab==='returns'?ownReturns:[]
  const needsConfirmation=sectionOrders.some(o=>o.status==='DRAFT')
  const sectionActionLabel=needsConfirmation?'Подтвердить все рейсы':'Выполнить все заявки'
  const cargo = [...new Set(waybills.flatMap(bill => bill.products.map(product => cargoLabel(product.etsngCode))))]

  return <section className="form-page service-dashboard service-table-page">
    <header className="service-header"><div className="view-title"><h1>Заявка на услугу{data ? ` №${data.order.code}` : ''}</h1></div><div className="service-header-actions">{editingMetadata?<><button type="button" className="secondary-button" disabled={metadataBusy} onClick={()=>{setEditingMetadata(false);setMetadataDraft({});setMetadataError('')}}>Отмена</button><button type="button" className="primary-button" disabled={metadataBusy} onClick={saveMetadata}>{metadataBusy?'Сохраняем…':'Сохранить'}</button></>:((!isAutoReturn&&data?.receivingOrder.status==='DRAFT')||data?.shippingOrders.some(o=>o.status==='DRAFT')||ownReturns.some(o=>o.status==='DRAFT'))&&<button type="button" className="secondary-button icon-button" aria-label="Редактировать" title="Редактировать" disabled={preparing||metadataBusy||creatingShipping} onClick={startMetadataEditing}><ActionIcon name="edit"/></button>}<Link className="close-button" to="/comprehensive-service-orders" aria-label="Закрыть" title="Закрыть">×</Link></div></header>
    {createdReturn && <Notification kind="success">Созданы возвратные заявки: {createdReturn.returns.length}. <button type="button" className="text-action-button" onClick={() => setActiveTab('returns')}>Показать возвраты</button>{createdReturn.createdService && <> Заявка на автоуслугу <Link to={`/comprehensive-service-orders/${createdReturn.serviceOrderId}`}>№{createdReturn.serviceOrderCode}</Link>.</>}</Notification>}
    {preparationNotice && <Notification kind="success">{preparationNotice}</Notification>}
    {metadataError && <Notification kind="error">{metadataError}</Notification>}
    {error && <Notification kind="error">{error}<button className="secondary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Попробовать снова</button></Notification>}
    {!data && !error && <div className="service-loading" role="status" aria-label="Загружаем заявку"><span>Загружаем заявку…</span><div /><div /><div /></div>}
    {data && receiving && <><div className="form-workspace">
      <div className="service-tabs-toolbar">
      <div className="stepper view-tabs service-tabs" role="tablist" aria-label="Разделы заявки на услугу">
        {visibleServiceTabs.map((tab, index) => <button
          key={tab.id}
          ref={element => { tabButtons.current[index] = element }}
          type="button"
          role="tab"
          id={`service-tab-${tab.id}`}
          aria-controls={`service-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={`step ${activeTab === tab.id ? 'current' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          onKeyDown={event => {
            let nextIndex: number
            if (event.key === 'ArrowRight') nextIndex = (index + 1) % visibleServiceTabs.length
            else if (event.key === 'ArrowLeft') nextIndex = (index + visibleServiceTabs.length - 1) % visibleServiceTabs.length
            else if (event.key === 'Home') nextIndex = 0
            else if (event.key === 'End') nextIndex = visibleServiceTabs.length - 1
            else return
            event.preventDefault()
            setActiveTab(visibleServiceTabs[nextIndex].id)
            tabButtons.current[nextIndex]?.focus()
          }}
        >{tab.label}</button>)}
      </div>
      {activeTab === 'charges' && <div className="service-tab-charge-totals" ref={setChargesTotalsTarget} />}
      {(activeTab === 'receiving' || activeTab === 'shipping' || activeTab === 'returns') && <div className="service-tab-actions service-section-actions">{activeTab === 'shipping' && <ServiceReturnAction service={data.order} disabled={editingMetadata || preparing || metadataBusy || creatingShipping || !removals.length} onCreated={result => void returnCreated(result)} onError={setMetadataError} />}
        <SidebarActions><button type="button" className="secondary-button icon-button" aria-label={sectionActionLabel} title={sectionActionLabel} disabled={preparing||editingMetadata||metadataBusy||creatingShipping||!(activeTab==='receiving'?receiving.status!=='COMPLETED':activeTab==='shipping'?removals.some(o=>o.status!=='COMPLETED'):ownReturns.some(o=>o.status!=='COMPLETED'))} onClick={completeSection}><ActionIcon name="complete" /></button>
        <button type="button" className="secondary-button icon-button" aria-label="Заполнить заявки и создать рейсы" title="Заполнить текущую дату и время, контрагентов и создать рейсы" disabled={preparing||editingMetadata||metadataBusy||creatingShipping||!(activeTab==='receiving'?receiving.status==='DRAFT':activeTab==='shipping'?removals.some(o=>o.status==='DRAFT'):ownReturns.some(o=>o.status==='DRAFT'))} onClick={prepareSection}><ActionIcon name="magic" /></button></SidebarActions></div>}
      </div>
      <div id="service-panel-main" role="tabpanel" aria-labelledby="service-tab-main" tabIndex={0} hidden={activeTab !== 'main'}>
      <section className="service-main-panel" aria-labelledby="service-main-title">
        <h2 id="service-main-title">Основная информация</h2>
        <div className="service-main-columns">
          <dl className="details-grid">
            <div><dt>Клиент</dt><dd>{data.order.clientName}</dd></div>
            <div><dt>Договор</dt><dd>{data.order.contractName}</dd></div>
            <div><dt>Услуга</dt><dd>{data.progress?.serviceName || '—'}</dd></div>
            {data.order.sourceServiceOrderId && <div><dt>Исходная заявка на услугу</dt><dd><RelatedOrderLink kind="comprehensive-service-orders" id={data.order.sourceServiceOrderId} /></dd></div>}
            <div><dt>Дата создания</dt><dd>{data.order.createdAt ? new Date(data.order.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }) : 'Не указана'}</dd></div>
          </dl>
          <dl className="details-grid">
            <div><dt>Статус</dt><dd><StatusBadge status={data.order.status} /></dd></div>
            <div><dt>Начислено без НДС, ₽</dt><dd>{data.totalWithoutVat.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd></div>
            <div><dt>Начислено с НДС, ₽</dt><dd>{data.totalWithVat.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd></div>
          </dl>
        </div>
      </section>
      {data.progress && <ServiceProgressCards progress={data.progress} initialOrderStatus={receiving.status} autoReturn={isAutoReturn} />}

      </div>
      <div id="service-panel-charges" role="tabpanel" aria-labelledby="service-tab-charges" tabIndex={0} hidden={activeTab !== 'charges'}>
        {activeTab === 'charges' && <BillingCharges totalsTarget={chargesTotalsTarget} comprehensiveServiceOrderId={comprehensiveServiceOrderId} refreshKey={data.order.status+':'+routeRevision} />}
      </div>
      <div id="service-panel-receiving" role="tabpanel" aria-labelledby="service-tab-receiving" tabIndex={0} hidden={activeTab !== 'receiving'}>
      <section className="service-order-section" aria-label="Заявки на поставку - ЖД">

        <div className="table-wrap service-compact-table service-receiving-table"><table className="service-metadata-table service-initial-metadata-table" data-responsive-min-width={1000}><colgroup><col style={{width:44}}/><col style={{width:140}}/><col style={{width:220}}/><col style={{width:260}}/><col style={{width:240}}/><col style={{width:170}}/><col style={{width:120}}/></colgroup>
          <thead><tr><th scope="col" className="composition-index">№</th><th scope="col">Номер заявки</th><th scope="col">Дата и время поставки</th><th scope="col">Грузоотправитель</th><th scope="col">Груз</th><th scope="col">Рейс</th><th scope="col">Статус</th></tr></thead>
          <tbody><tr>
            <td className="composition-index">1</td><td><Link className="order-code" to={`/receiving-orders/${receiving.id}`}>{receiving.code}</Link></td>

            {metadataCells('INITIAL_RECEIVING',{...receiving,plannedAt:receiving.arrivalAt},receiving.consignor)}
            <td>{cargo.length ? cargo.map(name => <span className="service-cargo-item" key={name}>{name}</span>) : '—'}</td>


            <td><OrderRouteCell key={routeRevision} disabled={editingMetadata||preparing} id={receiving.id} kind="RECEIVING" /></td>
            <td><StatusBadge status={receiving.status} /></td>
          </tr></tbody>
        </table></div>
      </section>
      </div>
      <div id="service-panel-shipping" role="tabpanel" aria-labelledby="service-tab-shipping" tabIndex={0} hidden={activeTab !== 'shipping'}>
      <section className="service-order-section" aria-label="Заявки на вывоз - Авто">
        <div className="table-wrap service-compact-table"><table className="service-metadata-table" data-responsive-min-width={1000}><colgroup><col style={{width:44}}/><col style={{width:140}}/><col style={{width:190}}/><col style={{width:220}}/><col style={{width:260}}/><col style={{width:170}}/><col style={{width:120}}/></colgroup>
          <thead><tr><th scope="col" className="composition-index">№</th><th scope="col">Номер заявки</th><th scope="col">Номер КТК</th><th scope="col">Дата и время вывоза</th><th scope="col">Грузополучатель</th><th scope="col">Рейс</th><th scope="col">Статус</th></tr></thead>
          <tbody>{removals.map((order, index) => <tr key={order.id}><td className="composition-index">{index + 1}</td>
            <td><Link className="order-code" to={`/shipping-orders/${order.id}`}>{order.code}</Link></td>
            <td>{order.containerNames.map(name => <span className="service-cargo-item" key={name}>{name}</span>)}</td>
            {metadataCells('SHIPPING',order,order.consignee)}
            <td><OrderRouteCell key={routeRevision} disabled={editingMetadata||preparing} id={order.id} kind="SHIPPING" /></td><td><StatusBadge status={order.status} /></td>
          </tr>)}</tbody>
        </table></div>
        {removals.length === 0 && <div className="service-section-empty">Заявок на вывоз пока нет</div>}
      </section>

      </div>
      <div id="service-panel-returns" role="tabpanel" aria-labelledby="service-tab-returns" tabIndex={0} hidden={activeTab !== 'returns'}>
      <section className="service-order-section" aria-label="Заявки на поставку - Авто">

        {!isAutoReturn && <p className="service-return-help">Возвраты создаются кнопкой «Создать возврат» над списком на вкладке «Заявки на вывоз - Авто» или в карточке вывоза. Возвратами другого клиента или договора управляйте в их заявке на услугу.</p>}
        {data.returnOrders.length ? <div className="table-wrap service-compact-table"><table className="service-metadata-table" data-responsive-min-width={1200}><colgroup><col style={{width:44}}/><col style={{width:130}}/><col style={{width:170}}/><col style={{width:220}}/><col style={{width:210}}/><col style={{width:190}}/><col style={{width:160}}/><col style={{width:120}}/></colgroup><thead><tr><th scope="col" className="composition-index">№</th><th>Номер заявки</th><th>КТК</th><th>Дата и время поставки</th><th>Грузоотправитель</th><th>Клиент / договор / услуга</th><th>Рейс</th><th>Статус</th></tr></thead><tbody>{data.returnOrders.map((item, index) => <tr key={item.id}><td className="composition-index">{index + 1}</td><td><Link className="order-code" to={`/receiving-orders/${item.id}`}>{item.code}</Link></td><td>{item.containerNames.map(name => <span className="service-cargo-item" key={name}>{name}</span>)}</td>{metadataCells('RETURN_RECEIVING',item,item.consignor)}<td><span className="service-cargo-item">{item.clientName}</span><span className="service-cargo-item">{item.contractName}</span><Link className="order-code" to={`/comprehensive-service-orders/${item.comprehensiveServiceOrderId}`}>№{item.comprehensiveServiceOrderCode}</Link></td><td><OrderRouteCell key={routeRevision} disabled={editingMetadata||preparing||item.comprehensiveServiceOrderId!==comprehensiveServiceOrderId} id={item.id} kind="RECEIVING" /></td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div> : <div className="service-section-empty">Возвратных поставок пока нет</div>}

      </section>
      </div>
    </div>
        {activeTab === 'shipping' && data.selectableContainers.length > 0 && <section className="form-workspace service-pending-containers service-pending-card" aria-label="КТК без заявки на вывоз">
          <div className="bulk-return-heading"><div className="service-pending-intro"><h3>КТК стандарта 20 без заявки на вывоз</h3><p>Выберите один или два КТК для одной машины.</p></div><button type="button" className="primary-button create-action-button" disabled={preparing || editingMetadata || creatingShipping || selectedContainerIds.length === 0 || data.order.status === 'COMPLETED'} onClick={createSelectedShippingOrder}>{creatingShipping ? 'Создаём…' : 'Создать заявку на вывоз'}</button></div>

          <div className="table-wrap service-compact-table"><table className="service-pending-table" aria-label="КТК стандарта 20 без заявки на вывоз"><thead><tr><th scope="col" className="composition-index"><span className="sr-only">Выбрать</span></th><th scope="col">Номер КТК</th><th scope="col">Типоразмер</th></tr></thead><tbody>
            {data.selectableContainers.map(container => <tr key={container.containerId}><td className="composition-index"><UiInput type="checkbox" aria-label={`Выбрать КТК ${container.containerName}`} checked={selectedContainerIds.includes(container.containerId)} disabled={data.order.status === 'COMPLETED' || (selectedContainerIds.length === 2 && !selectedContainerIds.includes(container.containerId))} onChange={() => toggleContainer(container.containerId)} /></td><td>{container.containerName}</td><td>Стандартный 20</td></tr>)}
          </tbody></table></div>
          {shippingError && <Notification kind="error">{shippingError}</Notification>}

        </section>}
    </>}
  </section>
}
