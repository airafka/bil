import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { generateWaybill } from '../api'
import { Notification } from '../components/Notification'
import { UiInput } from '../components/FormControls'

export function WaybillGeneratePage() {
  const [twenty,setTwenty]=useState('0'),[forty,setForty]=useState('0')
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const lock=useRef(false),navigate=useNavigate()
  const a=Number(twenty),b=Number(forty),total=a+b
  const valid=/^\d+$/.test(twenty)&&/^\d+$/.test(forty)&&Number.isSafeInteger(total)&&a>=0&&b>=0&&total>0&&total<=200
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if(lock.current||!valid)return
    lock.current=true;setBusy(true);setError('')
    try { const result=await generateWaybill(a,b);navigate('/waybills',{state:{createdNumber:result.number}}) }
    catch(e){setError(e instanceof Error?e.message:'Не удалось создать накладную');lock.current=false;setBusy(false)}
  }
  return <section className="form-page"><form onSubmit={submit}>
    <div className="page-header form-page-header"><h1>Автоматическое создание накладной</h1><div className="header-actions"><Link className="close-button" to="/waybills" aria-label="Закрыть">×</Link><button type="submit" className="primary-button" disabled={!valid||busy}>{busy?'Создаём…':'Создать накладную'}</button></div></div>
    {error&&<Notification kind="error">{error}</Notification>}
    <div className="form-workspace"><div className="form-section"><h2>Круглое поле → Владивосток</h2><p>Плательщик: ФИТ</p>
      <div className="form-fields-grid"><label className="field"><span>Количество КТК стандарта 20</span><UiInput type="number" min={0} max={200} step={1} required value={twenty} disabled={busy} onChange={e=>setTwenty(e.target.value)}/></label><label className="field"><span>Количество КТК стандарта 40</span><UiInput type="number" min={0} max={200} step={1} required value={forty} disabled={busy} onChange={e=>setForty(e.target.value)}/></label></div>
      <p>Одна накладная, новые КТК. От 1 до 200 контейнеров за один раз.</p>
      <p>Демонстрационный груз: Пшеница · Неопасный груз. Нетто: 10 000 кг для КТК 20 и 20 000 кг для КТК 40. Тара: 3 200 кг.</p>
      <p>На каждом КТК — Иностранное ЗПУ с новым номером. Вагоны подбираются автоматически; недостающие создаются с демонстрационными реквизитами.</p>
      {valid&&<p>Будет создано: 1 накладная, {total} КТК. Номер накладной — первый свободный начиная с 1743125938.</p>}
    </div></div></form></section>
}
