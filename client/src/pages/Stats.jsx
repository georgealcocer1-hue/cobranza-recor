import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api'

const PERIODO_OPTIONS = [
  { value: 7,  label: '7 días' },
  { value: 15, label: '15 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
]

function Card({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-0.5 opacity-70">{sub}</p>}
    </div>
  )
}

export default function Stats() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['stats', days],
    queryFn: () => api.get(`/stats/summary?days=${days}`).then(r => r.data),
  })

  if (isLoading) return <div className="text-center text-gray-400 py-20">Cargando estadísticas...</div>
  if (!data) return null

  const { hoy, totales, promedios, diario, cobradores } = data

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Estadísticas de Cobranza</h2>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {PERIODO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card label="Cobrado hoy" value={`$${hoy.cobrado.toFixed(2)}`}
          sub={`${hoy.pagados} pagos de ${hoy.visitas} visitas`} color="green" />
        <Card label={`Caja (${days}d)`} value={`$${totales.cobrado.toFixed(2)}`}
          sub={`${totales.pagados} pagos totales`} color="blue" />
        <Card label="Promedio diario" value={`$${promedios.cobro_diario.toFixed(2)}`}
          sub={`~${promedios.visitas_diarias} visitas/día`} color="purple" />
        <Card label="Efectividad" value={`${totales.efectividad}%`}
          sub={`${totales.ausentes} ausentes · ${totales.reagendados} reagend.`} color="orange" />
      </div>

      {/* Daily breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Detalle diario</h3>
        </div>
        {diario.length === 0 ? (
          <div className="text-center text-gray-400 py-12">Sin datos de cobranza en este período</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Fecha</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Pagados</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3 hidden sm:table-cell">Ausentes</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3 hidden sm:table-cell">Reagend.</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Monto</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3 hidden md:table-cell">Horario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {diario.map(d => (
                  <tr key={d.fecha} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.fecha}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{d.pagados}</span>
                    </td>
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className="text-sm text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">{d.ausentes}</span>
                    </td>
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className="text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{d.reagendados}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">${d.monto_cobrado.toFixed(2)}</td>
                    <td className="px-3 py-3 text-center text-xs text-gray-500 hidden md:table-cell">
                      {d.hora_inicio} - {d.hora_fin}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                  <td className="px-3 py-3 text-center text-sm font-bold text-green-700">{totales.pagados}</td>
                  <td className="px-3 py-3 text-center text-sm font-bold text-yellow-700 hidden sm:table-cell">{totales.ausentes}</td>
                  <td className="px-3 py-3 text-center text-sm font-bold text-blue-700 hidden sm:table-cell">{totales.reagendados}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">${totales.cobrado.toFixed(2)}</td>
                  <td className="hidden md:table-cell"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Collectors performance */}
      {cobradores.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Rendimiento por cobrador</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Cobrador</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Cobros</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cobradores.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.full_name}</td>
                  <td className="px-3 py-3 text-center text-sm text-gray-600">{c.pagados}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">${Number(c.monto).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
