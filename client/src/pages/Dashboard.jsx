import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const PERIOD_LABELS = {
  daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal',
  monthly: 'Mensual', specific_days: 'Días esp.',
}

function RecordModal({ credit, onClose, onSuccess }) {
  const [status, setStatus] = useState('')
  const [newDate, setNewDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: data => api.post('/collections/record', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['today'] }); onSuccess(); onClose() },
    onError: err => setError(err.response?.data?.error || 'Error al registrar'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!status) return setError('Selecciona un resultado')
    if (status === 'rescheduled' && !newDate) return setError('Selecciona la nueva fecha')
    mutation.mutate({
      credit_id: credit.id,
      due_date: credit.next_due_date,
      status,
      new_due_date: status === 'rescheduled' ? newDate : undefined,
      notes,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b">
          <h3 className="font-semibold text-gray-900">{credit.client_name}</h3>
          <p className="text-sm text-gray-500">
            Crédito #{credit.credit_number} · Cuota: <span className="font-medium text-gray-700">${Number(credit.quota_value).toFixed(2)}</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{credit.sector_name} · {credit.client_address}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Resultado de visita</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'paid',        label: 'Pagó',      cls: 'border-green-400 bg-green-50 text-green-800' },
                { value: 'absent',      label: 'Ausente',   cls: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
                { value: 'rescheduled', label: 'Reagendar', cls: 'border-blue-400 bg-blue-50 text-blue-800' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setStatus(opt.value)}
                  className={`border-2 rounded-lg py-3 text-sm font-medium transition-all ${
                    status === opt.value ? opt.cls + ' ring-2 ring-offset-1' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {status === 'rescheduled' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha de pago</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Pagará mañana por la tarde"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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
  const [activeCredit, setActiveCredit] = useState(null)
  const [recorded, setRecorded] = useState(new Set())

  const { data: allCredits = [], isLoading, refetch } = useQuery({
    queryKey: ['today'],
    queryFn: () => api.get('/collections/today').then(r => r.data),
    staleTime: 0,
  })

  const { data: sectors = [] } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => api.get('/sectors').then(r => r.data),
  })

  const credits = selectedSector === 'all'
    ? allCredits
    : allCredits.filter(c => c.sector_id === Number(selectedSector))

  const pending = credits.filter(c => !recorded.has(c.id))
  const done = credits.filter(c => recorded.has(c.id))
  const today = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cobros del Día</h2>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{today}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select value={selectedSector} onChange={e => setSelectedSector(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="all">Todos los sectores</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <button onClick={() => refetch()}
            className="border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
            Actualizar
          </button>

          <div className="flex items-center gap-2">
            <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1.5 rounded-full">
              {done.length} cobrados
            </span>
            <span className="bg-orange-100 text-orange-800 text-sm font-medium px-3 py-1.5 rounded-full">
              {pending.length} pendientes
            </span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-20">Cargando...</div>
      ) : credits.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium text-gray-700">Sin cobros pendientes para hoy</p>
        </div>
      ) : (
        <div className="space-y-2">
          {credits.map(credit => {
            const done = recorded.has(credit.id)
            return (
              <div key={credit.id}
                className={`bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-4 transition-all ${done ? 'opacity-40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => navigate(`/credits/${credit.id}`)}
                      className="font-semibold text-gray-900 text-sm hover:text-blue-600">
                      {credit.client_name}
                    </button>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{credit.sector_name}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{PERIOD_LABELS[credit.payment_period]}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-xs text-gray-400">#{credit.credit_number}</p>
                    {credit.client_address && <p className="text-xs text-gray-400">{credit.client_address}</p>}
                    {credit.client_phone && <p className="text-xs text-gray-400">📞 {credit.client_phone}</p>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-gray-900">${Number(credit.quota_value).toFixed(2)}</p>
                  {done ? (
                    <span className="text-green-600 text-xs font-medium">✓ Registrado</span>
                  ) : (
                    <button onClick={() => setActiveCredit(credit)}
                      className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors mt-1">
                      Registrar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeCredit && (
        <RecordModal
          credit={activeCredit}
          onClose={() => setActiveCredit(null)}
          onSuccess={() => setRecorded(prev => new Set([...prev, activeCredit.id]))}
        />
      )}
    </div>
  )
}
