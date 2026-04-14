import { NavLink, useNavigate } from 'react-router-dom'
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

  function handleLogout() { logout(); navigate('/login') }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="w-56 bg-blue-800 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-blue-700">
          <h1 className="text-lg font-bold leading-tight">Cobranza</h1>
          <p className="text-blue-300 text-xs mt-0.5 truncate">{user?.full_name}</p>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-700 hover:text-white'
                }`
              }>
              <span>{icon}</span>{label}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-blue-400 text-xs uppercase tracking-wider">Administración</p>
              </div>
              {adminItems.map(({ to, label, icon }) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-700 hover:text-white'
                    }`
                  }>
                  <span>{icon}</span>{label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-blue-700">
          <button onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-blue-200 hover:text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto min-w-0">{children}</main>
    </div>
  )
}
