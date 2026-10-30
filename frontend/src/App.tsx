import { lazy, Suspense } from 'react'
const InvoiceRegistryPage = lazy(() => import('./pages/PaymentInvoicePages').then(module => ({ default: module.InvoiceRegistryPage })))
const InvoiceCreatePage = lazy(() => import('./pages/PaymentInvoicePages').then(module => ({ default: module.InvoiceCreatePage })))
const InvoiceViewPage = lazy(() => import('./pages/PaymentInvoicePages').then(module => ({ default: module.InvoiceViewPage })))
const BillingChargesPage = lazy(() => import('./pages/BillingChargesPage').then(module => ({ default: module.BillingChargesPage })))
const RouteRegistryPage = lazy(() => import('./pages/RoutePages').then(module => ({ default: module.RouteRegistryPage })))
const RouteCreatePage = lazy(() => import('./pages/RoutePages').then(module => ({ default: module.RouteCreatePage })))
const RouteViewPage = lazy(() => import('./pages/RoutePages').then(module => ({ default: module.RouteViewPage })))
const RailwayCarriageRegistryPage = lazy(() => import('./pages/RailwayCarriageRegistryPage').then(module => ({ default: module.RailwayCarriageRegistryPage })))
const ContainerRegistryPage = lazy(() => import('./pages/ContainerRegistryPage').then(module => ({ default: module.ContainerRegistryPage })))
const ServiceOrderRegistryPage = lazy(() => import('./pages/ServiceOrderRegistryPage').then(module => ({ default: module.ServiceOrderRegistryPage })))
const ServiceOrderViewPage = lazy(() => import('./pages/ServiceOrderViewPage').then(module => ({ default: module.ServiceOrderViewPage })))
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
const ComplexServiceViewPage = lazy(() => import('./pages/ComplexServicePages').then(module => ({ default: module.ComplexServiceViewPage })))

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Suspense fallback={<div className="view-loading" role="status">Загружаем раздел…</div>}><Routes>
          <Route path="/" element={<Navigate to="/receiving-orders" replace />} />
          <Route path="/billing-charges" element={<BillingChargesPage />} />
          <Route path="/payment-invoices" element={<InvoiceRegistryPage />} />
          <Route path="/payment-invoices/new" element={<InvoiceCreatePage />} />
          <Route path="/payment-invoices/:invoiceId" element={<InvoiceViewPage />} />
          <Route path="/service-orders" element={<ServiceOrderRegistryPage />} />
          <Route path="/service-orders/new" element={<CreateOrderPage key="service" config={orderConfigs.receiving} serviceMode />} />
          <Route path="/service-orders/:serviceOrderId" element={<ServiceOrderViewPage />} />
          <Route path="/complex-services" element={<ComplexServiceRegistryPage />} />
          <Route path="/complex-services/new" element={<ComplexServiceCreatePage />} />
          <Route path="/complex-services/:complexServiceId" element={<ComplexServiceViewPage />} />
          <Route path="/receiving-orders" element={<OrderListPage key="receiving" config={orderConfigs.receiving} />} />
          <Route path="/receiving-orders/new" element={<CreateOrderPage key="receiving" config={orderConfigs.receiving} />} />
          <Route path="/receiving-orders/:orderId" element={<OrderViewPage key="receiving" config={orderConfigs.receiving} />} />
          <Route path="/shipping-orders" element={<OrderListPage key="shipping" config={orderConfigs.shipping} />} />
          <Route path="/shipping-orders/new" element={<CreateOrderPage key="shipping" config={orderConfigs.shipping} />} />
          <Route path="/shipping-orders/:orderId" element={<OrderViewPage key="shipping" config={orderConfigs.shipping} />} />
          <Route path="/routes" element={<RouteRegistryPage />} />
          <Route path="/routes/new" element={<RouteCreatePage />} />
          <Route path="/routes/:routeId" element={<RouteViewPage />} />
          <Route path="/railway-carriages" element={<RailwayCarriageRegistryPage />} />
          <Route path="/containers" element={<ContainerRegistryPage />} />
          <Route path="/waybills" element={<WaybillRegistryPage />} />
          <Route path="/waybills/create" element={<WaybillCreatePage />} />
          <Route path="*" element={<section className="table-card empty-state"><h1>Страница не найдена</h1><p>Проверьте адрес или откройте реестр заявок.</p><Link className="primary-button" to="/service-orders">К заявкам на услугу</Link></section>} />
        </Routes></Suspense>
      </AppLayout>
    </BrowserRouter>
  )
}

export default App
