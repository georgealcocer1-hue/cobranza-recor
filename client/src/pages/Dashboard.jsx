import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const PERIOD_LABELS = {
  daily: 'Diario',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

function RecordModal({ client, onClose, onSuccess }) {
  const [status, setStatus] = useState('')
  const [newDate, setNewDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: data => api.post('/collections/record', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today'] })
      onSuccess()
      onClose()
    },
    onError: err => setError(err.response?.data?.error || 'Error al registrar'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!status) return setError('Selecciona un estado')
    if (status === 'rescheduled' && !newDate) return setError('Selecciona la nueva fecha')
    mutation.mutate({
      client_id: client.id,
      due_date: client.next_due_date,
      status,
      new_due_date: status === 'rescheduled' ? newDate : undefined,
      notes,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b">
          <h3 className="font-semibold text-gray-900">{client.full_name}</h3>
          <p className="text-sm text-gray-500">Crédito #{client.credit_number} · {client.sector_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Resultado de visita</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'paid',        label: 'Pagó',        cls: 'border-green-400 bg-green-50 text-green-800' },
                { value: 'absent',      label: 'Ausente',     cls: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
                { value: 'rescheduled', label: 'Reagendar',   cls: 'border-blue-400 bg-blue-50 text-blue-800' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`border-2 rounded-lg py-3 text-sm font-medium transition-all ${
                    status === opt.value
                      ? opt.cls + ' ring-2 ring-offset-1'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {status === 'rescheduled' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha de pago</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Pagará mañana"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [selectedSector, setSelectedSector] = useState('all')
  const [activeClient, setActiveClient] = useState(null)
  const [recorded, setRecorded] = useState(new Set())

  const { data: allClients = [], isLoading, refetch } = useQuery({
    queryKey: ['today'],
    queryFn: () => api.get('/collections/today').then(r => r.data),
    staleTime: 0,
  })

  const { data: sectors = [] } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => api.get('/sectors').then(r => r.data),
  })

  const clients = selectedSector === 'all'
    ? allClients
    : allClients.filter(c => c.sector_id === Number(selectedSector))

  const today = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cobros del Día</h2>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{today}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedSector}
            onChange={e => setSelectedSector(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Todos los sectores</option>
            {sectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
          >
            Actualizar
          </button>

          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1.5 rounded-full">
            {clients.length} pendiente{clients.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500 py-20">Cargando...</div>
      ) : clients.length === 0 ? (
        <div className="text-center text-gray-500 py-20 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">Sin cobros pendientes para hoy</p>
          <p className="text-sm mt-1">
            {selectedSector !== 'all' ? 'En este sector' : 'En todos los sectores'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Cliente</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Dirección</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Período</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Sector</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map(client => (
                <tr
                  key={client.id}
                  className={`hover:bg-gray-50 transition-colors ${recorded.has(client.id) ? 'opacity-40' : ''}`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className="text-left hover:text-blue-600"
                    >
                      <p className="font-medium text-gray-900 text-sm">{client.full_name}</p>
                      <p className="text-xs text-gray-400">#{client.credit_number}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{client.address || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{PERIOD_LABELS[client.payment_period]}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{client.sector_name}</td>
                  <td className="px-4 py-3 text-right">
                    {recorded.has(client.id) ? (
                      <span className="text-green-600 text-sm font-medium">Registrado</span>
                    ) : (
                      <button
                        onClick={() => setActiveClient(client)}
                        className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Registrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeClient && (
        <RecordModal
          client={activeClient}
          onClose={() => setActiveClient(null)}
          onSuccess={() => {
            setRecorded(prev => new Set([...prev, activeClient.id]))
            setActiveClient(null)
          }}
        />
      )}
    </div>
  )
}
