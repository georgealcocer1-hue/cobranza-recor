import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Credits from './pages/Credits'
import CreditDetail from './pages/CreditDetail'
import AdminUsers from './pages/admin/Users'
import AdminSectors from './pages/admin/Sectors'

function wrap(Page, adminOnly = false) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Layout><Page /></Layout>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/"              element={wrap(Dashboard)} />
      <Route path="/clients"       element={wrap(Clients)} />
      <Route path="/clients/:id"   element={wrap(ClientDetail)} />
      <Route path="/credits"       element={wrap(Credits)} />
      <Route path="/credits/:id"   element={wrap(CreditDetail)} />
      <Route path="/admin/users"   element={wrap(AdminUsers, true)} />
      <Route path="/admin/sectors" element={wrap(AdminSectors, true)} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
