import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api'

export default function AdminSectors() {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const { data: sectors = [], isLoading } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => api.get('/sectors').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: name => api.post('/sectors', { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); setNewName(''); setError('') },
    onError: err => setError(err.response?.data?.error || 'Error al crear sector'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, name }) => api.put(`/sectors/${id}`, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); setEditId(null) },
    onError: err => setError(err.response?.data?.error || 'Error al editar'),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/sectors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sectors'] }),
    onError: err => alert(err.response?.data?.error || 'No se puede eliminar'),
  })

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Sectores</h2>

      {/* Create */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <h3 className="font-medium text-gray-700 mb-3 text-sm">Nuevo sector</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nombre del sector"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())}
          />
          <button
            onClick={() => newName.trim() && createMutation.mutate(newName.trim())}
            disabled={createMutation.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center text-gray-500 py-8">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {sectors.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
              {editId === s.id ? (
                <>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => editMutation.mutate({ id: s.id, name: editName })}
                    className="text-green-600 text-sm font-medium hover:text-green-700"
                  >Guardar</button>
                  <button onClick={() => setEditId(null)} className="text-gray-400 text-sm hover:text-gray-600">Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900">{s.name}</span>
                  <button
                    onClick={() => { setEditId(s.id); setEditName(s.name) }}
                    className="text-gray-400 hover:text-blue-600 text-sm"
                  >Editar</button>
                  <button
                    onClick={() => window.confirm(`¿Eliminar sector "${s.name}"?`) && deleteMutation.mutate(s.id)}
                    className="text-gray-400 hover:text-red-600 text-sm"
                  >Eliminar</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
