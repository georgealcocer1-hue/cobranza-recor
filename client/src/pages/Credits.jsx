import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import api from '../api'

const PERIOD_LABELS = {
  daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal',
  monthly: 'Mensual', specific_days: 'Días específicos',
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
          className={`w-9 h-9 rounded-full text-xs font-semibold transition-all ${
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
    <div className="flex gap-6 flex-col lg:flex-row">
      {/* List */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-xl font-bold text-gray-900">Créditos</h2>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
            + Nuevo crédito
          </button>
        </div>

        <input type="text" placeholder="Buscar por cliente o N° crédito..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />

        {isLoading ? (
          <div className="text-center text-gray-400 py-16">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No hay créditos registrados</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">N° Crédito</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Cuota</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Período</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Próximo cobro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/credits/${c.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-sm">{c.client_name}</p>
                      <p className="text-xs text-gray-400">{c.sector_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">#{c.credit_number}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 hidden md:table-cell">
                      ${Number(c.quota_value).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {PERIOD_LABELS[c.payment_period]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-600 font-medium hidden lg:table-cell">{c.next_due_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="w-full lg:w-96 bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Nuevo Crédito</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>

          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cliente *</label>
              <select {...register('client_id', { required: 'Requerido' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Seleccionar cliente...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
              {errors.client_id && <p className="text-red-500 text-xs mt-0.5">{errors.client_id.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° de crédito *</label>
              <input {...register('credit_number', { required: 'Requerido' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {errors.credit_number && <p className="text-red-500 text-xs mt-0.5">{errors.credit_number.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valor de la cuota</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
                <input {...register('quota_value')} type="number" min="0" step="0.01" placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Referencia del producto</label>
              <input {...register('product_reference')} placeholder="Ej: Televisor Samsung 55'"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Período de pago *</label>
              <select {...register('payment_period', { required: 'Requerido' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
                <option value="specific_days">Días específicos</option>
              </select>
            </div>

            {period === 'specific_days' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Selecciona los días *</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de inicio *</label>
              <input type="date" {...register('start_date', { required: 'Requerido' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {serverError && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>
            )}

            <button type="submit" disabled={mutation.isPending}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-1">
              {mutation.isPending ? 'Guardando...' : 'Registrar Crédito'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
