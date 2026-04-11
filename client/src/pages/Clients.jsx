import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import api from '../api'

// Inline sector selector: type to search, option to create on-the-fly
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
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 bg-white"
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
            className="text-gray-400 hover:text-gray-600 ml-1">×</button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(s => (
            <button key={s.id} type="button" onMouseDown={() => select(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700">
              {s.name}
            </button>
          ))}
          {showCreate && (
            <button type="button" onMouseDown={handleCreate}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">
              + Crear sector "{input.trim()}"
            </button>
          )}
          {filtered.length === 0 && !showCreate && (
            <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
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
      return newSector
    } catch { return null }
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
    <div className="flex gap-6 flex-col lg:flex-row">
      {/* List */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-xl font-bold text-gray-900">Clientes</h2>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
            + Nuevo cliente
          </button>
        </div>

        <input type="text" placeholder="Buscar por nombre o teléfono..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />

        {isLoading ? (
          <div className="text-center text-gray-400 py-16">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No hay clientes registrados</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Teléfono</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Sector</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Dirección</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-sm">{c.full_name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                      {c.sector_name
                        ? <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{c.sector_name}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">{c.address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="w-full lg:w-80 bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Nuevo Cliente</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>

          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input {...register('full_name', { required: 'Requerido' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {errors.full_name && <p className="text-red-500 text-xs mt-0.5">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
              <input {...register('phone')} type="tel"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sector</label>
              <SectorSelect
                value={sectorId}
                onChange={setSectorId}
                sectors={sectors}
                onCreateSector={handleCreateSector}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
              <input {...register('address')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {serverError && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>
            )}

            <button type="submit" disabled={mutation.isPending}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-1">
              {mutation.isPending ? 'Guardando...' : 'Registrar Cliente'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
