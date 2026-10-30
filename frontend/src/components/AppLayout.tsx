import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const navigationGroups = [
  { title: 'Справочники', icon: 'list', items: [
    { path: '/railway-carriages', title: 'Вагоны', icon: 'list' },
    { path: '/containers', title: 'КТК', icon: 'list' },
    { path: '/routes', title: 'Рейсы', icon: 'list' },
    { path: '/waybills', title: 'Накладные ЭТРАН', icon: 'list' },
    { path: '/complex-services', title: 'Комплексные услуги', icon: 'billing' },
  ] },
  { title: 'Отчеты', icon: 'paper', items: [] },
  { title: 'Заявки', icon: 'documents', items: [
    { path: '/receiving-orders', title: 'Заявки на поставку', icon: 'paper' },
    { path: '/shipping-orders', title: 'Заявки на вывоз', icon: 'paper' },
    { path: '/service-orders', title: 'Заявки на услуги', icon: 'billing' },
  ] },
  { title: 'Биллинг', icon: 'billing', items: [
    { path: '/billing-charges', title: 'Оказанные услуги', icon: 'billing' },
    { path: '/payment-invoices', title: 'Счета на оплату', icon: 'paper' },
  ] },
]
const navigation = navigationGroups.flatMap(group => group.items)

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [expanded, setExpanded] = useState(() => { try { return localStorage.getItem('billing-menu') === 'expanded' } catch { return false } })
  useEffect(() => { try { localStorage.setItem('billing-menu', expanded ? 'expanded' : 'collapsed') } catch { /* Storage may be unavailable. */ } }, [expanded])
  useEffect(() => { document.title = (navigation.find(item => pathname.startsWith(item.path))?.title ?? 'Биллинг') + ' · Биллинг 2.0'; window.scrollTo(0, 0) }, [pathname])
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (title: string) => {
    if (!expanded) setExpanded(true)
    setOpenGroups(current => {
      const next = window.matchMedia('(max-width: 640px)').matches ? new Set<string>(current.has(title) ? [title] : []) : new Set(current)
      if (next.has(title)) next.delete(title); else next.add(title)
      return next
    })
  }
  const current = navigation.find(item => pathname.startsWith(item.path))
  const isCreating = pathname.endsWith('/new') || pathname.endsWith('/create')
  const isViewing = !isCreating && pathname.split('/').filter(Boolean).length > 1
  return <div className="app-shell" data-menu-expanded={expanded}>
    <a className="skip-link" href="#main-content">Перейти к содержимому</a>
    <aside className="sidebar">
      <Link className="brand-mark" to="/" aria-label="Биллинг 2.0"><img src="/icons/figma/logo.svg" alt="" /></Link>
      <button type="button" className="menu-toggle" aria-label={expanded ? 'Свернуть меню' : 'Развернуть меню'} aria-expanded={expanded} aria-controls="main-navigation" onClick={() => setExpanded(value => !value)}>{expanded ? '‹' : '›'}</button>
      <nav id="main-navigation" className="main-nav navigation-tree" aria-label="Основная навигация">
        {navigationGroups.map((group, index) => {
          const open = expanded && openGroups.has(group.title)
          const active = group.items.some(item => pathname.startsWith(item.path))
          return <section className="nav-section" key={group.title} aria-labelledby={`nav-group-${index}`}>
            <h2 className="nav-section-heading" id={`nav-group-${index}`}>
              {group.items.length ? <button type="button" className={`nav-section-toggle ${active ? 'highlighted' : ''}`} aria-label={group.title} title={group.title} aria-expanded={open} aria-controls={`nav-children-${index}`} onClick={() => toggleGroup(group.title)}>
                <span className="nav-section-icon" aria-hidden="true" style={{ maskImage: `url(/icons/figma/${group.icon}.svg)` }} />
                <span className="nav-label">{group.title}</span>
                <svg className="nav-section-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button> : <div className="nav-section-label" title={group.title}><span className="nav-section-icon" aria-hidden="true" style={{ maskImage: `url(/icons/figma/${group.icon}.svg)` }} /><span className="nav-label">{group.title}</span></div>}
            </h2>
            {group.items.length > 0 && <div className="nav-children" id={`nav-children-${index}`} hidden={!open}>
              {group.items.map(item => <div className="nav-entry" key={item.path}><NavLink to={item.path} className={({ isActive }) => isActive ? 'active' : ''} title={item.title} aria-label={item.title}><span className="nav-label">{item.title}</span></NavLink></div>)}
            </div>}
          </section>
        })}
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

