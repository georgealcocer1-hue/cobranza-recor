import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import api from '../../api'

export default function AdminUsers() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [serverError, setServerError] = useState('')
  const [resetPw, setResetPw] = useState(null)
  const [newPw, setNewPw] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  const { data: sectors = [] } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => api.get('/sectors').then(r => r.data),
  })

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm()
  const selectedSectors = watch('sectors') || []

  const createMutation = useMutation({
    mutationFn: data => api.post('/users', {
      ...data,
      sectors: Array.isArray(data.sectors) ? data.sectors.map(Number) : [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      reset()
      setShowForm(false)
      setServerError('')
    },
    onError: err => setServerError(err.response?.data?.error || 'Error al crear usuario'),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => api.put(`/users/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const resetPassword = useMutation({
    mutationFn: ({ id, password }) => api.put(`/users/${id}/password`, { password }),
    onSuccess: () => { setResetPw(null); setNewPw(''); alert('Contraseña actualizada') },
    onError: err => alert(err.response?.data?.error || 'Error'),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Cobradores</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Nuevo cobrador
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6 max-w-lg">
          <h3 className="font-semibold text-gray-900 mb-4">Nuevo cobrador</h3>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  {...register('full_name', { required: 'Requerido' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.full_name && <p className="text-red-500 text-xs mt-0.5">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Usuario *</label>
                <input
                  {...register('username', { required: 'Requerido' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.username && <p className="text-red-500 text-xs mt-0.5">{errors.username.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
              <input
                type="password"
                {...register('password', { required: 'Requerido', minLength: { value: 4, message: 'Mínimo 4 caracteres' } })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.password && <p className="text-red-500 text-xs mt-0.5">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Sectores asignados</label>
              <div className="grid grid-cols-2 gap-2">
                {sectors.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      value={s.id}
                      {...register('sectors')}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              {sectors.length === 0 && (
                <p className="text-xs text-gray-400">Crea sectores primero</p>
              )}
            </div>

            {serverError && <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={createMutation.isPending} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
                {createMutation.isPending ? 'Guardando...' : 'Crear cobrador'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users list */}
      {isLoading ? (
        <div className="text-center text-gray-500 py-10">Cargando...</div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {users.map(u => (
            <div key={u.id} className={`bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-start justify-between gap-3 ${!u.active ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{u.full_name}</p>
                <p className="text-xs text-gray-400">@{u.username} · {u.role === 'admin' ? 'Administrador' : 'Cobrador'}</p>
                {u.sectors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {u.sectors.map(s => (
                      <span key={s.id} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{s.name}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setResetPw(u.id)}
                  className="text-xs text-gray-400 hover:text-blue-600"
                >
                  Contraseña
                </button>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                    className={`text-xs ${u.active ? 'text-gray-400 hover:text-red-600' : 'text-gray-400 hover:text-green-600'}`}
                  >
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset password modal */}
      {resetPw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Cambiar contraseña</h3>
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Nueva contraseña (mín. 4 caracteres)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={() => { setResetPw(null); setNewPw('') }} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={() => newPw.length >= 4 && resetPassword.mutate({ id: resetPw, password: newPw })}
                disabled={resetPassword.isPending || newPw.length < 4}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
