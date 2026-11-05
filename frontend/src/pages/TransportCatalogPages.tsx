import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTransportCatalog, getTransportCatalogEntry, saveTransportCatalogEntry, deleteTransportCatalogEntry } from '../api'
import type { TransportCatalogEntry, TransportCatalogInput, TransportCatalogKind } from '../transportCatalogs'
import { transportCatalogTitles, catalogPath, catalogDate } from '../transportCatalogs'
import { UiInput } from '../components/FormControls'
import { ActionIcon } from '../components/ActionIcon'
import { RecordRow } from '../components/RecordRow'
import { RowActions } from '../components/RowActions'
import { Notification } from '../components/Notification'

const nameLabel=(kind:TransportCatalogKind)=>kind==='vehicles'?'Номер ТС':kind==='drivers'?'ФИО водителя-экспедитора':'Наименование'
export function TransportCatalogRegistryPage({kind}:{kind:TransportCatalogKind}) {
 const [rows,setRows]=useState<TransportCatalogEntry[]|null>(null),[error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 useEffect(()=>{let live=true;getTransportCatalog(kind).then(value=>{if(live)setRows(value)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[kind])
 async function remove(row:TransportCatalogEntry){
  if(busy||!window.confirm('Удалить «'+row.name+'»?'))return
  setBusy(true);setError('')
  try{await deleteTransportCatalogEntry(kind,row.id);setRows(current=>current?.filter(x=>x.id!==row.id)??null)}catch(e){setError(e instanceof Error?e.message:'Не удалось удалить запись')}finally{setBusy(false)}
 }
 const columns=kind==='carriers'?4:7
 return <section className="registry-page"><div className="page-header"><h1>{transportCatalogTitles[kind]}</h1><Link className="primary-button create-action-button" to={catalogPath(kind)+'/new'}><ActionIcon name="plus"/> Создать</Link></div>
 {error&&<Notification kind="error">{error}</Notification>}
 <div className="table-card"><div className="table-wrap"><table><thead><tr><th className="registry-index">№</th><th>{nameLabel(kind)}</th>
 {kind==='drivers'&&<><th>Телефон</th><th>Доверенность</th><th>Действительна до</th></>}
 {kind==='vehicles'&&<><th>Страховка</th><th>Наличие прицепа</th><th>Номер прицепа</th></>}
 <th>Активный</th><th className="registry-actions" aria-label="Действия"/></tr></thead><tbody>
 {!rows&&<tr><td colSpan={columns} className="table-message">Загружаем справочник…</td></tr>}
 {rows?.length===0&&<tr><td colSpan={columns} className="table-message">Записей пока нет</td></tr>}
 {rows?.map((row,index)=><RecordRow key={row.id} to={catalogPath(kind)+'/'+row.id}><td className="registry-index">{index+1}</td><td><Link to={catalogPath(kind)+'/'+row.id}>{row.name}</Link></td>
 {kind==='drivers'&&<><td>{row.phoneNumber||'—'}</td><td>{row.poaNumber||'—'}</td><td>{catalogDate(row.poaValidTo)}</td></>}
 {kind==='vehicles'&&<><td>{row.insuranceNumber||'—'}</td><td>{row.withTrailer==null?'—':<UiInput type="checkbox" aria-label={'Наличие прицепа: '+row.name} checked={row.withTrailer} disabled/>}</td><td>{row.trailerNumber||'—'}</td></>}
 <td><UiInput type="checkbox" aria-label={'Активный: '+row.name} checked={row.active} disabled/></td><td className="registry-actions"><RowActions disabled={busy} label={'Действия: '+row.name} actions={[{label:'Открыть',to:catalogPath(kind)+'/'+row.id},{label:'Удалить',onClick:()=>void remove(row)}]}/></td></RecordRow>)}
 </tbody></table></div></div></section>
}
const empty:TransportCatalogInput={name:'',active:true,phoneNumber:null,poaNumber:null,poaValidTo:null,insuranceNumber:null,withTrailer:false,trailerNumber:null}
export function TransportCatalogCardPage({kind,creating=false}:{kind:TransportCatalogKind;creating?:boolean}) {
 const {entryId=''}=useParams(),navigate=useNavigate()
 const [entry,setEntry]=useState<TransportCatalogEntry|null>(null),[draft,setDraft]=useState<TransportCatalogInput>(empty)
 const [editing,setEditing]=useState(creating),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{if(creating)return;let live=true;getTransportCatalogEntry(kind,entryId).then(value=>{if(live){setEntry(value);setDraft(value)}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[kind,entryId,creating])
 function field(key:keyof TransportCatalogInput,value:string|boolean|null){setDraft(current=>({...current,[key]:value}))}
 async function save(event:FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const result=await saveTransportCatalogEntry(kind,creating?null:entryId,{...draft,trailerNumber:draft.withTrailer?draft.trailerNumber:null});setEntry(result);setDraft(result);setEditing(false);if(creating)navigate(catalogPath(kind)+'/'+result.id)
 }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить запись')}finally{setBusy(false)}}
 const input=(key:'name'|'phoneNumber'|'poaNumber'|'poaValidTo'|'insuranceNumber'|'trailerNumber',label:string,type='text',required=false,maxLength=100)=><label className="field horizontal-field"><span>{label}{required&&<b> *</b>}</span>{editing?<UiInput type={type} value={draft[key]??''} maxLength={maxLength} required={required} disabled={busy} onChange={e=>field(key,e.target.value||null)}/>:<span className="ui-readonly-value">{type==='date'?catalogDate(draft[key]):draft[key]||'—'}</span>}</label>
 return <section className="form-page"><div className="page-header"><h1>{creating?'Создание записи':entry?.name??transportCatalogTitles[kind]}</h1><div className="view-header-actions">
 {editing?<>{!creating&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>{if(entry)setDraft(entry);setEditing(false);setError('')}}>Отмена</button>}<button className="primary-button" type="submit" form="transport-catalog-form" disabled={busy}>{busy?'Сохраняем…':'Сохранить'}</button></>:entry&&<button type="button" className="secondary-button icon-button" aria-label="Редактировать" title="Редактировать" onClick={()=>setEditing(true)}><ActionIcon name="edit"/></button>}
 <Link className="close-button" to={catalogPath(kind)} aria-label="Закрыть">×</Link></div></div>
 {error&&<Notification kind="error">{error}</Notification>}
 {(creating||entry)&&<form id="transport-catalog-form" className="form-workspace" onSubmit={save}>
 <div className="stepper"><button type="button" className="step current">Основное</button></div>
 <section className="form-section ui-form-section"><h2 className="form-section-heading">Основная информация</h2><div className="form-fields-grid"><div className="form-fields-column">
 {input('name',nameLabel(kind),'text',true,kind==='vehicles'?100:255)}
 {kind==='drivers'&&<>{input('phoneNumber','Телефон','tel',false,30)}{input('poaNumber','Доверенность')}{input('poaValidTo','Доверенность действительна до','date')}</>}
 {kind==='vehicles'&&input('insuranceNumber','Страховка')}
 </div><div className="form-fields-column">
 <label className="field horizontal-field"><span>Активный</span><span className="ui-readonly-value"><UiInput type="checkbox" checked={draft.active} disabled={!editing||busy} onChange={e=>field('active',e.target.checked)}/></span></label>
 {kind==='vehicles'&&<><label className="field horizontal-field"><span>Наличие прицепа</span><span className="ui-readonly-value">{!editing&&draft.withTrailer==null?'—':<UiInput type="checkbox" checked={draft.withTrailer===true} disabled={!editing||busy} onChange={e=>{field('withTrailer',e.target.checked);if(!e.target.checked)field('trailerNumber',null)}}/>}</span></label>{(draft.withTrailer||!editing)&&input('trailerNumber','Номер прицепа','text',editing&&draft.withTrailer===true,20)}</>}
 </div></div></section></form>}
 </section>
}
