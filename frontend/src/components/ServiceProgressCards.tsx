import type { ServiceProgress } from '../comprehensiveServiceOrder'

export function ServiceProgressCards({ progress, initialOrderStatus }: { progress: ServiceProgress; initialOrderStatus: string }) {
  return <div className="service-progress" aria-label="Выполнение этапов услуги">
    <section aria-labelledby="initial-progress-title">
      <h2 id="initial-progress-title">Поставка - ЖД</h2>
      <dl className="service-progress-metrics">
        <Metric label="Заявки" completed={initialOrderStatus === 'COMPLETED' ? 1 : 0} total={1} />
        <Metric label="КТК" completed={progress.accepted} total={progress.total} />
      </dl>
    </section>
    <section aria-labelledby="shipping-progress-title">
      <h2 id="shipping-progress-title">Вывоз - Авто</h2>
      <dl className="service-progress-metrics">
        <Metric label="Заявки" completed={progress.shippingOrdersCompleted} total={progress.shippingOrderCount} />
        <Metric label="КТК" completed={progress.shippingCompleted} total={progress.shippingCreated} />
      </dl>
      {progress.shippingMissing > 0 && <p className="service-progress-missing">{`Без заявки на вывоз: ${progress.shippingMissing} КТК. Создайте заявку на вывоз.`}</p>}
    </section>
    <section aria-labelledby="return-progress-title">
      <h2 id="return-progress-title">Поставка - Авто</h2>
      <dl className="service-progress-metrics">
        <Metric label="Заявки" completed={progress.returnOrdersCompleted} total={progress.returnOrderCount} />
        <Metric label="КТК" completed={progress.returnCompleted} total={progress.returnCreated} />
      </dl>
    </section>
  </div>
}

function Metric({ label, completed, total }: { label: string; completed: number; total: number }) {
  return <div aria-label={`${label}: выполнено ${completed} из ${total}`}>
    <dt>{label}</dt>
    <dd><strong>{completed}</strong><span>из</span><span className="service-progress-total">{total}</span></dd>
  </div>
}
