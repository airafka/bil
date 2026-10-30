import type { ServiceProgress } from '../serviceOrder'

export function ServiceProgressCards({ progress }: { progress: ServiceProgress }) {
  return <div className="service-progress">
    <section aria-labelledby="initial-progress-title">
      <h2 id="initial-progress-title">{progress.initialServiceName || 'Наименование услуги не настроено'}</h2>
      <table className="service-progress-table" aria-labelledby="initial-progress-title">
        <MetricHead />
        <Operation label="Поставка КТК" accessibleLabel="Первоначальная поставка КТК" total={progress.total} completed={progress.accepted} />
        <Operation label="Вывоз КТК" total={progress.shippingCreated} completed={progress.shippingCompleted}
          orderCount={progress.shippingOrderCount} ordersCompleted={progress.shippingOrdersCompleted} />
      </table>
      {progress.shippingMissing > 0 && <div className="service-progress-missing">{`Без заявки на вывоз: ${progress.shippingMissing} КТК. Создайте заявку на вывоз.`}</div>}
    </section>
    {progress.returnCreated > 0 && <section aria-labelledby="return-progress-title">
      <h2 id="return-progress-title">{progress.returnServiceName || 'Наименование услуги не настроено'}</h2>
      <table className="service-progress-table" aria-labelledby="return-progress-title">
        <MetricHead />
        <Operation label="Поставка КТК" accessibleLabel="Возвратная поставка КТК" total={progress.returnCreated} completed={progress.returnCompleted}
          orderCount={progress.returnOrderCount} ordersCompleted={progress.returnOrdersCompleted} />
      </table>
    </section>}
  </div>
}

function MetricHead() {
  return <thead><tr><th scope="col">Операция</th><th scope="col">Показатель</th><th scope="col">Всего</th><th scope="col">Выполнено</th></tr></thead>
}

function Operation({ label, accessibleLabel = label, total, completed, orderCount, ordersCompleted }: {
  label: string; accessibleLabel?: string; total: number; completed: number; orderCount?: number; ordersCompleted?: number
}) {
  return <tbody aria-label={accessibleLabel}>
    <tr>
      <th className="service-progress-operation" scope="rowgroup" rowSpan={orderCount === undefined ? 1 : 2}>{label}</th>
      {orderCount !== undefined
        ? <><th scope="row">Заявки</th><td>{orderCount}</td><td>{ordersCompleted}</td></>
        : <><th scope="row">КТК</th><td>{total}</td><td>{completed}</td></>}
    </tr>
    {orderCount !== undefined && <tr><th scope="row">КТК</th><td>{total}</td><td>{completed}</td></tr>}
  </tbody>
}
