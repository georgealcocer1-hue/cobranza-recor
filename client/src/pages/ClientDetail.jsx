import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Badge from '../components/Badge'
import api from '../api'

const PERIOD_LABELS = {
  daily: 'Diario',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
  })

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['history', id],
    queryFn: () => api.get(`/collections/history/${id}`).then(r => r.data),
  })

  if (loadingClient) return <div className="text-center text-gray-500 py-20">Cargando...</div>
  if (!client) return <div className="text-center text-gray-500 py-20">Cliente no encontrado</div>

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate('/clients')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
      >
        ← Volver a clientes
      </button>

      {/* Client info card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-3">{client.full_name}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-400 text-xs">N° Crédito</p>
            <p className="font-medium">#{client.credit_number}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Sector</p>
            <p className="font-medium">{client.sector_name}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Período</p>
            <p className="font-medium">{PERIOD_LABELS[client.payment_period]}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Próximo cobro</p>
            <p className="font-medium text-blue-600">{client.next_due_date}</p>
          </div>
          {client.address && (
            <div className="col-span-2">
              <p className="text-gray-400 text-xs">Dirección</p>
              <p className="font-medium">{client.address}</p>
            </div>
          )}
          {client.product_name && (
            <div className="col-span-2">
              <p className="text-gray-400 text-xs">Producto</p>
              <p className="font-medium">{client.product_name}</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Historial de cobros</h3>
        {loadingHistory ? (
          <div className="text-center text-gray-500 py-8">Cargando historial...</div>
        ) : history.length === 0 ? (
          <div className="text-center text-gray-500 py-8 bg-white rounded-xl border border-gray-100">
            Sin registros de cobro aún
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900">{r.due_date}</span>
                    <Badge status={r.status} />
                  </div>
                  {r.status === 'rescheduled' && r.new_due_date && (
                    <p className="text-xs text-blue-600">Reagendado para: {r.new_due_date}</p>
                  )}
                  {r.notes && <p className="text-xs text-gray-500 mt-0.5">{r.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{r.cobrador_name || 'Cobrador'}</p>
                  <p className="text-xs text-gray-300">{r.recorded_at?.slice(0, 16)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
