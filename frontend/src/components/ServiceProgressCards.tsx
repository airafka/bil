import type { ServiceProgress } from '../serviceOrder'

export function ServiceProgressCards({ progress }: { progress: ServiceProgress }) {
  return <div className="service-progress">
    <section className="service-progress-initial" aria-labelledby="initial-progress-title">
      <h2 id="initial-progress-title">{progress.initialServiceName || 'Наименование услуги не настроено'}</h2>
      <div className="service-progress-cards service-progress-cards--two">
        <Metric label="Приём КТК" total={progress.total} completed={progress.accepted} />
        <Metric label="Вывоз КТК" total={progress.shippingCreated} completed={progress.shippingCompleted} missing={progress.shippingMissing} />
      </div>
    </section>
    {progress.returnCreated > 0 && <section aria-labelledby="return-progress-title">
      <h2 id="return-progress-title">{progress.returnServiceName || 'Наименование услуги не настроено'}</h2>
      <div className="service-progress-cards">
        <Metric label="Поставка КТК" total={progress.returnCreated} completed={progress.returnCompleted} />
      </div>
    </section>}
  </div>
}

function Metric({ label, total, completed, missing }: {
  label: string; total: number; completed: number; missing?: number
}) {
  return <div className={`service-progress-card ${total > 0 && completed === total ? 'completed' : ''}`}>
    <span>{label}</span>
    <strong aria-label={`Всего КТК: ${total}, выполнено: ${completed}`}>{`${total} / ${completed}`}</strong>
    <span>Всего КТК / Выполнено</span>
    {missing !== undefined && missing > 0 && <span className="service-progress-missing">{`Без заявки на вывоз: ${missing}. Создайте заявку на вывоз.`}</span>}
  </div>
}
