import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/orders', label: 'Sales Orders', icon: '🧾' },
  { to: '/approvals', label: 'Approvals', icon: '✅', managerOnly: true },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/users', label: 'Users', icon: '🔐', adminOnly: true },
]

const TITLES = {
  '/': 'Dashboard',
  '/orders': 'Sales Orders',
  '/orders/new': 'New Sales Order',
  '/approvals': 'Approval Queue',
  '/products': 'Products & Inventory',
  '/customers': 'Customers',
  '/users': 'User Management',
}

export default function Layout() {
  const { user, logout, isManager, isAdmin } = useAuth()
  const { pathname } = useLocation()
  const title = TITLES[pathname] || 'Sales & Inventory'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">📚 Book<span>Expert</span></div>
        <nav>
          {NAV.filter((n) => (!n.managerOnly || isManager) && (!n.adminOnly || isAdmin)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="user-box">
          <div className="name">{user?.name}</div>
          <div className="role">{user?.role}</div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%', color: '#e5e7eb', borderColor: '#374151' }}
            onClick={logout}>Sign out</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{new Date().toLocaleDateString()}</div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}
