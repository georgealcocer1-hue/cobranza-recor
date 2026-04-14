import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/',        label: 'Cobros del Día', icon: '📋' },
  { to: '/clients', label: 'Clientes',       icon: '👥' },
  { to: '/credits', label: 'Créditos',       icon: '💳' },
]

const adminItems = [
  { to: '/admin/stats',   label: 'Estadísticas', icon: '📊' },
  { to: '/admin/sectors', label: 'Sectores',     icon: '🗺️' },
  { to: '/admin/users',   label: 'Cobradores',   icon: '👤' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false) }, [location.pathname])

  function handleLogout() { logout(); navigate('/login') }

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-700/60 hover:text-white'
    }`

  const sidebar = (
    <>
      <div className="px-4 py-4 border-b border-blue-700 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold leading-tight">Cobranza</h1>
          <p className="text-blue-300 text-xs mt-0.5 truncate">{user?.full_name}</p>
        </div>
        {/* Close button (mobile only) */}
        <button onClick={() => setOpen(false)}
          className="lg:hidden text-blue-300 hover:text-white p-1 -mr-1">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {navItems.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={navLinkClass}>
            <span className="text-lg">{icon}</span>{label}
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-blue-400 text-[10px] uppercase tracking-widest font-semibold">Administración</p>
            </div>
            {adminItems.map(({ to, label, icon }) => (
              <NavLink key={to} to={to} className={navLinkClass}>
                <span className="text-lg">{icon}</span>{label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-blue-700">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-blue-200 hover:text-white text-sm rounded-lg hover:bg-blue-700/60 transition-colors">
          <span className="text-lg">🚪</span>Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-blue-800 text-white flex items-center justify-between px-4 h-14 shadow-md">
        <button onClick={() => setOpen(true)} className="p-1 -ml-1">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-base font-bold">Cobranza</h1>
        <p className="text-blue-300 text-xs truncate max-w-[100px]">{user?.full_name}</p>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] bg-blue-800 text-white flex flex-col z-50 shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:fixed lg:inset-y-0 bg-blue-800 text-white z-20">
          {sidebar}
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:ml-56 min-h-screen">
          <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
