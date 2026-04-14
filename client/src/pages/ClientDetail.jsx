import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../api'

const PERIOD_LABELS = {
  daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal',
  monthly: 'Mensual', specific_days: 'Días específicos',
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({})

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
  })

  const { data: sectors = [] } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => api.get('/sectors').then(r => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: data => api.put(`/clients/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      setEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      navigate('/clients')
    },
  })

  function startEdit() {
    setForm({
      full_name: client.full_name || '',
      phone: client.phone || '',
      address: client.address || '',
      sector_id: client.sector_id || '',
    })
    setEditing(true)
  }

  if (isLoading) return <div className="text-center text-gray-400 py-20">Cargando...</div>
  if (!client) return <div className="text-center text-gray-400 py-20">Cliente no encontrado</div>

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/clients')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1">
        ← Volver a clientes
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        {!editing ? (
          <>
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-900">{client.full_name}</h2>
              <div className="flex gap-2">
                <button onClick={startEdit}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Editar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {client.phone && (
                <div>
                  <p className="text-gray-400 text-xs">Teléfono</p>
                  <p className="font-medium">{client.phone}</p>
                </div>
              )}
              {client.sector_name && (
                <div>
                  <p className="text-gray-400 text-xs">Sector</p>
                  <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5">
                    {client.sector_name}
                  </span>
                </div>
              )}
              {client.address && (
                <div className="col-span-2">
                  <p className="text-gray-400 text-xs">Dirección</p>
                  <p className="font-medium">{client.address}</p>
                </div>
              )}
            </div>

            {/* Delete */}
            {user?.role === 'admin' && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)}
                    className="text-sm text-red-500 hover:text-red-700">
                    Eliminar cliente
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-sm text-red-700 flex-1">Confirmar eliminación?</p>
                    <button onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50">
                      {deleteMutation.isPending ? '...' : 'Sí, eliminar'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)}
                      className="text-sm text-gray-600 hover:text-gray-800">
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Edit form */
          <form onSubmit={e => { e.preventDefault(); updateMutation.mutate(form) }} className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Editar cliente</h3>
              <button type="button" onClick={() => setEditing(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sector</label>
              <select value={form.sector_id} onChange={e => setForm({ ...form, sector_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sin sector</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={updateMutation.isPending}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Créditos activos</h3>
        {client.credits?.length === 0 ? (
          <div className="text-center text-gray-400 py-8 bg-white rounded-xl border border-gray-100">
            Sin créditos registrados
          </div>
        ) : (
          <div className="space-y-2">
            {client.credits?.map(cr => (
              <div key={cr.id} onClick={() => navigate(`/credits/${cr.id}`)}
                className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-900">#{cr.credit_number}</p>
                  <p className="text-xs text-gray-400">{PERIOD_LABELS[cr.payment_period]} · Próximo: {cr.next_due_date}</p>
                </div>
                <p className="text-lg font-bold text-gray-900">${Number(cr.quota_value).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
