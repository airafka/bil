import { useState } from 'react'
import { UiInput, UiSelect, UiTextarea } from '../components/FormControls'
import { ActionIcon } from '../components/ActionIcon'

/** Interactive visual reference using the same components/styles as working pages. No API writes. */
export function UiKitPage() {
  const [owner, setOwner] = useState('one')
  const [expanded, setExpanded] = useState(true)
  return <section className="form-page">
    <div className="page-header"><h1>Стандарт интерфейса</h1><div className="header-actions"><button className="secondary-button">Второстепенное действие</button><button className="primary-button">Основное действие</button><button className="secondary-button icon-button" aria-label="Редактировать"><ActionIcon name="edit" /></button></div></div>
    <div className="form-workspace">
      <div className="stepper"><button className="step current">Основное</button><button className="step">КТК</button><button className="step" disabled>Недоступно</button></div>
      <section className="form-section ui-form-section"><div className="form-section-heading"><h2>Поля</h2></div><div className="form-fields-grid"><div className="form-fields-column">
        <label className="field horizontal-field"><span>Наименование <b>*</b></span><UiInput placeholder="Введите наименование" required /></label>
        <label className="field horizontal-field"><span>Собственник <b>*</b></span><UiSelect value={owner} onChange={e=>setOwner(e.target.value)}><option value="one">ООО «Мангуст»</option><option value="two">ООО «Опт-Логистика»</option></UiSelect></label>
        <label className="field horizontal-field"><span>Дата и время</span><UiInput type="datetime-local" /></label>
        <label className="field horizontal-field"><span>Комментарий</span><UiTextarea /></label>
      </div><div className="form-fields-column">
        <label className="field horizontal-field"><span>Только просмотр</span><UiInput value="Контейнерная площадка" readOnly /></label>
        <label className="field horizontal-field"><span>Недоступное поле</span><UiInput value="Недоступно" disabled /></label>
        <label className="field horizontal-field"><span>Поле с ошибкой</span><span className="field-control"><UiInput aria-invalid="true" aria-describedby="sample-error" /><small id="sample-error">Заполните поле</small></span></label>
        <label className="field horizontal-field"><span>Порожний</span><UiInput type="checkbox" /></label>
      </div></div></section>
      <section className="form-section ui-form-section"><div className="form-section-heading"><h2>Таблица с иерархией</h2></div>
        <div className="table-wrap"><table aria-label="Пример таблицы"><colgroup>{[44,150,140,220,150,140].map((width,i)=><col key={i} style={{width}} />)}</colgroup><thead><tr><th>№</th><th>Номер КТК</th><th>Тип КТК</th><th>Собственник КТК</th><th>Рейс</th><th>Статус</th></tr></thead><tbody>
          <tr className="composition-group"><td className="composition-index" rowSpan={expanded ? 2 : 1}>1</td><th colSpan={5}><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded ? '⌄' : '›'} Накладная № 1743125961</button></th></tr>
          {expanded && <tr><td>TKRU9001738</td><td>Стандартный 40</td><td><UiSelect aria-label="Собственник КТК TKRU9001738" value={owner} onChange={e=>setOwner(e.target.value)}><option value="one">ООО «Мангуст»</option><option value="two">ООО «Опт-Логистика»</option></UiSelect></td><td><button className="secondary-button create-route-button">Создать рейс</button></td><td><span className="status-badge" data-status="DRAFT">Черновик</span></td></tr>}
        </tbody></table></div>
      </section>
    </div>
  </section>
}
