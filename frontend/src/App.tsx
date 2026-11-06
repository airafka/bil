const TransportCatalogRegistryPage = lazy(() => import('./pages/TransportCatalogPages').then(m => ({default:m.TransportCatalogRegistryPage})))
const TransportCatalogCardPage = lazy(() => import('./pages/TransportCatalogPages').then(m => ({default:m.TransportCatalogCardPage})))
import { NotificationProvider } from './components/Notification'
import { lazy, Suspense } from 'react'
const ContainerStockPage = lazy(() => import('./pages/ContainerStockPages').then(m => ({ default: m.ContainerStockPage })))
const ContainerHistoryPage = lazy(() => import('./pages/ContainerStockPages').then(m => ({ default: m.ContainerHistoryPage })))
const OwnershipOrderRegistryPage = lazy(() => import('./pages/OwnershipOrderPages').then(m => ({ default: m.OwnershipOrderRegistryPage })))
const OwnershipOrderCreatePage = lazy(() => import('./pages/OwnershipOrderPages').then(m => ({ default: m.OwnershipOrderCreatePage })))
const OwnershipOrderViewPage = lazy(() => import('./pages/OwnershipOrderPages').then(m => ({ default: m.OwnershipOrderViewPage })))
const InvoiceRegistryPage = lazy(() => import('./pages/PaymentInvoicePages').then(module => ({ default: module.InvoiceRegistryPage })))
const InvoiceCreatePage = lazy(() => import('./pages/PaymentInvoicePages').then(module => ({ default: module.InvoiceCreatePage })))
const InvoiceTariffPage = lazy(() => import('./pages/PaymentInvoicePages').then(module => ({ default: module.InvoiceTariffPage })))
const InvoiceViewPage = lazy(() => import('./pages/PaymentInvoicePages').then(module => ({ default: module.InvoiceViewPage })))
const BillingChargesPage = lazy(() => import('./pages/BillingChargesPage').then(module => ({ default: module.BillingChargesPage })))
const RouteRegistryPage = lazy(() => import('./pages/RoutePages').then(module => ({ default: module.RouteRegistryPage })))
const RouteCreatePage = lazy(() => import('./pages/RoutePages').then(module => ({ default: module.RouteCreatePage })))
const RouteViewPage = lazy(() => import('./pages/RoutePages').then(module => ({ default: module.RouteViewPage })))
const RailwayCarriageRegistryPage = lazy(() => import('./pages/RailwayCarriageRegistryPage').then(module => ({ default: module.RailwayCarriageRegistryPage })))
const ContainerRegistryPage = lazy(() => import('./pages/ContainerRegistryPage').then(module => ({ default: module.ContainerRegistryPage })))
const ComprehensiveServiceOrderRegistryPage = lazy(() => import('./pages/ComprehensiveServiceOrderRegistryPage').then(module => ({ default: module.ComprehensiveServiceOrderRegistryPage })))
const ComprehensiveServiceOrderViewPage = lazy(() => import('./pages/ComprehensiveServiceOrderViewPage').then(module => ({ default: module.ComprehensiveServiceOrderViewPage })))
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { orderConfigs } from './domain'
const CreateOrderPage = lazy(() => import('./pages/CreateOrderPage').then(module => ({ default: module.CreateOrderPage })))
const OrderListPage = lazy(() => import('./pages/OrderListPage').then(module => ({ default: module.OrderListPage })))
const OrderViewPage = lazy(() => import('./pages/OrderViewPage').then(module => ({ default: module.OrderViewPage })))
const WaybillCreatePage = lazy(() => import('./pages/WaybillCreatePage').then(module => ({ default: module.WaybillCreatePage })))
const WaybillRegistryPage = lazy(() => import('./pages/WaybillRegistryPage').then(module => ({ default: module.WaybillRegistryPage })))
const ComplexServiceRegistryPage = lazy(() => import('./pages/ComplexServicePages').then(module => ({ default: module.ComplexServiceRegistryPage })))
const ComplexServiceCreatePage = lazy(() => import('./pages/ComplexServicePages').then(module => ({ default: module.ComplexServiceCreatePage })))
const TariffViewPage = lazy(() => import('./pages/ComplexServicePages').then(module => ({ default: module.TariffViewPage })))
const ComplexServiceViewPage = lazy(() => import('./pages/ComplexServicePages').then(module => ({ default: module.ComplexServiceViewPage })))

const WaybillGeneratePage = lazy(() => import('./pages/WaybillGeneratePage').then(module => ({ default: module.WaybillGeneratePage })))

const UiKitPage = lazy(() => import('./pages/UiKitPage').then(module => ({ default: module.UiKitPage })))

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider><AppLayout>
        <Suspense fallback={<div className="view-loading" role="status">Загружаем раздел…</div>}><Routes>
          <Route path="/ui-kit" element={<UiKitPage />} />
          <Route path="/" element={<Navigate to="/receiving-orders" replace />} />
          <Route path="/container-owners" element={<ContainerStockPage />} />
          <Route path="/container-owners/:containerId/history" element={<ContainerHistoryPage />} />
          <Route path="/service-orders" element={<OwnershipOrderRegistryPage />} />
          <Route path="/service-orders/new" element={<OwnershipOrderCreatePage />} />
          <Route path="/service-orders/:ownershipOrderId" element={<OwnershipOrderViewPage />} />
          <Route path="/billing-charges" element={<BillingChargesPage />} />
          <Route path="/payment-invoices" element={<InvoiceRegistryPage />} />
          <Route path="/payment-invoices/new" element={<InvoiceCreatePage />} />
          <Route path="/payment-invoices/:invoiceId/tariffs/:chargeId" element={<InvoiceTariffPage />} />
          <Route path="/payment-invoices/:invoiceId" element={<InvoiceViewPage />} />
          <Route path="/comprehensive-service-orders" element={<ComprehensiveServiceOrderRegistryPage />} />
          <Route path="/comprehensive-service-orders/new" element={<CreateOrderPage key="service" config={orderConfigs.receiving} serviceMode />} />
          <Route path="/comprehensive-service-orders/:comprehensiveServiceOrderId" element={<ComprehensiveServiceOrderViewPage />} />
          <Route path="/complex-services" element={<ComplexServiceRegistryPage />} />
          <Route path="/complex-services/new" element={<ComplexServiceCreatePage />} />
          <Route path="/complex-services/tariffs/:tariffId" element={<TariffViewPage />} />
          <Route path="/complex-services/:complexServiceId" element={<ComplexServiceViewPage />} />
          <Route path="/receiving-orders" element={<OrderListPage key="receiving" config={orderConfigs.receiving} />} />
          <Route path="/receiving-orders/new" element={<CreateOrderPage key="receiving" config={orderConfigs.receiving} />} />
          <Route path="/receiving-orders/:orderId" element={<OrderViewPage key="receiving" config={orderConfigs.receiving} />} />
          <Route path="/shipping-orders" element={<OrderListPage key="shipping" config={orderConfigs.shipping} />} />
          <Route path="/shipping-orders/new" element={<CreateOrderPage key="shipping" config={orderConfigs.shipping} />} />
          <Route path="/shipping-orders/:orderId" element={<OrderViewPage key="shipping" config={orderConfigs.shipping} />} />
          {(['carriers','drivers','vehicles'] as const).flatMap(kind=>[
            <Route key={kind} path={'/transport-'+kind} element={<TransportCatalogRegistryPage key={kind} kind={kind}/>}/>,
            <Route key={kind+'new'} path={'/transport-'+kind+'/new'} element={<TransportCatalogCardPage key={kind+'new'} kind={kind} creating/>}/>,
            <Route key={kind+'view'} path={'/transport-'+kind+'/:entryId'} element={<TransportCatalogCardPage key={kind+'view'} kind={kind}/>}/>
          ])}
          <Route path="/routes" element={<RouteRegistryPage />} />
          <Route path="/routes/new" element={<RouteCreatePage />} />
          <Route path="/routes/:routeId" element={<RouteViewPage />} />
          <Route path="/railway-carriages" element={<RailwayCarriageRegistryPage />} />
          <Route path="/containers" element={<ContainerRegistryPage />} />
          <Route path="/waybills" element={<WaybillRegistryPage />} />
          <Route path="/waybills/generate" element={<WaybillGeneratePage />} />
          <Route path="/waybills/create" element={<WaybillCreatePage />} />
          <Route path="*" element={<section className="table-card empty-state"><h1>Страница не найдена</h1><p>Проверьте адрес или откройте реестр заявок.</p><Link className="primary-button" to="/comprehensive-service-orders">К заявкам на услугу</Link></section>} />
        </Routes></Suspense>
      </AppLayout></NotificationProvider>
    </BrowserRouter>
  )
}

export default App
