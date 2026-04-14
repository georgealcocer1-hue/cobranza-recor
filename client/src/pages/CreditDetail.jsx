import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import Badge from '../components/Badge'
import api from '../api'

const PERIOD_LABELS = {
  daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal',
  monthly: 'Mensual', specific_days: 'Días específicos',
}
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function CreditDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/credits/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credits'] }); navigate('/credits') },
  })

  const { data: credit, isLoading } = useQuery({
    queryKey: ['credit', id],
    queryFn: () => api.get(`/credits/${id}`).then(r => r.data),
  })

  const { data: history = [] } = useQuery({
    queryKey: ['history', id],
    queryFn: () => api.get(`/collections/history/${id}`).then(r => r.data),
    enabled: !!credit,
  })

  if (isLoading) return <div className="text-center text-gray-400 py-20">Cargando...</div>
  if (!credit) return <div className="text-center text-gray-400 py-20">Crédito no encontrado</div>

  const specificDays = Array.isArray(credit.specific_days) ? credit.specific_days : []

  return (
    <div>
      <button onClick={() => navigate('/credits')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1 py-1">
        ← Volver a créditos
      </button>

      {/* Credit info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{credit.client_name}</h2>
            <p className="text-sm text-gray-500">Crédito #{credit.credit_number}</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 shrink-0">${Number(credit.quota_value).toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Período</p>
            <p className="font-medium">{PERIOD_LABELS[credit.payment_period]}</p>
            {credit.payment_period === 'specific_days' && specificDays.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {specificDays.map(d => (
                  <span key={d} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{DAY_NAMES[d]}</span>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-gray-400 text-xs">Próximo cobro</p>
            <p className="font-medium text-blue-600">{credit.next_due_date}</p>
          </div>
          {credit.product_reference && (
            <div className="col-span-2">
              <p className="text-gray-400 text-xs">Producto</p>
              <p className="font-medium">{credit.product_reference}</p>
            </div>
          )}
          {credit.sector_name && (
            <div>
              <p className="text-gray-400 text-xs">Sector</p>
              <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full mt-0.5">{credit.sector_name}</span>
            </div>
          )}
          {credit.client_phone && (
            <div>
              <p className="text-gray-400 text-xs">Teléfono</p>
              <a href={`tel:${credit.client_phone}`} className="font-medium text-blue-600">{credit.client_phone}</a>
            </div>
          )}
          {credit.client_address && (
            <div className="col-span-2">
              <p className="text-gray-400 text-xs">Dirección</p>
              <p className="font-medium">{credit.client_address}</p>
            </div>
          )}
        </div>

        {/* Delete */}
        {user?.role === 'admin' && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="text-sm text-red-500 hover:text-red-700 py-1">
                Eliminar crédito
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <p className="text-sm text-red-700 flex-1">¿Confirmar eliminación?</p>
                <button onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="text-sm bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 disabled:opacity-50">
                  {deleteMutation.isPending ? '...' : 'Sí'}
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="text-sm text-gray-600 hover:text-gray-800 py-2">
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <h3 className="font-semibold text-gray-900 mb-3">Historial de cobros</h3>
      {history.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-gray-400 text-sm">Sin registros de cobro aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">{r.due_date}</span>
                    <Badge status={r.status} />
                  </div>
                  {r.status === 'rescheduled' && r.new_due_date && (
                    <p className="text-xs text-blue-600 mt-0.5">→ Reagendado: {r.new_due_date}</p>
                  )}
                  {r.notes && <p className="text-xs text-gray-500 mt-0.5">{r.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{r.cobrador_name}</p>
                  <p className="text-xs text-gray-300">{r.recorded_at}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
