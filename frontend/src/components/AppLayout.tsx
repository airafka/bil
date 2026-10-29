import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const navigation = [
  { path: '/service-orders', title: 'Заявки на услугу', icon: 'billing' },
  { path: '/receiving-orders', title: 'Заявки на поставку', icon: 'paper' },
  { path: '/shipping-orders', title: 'Заявки на вывоз', icon: 'paper' },
  { path: '/waybills', title: 'Накладные', icon: 'list' },
  { path: '/routes', title: 'Рейсы', icon: 'list' },
  { path: '/billing-charges', title: 'Оказанные услуги', icon: 'billing' },
  { path: '/payment-invoices', title: 'Счета на оплату', icon: 'paper' },
  { path: '/complex-services', title: 'Комплексные услуги', icon: 'billing' },
  { path: '/containers', title: 'Справочник КТК', icon: 'list' },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [expanded, setExpanded] = useState(() => { try { return localStorage.getItem('billing-menu') !== 'collapsed' } catch { return true } })
  useEffect(() => { try { localStorage.setItem('billing-menu', expanded ? 'expanded' : 'collapsed') } catch { /* Storage may be unavailable. */ } }, [expanded])
  useEffect(() => { document.title = (navigation.find(item => pathname.startsWith(item.path))?.title ?? 'Биллинг') + ' · Биллинг 2.0'; window.scrollTo(0, 0) }, [pathname])
  const current = navigation.find(item => pathname.startsWith(item.path))
  const isCreating = pathname.endsWith('/new') || pathname.endsWith('/create')
  const isViewing = !isCreating && pathname.split('/').filter(Boolean).length > 1
  return <div className="app-shell" data-menu-expanded={expanded}>
    <a className="skip-link" href="#main-content">Перейти к содержимому</a>
    <aside className="sidebar">
      <Link className="brand-mark" to="/" aria-label="Биллинг 2.0"><img src="/icons/figma/logo.svg" alt="" /></Link>
      <button type="button" className="menu-toggle" aria-label={expanded ? 'Свернуть меню' : 'Развернуть меню'} aria-expanded={expanded} aria-controls="main-navigation" onClick={() => setExpanded(value => !value)}>{expanded ? '‹' : '›'}</button>
      <nav id="main-navigation" className="main-nav" aria-label="Основная навигация">
        {navigation.map((item, index) => <div className="nav-entry" key={item.path}>
          {[0, 5, 7].includes(index) && <span className="nav-group">{index === 0 ? 'Операции' : index === 5 ? 'Учёт' : 'Справочники'}</span>}
          <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? 'active' : ''} title={item.title} aria-label={item.title}>
          <span className="nav-icon" aria-hidden="true"><img src={`/icons/figma/${item.icon}.svg`} alt="" /></span><span className="nav-label">{item.title}</span>
        </NavLink></div>)}
      </nav>
      <div className="sidebar-footer" title="Локальная система"><span className="online-dot" /><span className="nav-label">Локальная система</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <nav className="breadcrumbs" aria-label="Навигационная цепочка"><Link to="/">Главная</Link><span aria-hidden="true">—</span><Link to={current?.path ?? '/'}>{current?.title ?? 'Биллинг'}</Link>{(isCreating || isViewing) && <><span aria-hidden="true">—</span><strong>{isCreating ? 'Создание' : 'Просмотр'}</strong></>}</nav>
        <div className="user-badge" title="Локальный пользователь"><img src="/icons/figma/avatar.svg" alt="Локальный пользователь" /></div>
      </header>
      <main id="main-content" className="content" tabIndex={-1}>{children}</main>
    </div>
  </div>
}

