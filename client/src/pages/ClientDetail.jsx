import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api'

const PERIOD_LABELS = {
  daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal',
  monthly: 'Mensual', specific_days: 'Días específicos',
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
  })

  if (isLoading) return <div className="text-center text-gray-400 py-20">Cargando...</div>
  if (!client) return <div className="text-center text-gray-400 py-20">Cliente no encontrado</div>

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/clients')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1">
        ← Volver a clientes
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-3">{client.full_name}</h2>
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
