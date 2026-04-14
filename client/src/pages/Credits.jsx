import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import api from '../api'

const PERIOD_LABELS = {
  daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal',
  monthly: 'Mensual', specific_days: 'Días esp.',
}

const DAYS = [
  { value: 1, label: 'L' , full: 'Lunes' },
  { value: 2, label: 'M' , full: 'Martes' },
  { value: 3, label: 'X' , full: 'Miércoles' },
  { value: 4, label: 'J' , full: 'Jueves' },
  { value: 5, label: 'V' , full: 'Viernes' },
  { value: 6, label: 'S' , full: 'Sábado' },
  { value: 0, label: 'D' , full: 'Domingo' },
]

function DayPicker({ value = [], onChange }) {
  function toggle(day) {
    onChange(value.includes(day) ? value.filter(d => d !== day) : [...value, day])
  }
  return (
    <div className="flex gap-1.5 flex-wrap">
      {DAYS.map(d => (
        <button key={d.value} type="button" onClick={() => toggle(d.value)}
          title={d.full}
          className={`w-10 h-10 rounded-full text-xs font-semibold transition-all ${
            value.includes(d.value)
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          {d.label}
        </button>
      ))}
    </div>
  )
}

export default function Credits() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [serverError, setServerError] = useState('')

  const { data: credits = [], isLoading } = useQuery({
    queryKey: ['credits'],
    queryFn: () => api.get('/credits').then(r => r.data),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
  })

  const { register, handleSubmit, reset, watch, control, formState: { errors } } = useForm({
    defaultValues: {
      payment_period: 'weekly',
      specific_days: [],
      start_date: new Date().toISOString().slice(0, 10),
    },
  })
  const period = watch('payment_period')

  const mutation = useMutation({
    mutationFn: data => api.post('/credits', {
      ...data,
      client_id: Number(data.client_id),
      quota_value: Number(data.quota_value) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits'] })
      reset({ payment_period: 'weekly', specific_days: [], start_date: new Date().toISOString().slice(0, 10) })
      setShowForm(false)
      setServerError('')
    },
    onError: err => setServerError(err.response?.data?.error || 'Error al guardar'),
  })

  const filtered = credits.filter(c =>
    c.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.credit_number?.includes(search)
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Créditos</h2>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 font-medium shrink-0">
          + Nuevo
        </button>
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por cliente o N° crédito..."
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />

      {/* Count */}
      <p className="text-xs text-gray-400 mb-3">{filtered.length} créditos</p>

      {isLoading ? (
        <div className="text-center text-gray-400 py-20">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">💳</p>
          <p className="font-medium text-gray-700">No hay créditos registrados</p>
          <p className="text-sm text-gray-400 mt-1">Toca "+ Nuevo" para crear uno</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} onClick={() => navigate(`/credits/${c.id}`)}
              className="bg-white rounded-2xl border border-gray-100 p-4 active:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{c.client_name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">#{c.credit_number}</span>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{PERIOD_LABELS[c.payment_period]}</span>
                    {c.sector_name && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{c.sector_name}</span>}
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Próximo: {c.next_due_date}</p>
                </div>
                <p className="text-lg font-bold text-gray-900 shrink-0">${Number(c.quota_value).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-5 border-b sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-lg">Nuevo Crédito</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl p-1">×</button>
              </div>
            </div>

            <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select {...register('client_id', { required: 'Requerido' })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Seleccionar cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
                {errors.client_id && <p className="text-red-500 text-xs mt-1">{errors.client_id.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° de crédito *</label>
                <input {...register('credit_number', { required: 'Requerido' })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {errors.credit_number && <p className="text-red-500 text-xs mt-1">{errors.credit_number.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor de la cuota</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm text-gray-400">$</span>
                  <input {...register('quota_value')} type="number" min="0" step="0.01" placeholder="0.00"
                    className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia del producto</label>
                <input {...register('product_reference')} placeholder="Ej: Televisor Samsung 55'"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Período de pago *</label>
                <select {...register('payment_period', { required: 'Requerido' })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                  <option value="specific_days">Días específicos</option>
                </select>
              </div>

              {period === 'specific_days' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona los días *</label>
                  <Controller name="specific_days" control={control}
                    rules={{ validate: v => period !== 'specific_days' || v.length > 0 || 'Selecciona al menos un día' }}
                    render={({ field }) => (
                      <DayPicker value={field.value} onChange={field.onChange} />
                    )} />
                  {errors.specific_days && (
                    <p className="text-red-500 text-xs mt-1">{errors.specific_days.message}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio *</label>
                <input type="date" {...register('start_date', { required: 'Requerido' })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {serverError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{serverError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 text-sm hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={mutation.isPending}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {mutation.isPending ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
