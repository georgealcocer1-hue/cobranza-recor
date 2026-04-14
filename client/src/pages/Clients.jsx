import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import api from '../api'

function SectorSelect({ value, onChange, sectors, onCreateSector }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = sectors.filter(s =>
    s.name.toLowerCase().includes(input.toLowerCase())
  )
  const selected = sectors.find(s => s.id === value)
  const showCreate = input.trim() && !sectors.some(
    s => s.name.toLowerCase() === input.trim().toLowerCase()
  )

  function select(sector) {
    onChange(sector.id)
    setInput('')
    setOpen(false)
  }

  async function handleCreate() {
    const newSector = await onCreateSector(input.trim())
    if (newSector) select(newSector)
  }

  return (
    <div className="relative">
      <div
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 bg-white"
        onClick={() => setOpen(true)}
      >
        {!open && selected ? (
          <span className="text-gray-900">{selected.name}</span>
        ) : (
          <input
            autoFocus={open}
            className="outline-none flex-1 bg-transparent text-sm"
            placeholder="Buscar o crear sector..."
            value={open ? input : (selected ? selected.name : '')}
            onChange={e => { setInput(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        )}
        {selected && !open && (
          <button type="button" onClick={e => { e.stopPropagation(); onChange(null); setInput('') }}
            className="text-gray-400 hover:text-gray-600 ml-1 p-1">×</button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(s => (
            <button key={s.id} type="button"
              onMouseDown={e => { e.preventDefault(); select(s) }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700">
              {s.name}
            </button>
          ))}
          {showCreate && (
            <button type="button"
              onMouseDown={e => { e.preventDefault(); handleCreate() }}
              className="w-full text-left px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">
              + Crear sector "{input.trim()}"
            </button>
          )}
          {filtered.length === 0 && !showCreate && (
            <p className="px-3 py-2.5 text-sm text-gray-400">Sin resultados</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Clients() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [serverError, setServerError] = useState('')
  const [sectorId, setSectorId] = useState(null)

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
  })

  const { data: sectors = [], refetch: refetchSectors } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => api.get('/sectors').then(r => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const createSectorMutation = useMutation({
    mutationFn: name => api.post('/sectors', { name }).then(r => r.data),
    onSuccess: () => refetchSectors(),
  })

  async function handleCreateSector(name) {
    try {
      const newSector = await createSectorMutation.mutateAsync(name)
      await refetchSectors()
      setServerError('')
      return newSector
    } catch (err) {
      setServerError(err.response?.data?.error || 'Error al crear el sector')
      return null
    }
  }

  const mutation = useMutation({
    mutationFn: data => api.post('/clients', { ...data, sector_id: sectorId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      reset()
      setSectorId(null)
      setShowForm(false)
      setServerError('')
    },
    onError: err => setServerError(err.response?.data?.error || 'Error al guardar'),
  })

  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Clientes</h2>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 font-medium shrink-0">
          + Nuevo
        </button>
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por nombre o teléfono..."
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />

      {/* Count */}
      <p className="text-xs text-gray-400 mb-3">{filtered.length} clientes</p>

      {isLoading ? (
        <div className="text-center text-gray-400 py-20">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium text-gray-700">No hay clientes registrados</p>
          <p className="text-sm text-gray-400 mt-1">Toca "+ Nuevo" para agregar uno</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)}
              className="bg-white rounded-2xl border border-gray-100 p-4 active:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-sm truncate">{c.full_name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {c.sector_name && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{c.sector_name}</span>
                    )}
                    {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                  </div>
                  {c.address && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.address}</p>}
                </div>
                <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal (full screen on mobile) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-5 border-b sticky top-0 bg-white rounded-t-2xl sm:rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-lg">Nuevo Cliente</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl p-1">×</button>
              </div>
            </div>

            <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input {...register('full_name', { required: 'Requerido' })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input {...register('phone')} type="tel"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                <SectorSelect
                  value={sectorId}
                  onChange={setSectorId}
                  sectors={sectors}
                  onCreateSector={handleCreateSector}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input {...register('address')}
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
