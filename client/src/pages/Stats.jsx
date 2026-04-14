import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area,
} from 'recharts'
import api from '../api'

const DIAS_OPTIONS = [
  { value: 7, label: '7 días' },
  { value: 15, label: '15 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
]
const GRAN_OPTIONS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
]
const SECTOR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

function Card({ label, value, sub, color = 'blue' }) {
  const cls = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${cls[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-0.5 opacity-70">{sub}</p>}
    </div>
  )
}

// SVG Box Plot component
function BoxPlot({ data, width = 600, height = 280 }) {
  if (!data || data.length === 0) return <p className="text-gray-400 text-center py-8">Sin datos</p>
  const maxVal = Math.max(...data.map(d => d.max), 1)
  const pad = { top: 20, right: 30, bottom: 50, left: 50 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const barW = Math.min(60, plotW / data.length - 10)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {/* Y axis */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = pad.top + plotH * (1 - t)
        return (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray={t === 0 ? '' : '3,3'} />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="11">${(maxVal * t).toFixed(0)}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const cx = pad.left + (i + 0.5) * (plotW / data.length)
        const scale = v => pad.top + plotH * (1 - v / maxVal)
        const yMin = scale(d.min)
        const yQ1 = scale(d.q1)
        const yMed = scale(d.mediana)
        const yQ3 = scale(d.q3)
        const yMax = scale(d.max)
        return (
          <g key={d.sector}>
            {/* Whisker line */}
            <line x1={cx} x2={cx} y1={yMin} y2={yMax} stroke="#6b7280" strokeWidth="1.5" />
            {/* Min/Max caps */}
            <line x1={cx - barW / 4} x2={cx + barW / 4} y1={yMin} y2={yMin} stroke="#6b7280" strokeWidth="1.5" />
            <line x1={cx - barW / 4} x2={cx + barW / 4} y1={yMax} y2={yMax} stroke="#6b7280" strokeWidth="1.5" />
            {/* Box Q1-Q3 */}
            <rect x={cx - barW / 2} y={yQ3} width={barW} height={yQ1 - yQ3}
              fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} fillOpacity="0.3"
              stroke={SECTOR_COLORS[i % SECTOR_COLORS.length]} strokeWidth="2" rx="3" />
            {/* Median line */}
            <line x1={cx - barW / 2} x2={cx + barW / 2} y1={yMed} y2={yMed}
              stroke={SECTOR_COLORS[i % SECTOR_COLORS.length]} strokeWidth="2.5" />
            {/* Mean dot */}
            <circle cx={cx} cy={scale(d.promedio)} r="3.5"
              fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
            {/* Label */}
            <text x={cx} y={height - 8} textAnchor="middle" fill="#374151" fontSize="11" fontWeight="600">
              {d.sector.length > 12 ? d.sector.slice(0, 12) + '…' : d.sector}
            </text>
            <text x={cx} y={height - 22} textAnchor="middle" fill="#9ca3af" fontSize="10">
              n={d.n}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function TrendIndicator({ value }) {
  if (value > 0) return <span className="text-green-600 text-sm font-medium">+{value.toFixed(2)}/período</span>
  if (value < 0) return <span className="text-red-600 text-sm font-medium">{value.toFixed(2)}/período</span>
  return <span className="text-gray-500 text-sm">estable</span>
}

export default function Stats() {
  const [days, setDays] = useState(30)
  const [granularity, setGranularity] = useState('day')
  const [tab, setTab] = useState('resumen')

  const { data: summary, isLoading: loadSummary } = useQuery({
    queryKey: ['stats', days],
    queryFn: () => api.get(`/stats/summary?days=${days}`).then(r => r.data),
  })

  const { data: analysis, isLoading: loadAnalysis } = useQuery({
    queryKey: ['stats-analysis', days, granularity],
    queryFn: () => api.get(`/stats/analysis?days=${days}&granularity=${granularity}`).then(r => r.data),
  })

  const isLoading = loadSummary || loadAnalysis
  if (isLoading) return <div className="text-center text-gray-400 py-20">Cargando estadísticas...</div>
  if (!summary) return null

  const { hoy, totales, promedios, diario, cobradores } = summary
  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'analisis', label: 'Análisis' },
    { id: 'prediccion', label: 'Predicción' },
  ]

  // Build trend chart data from analysis
  const trendData = analysis?.linea_regresion || []
  const sectorTrend = (() => {
    if (!analysis?.tendencia) return []
    const map = {}
    for (const t of analysis.tendencia) {
      if (!map[t.periodo]) map[t.periodo] = { periodo: t.periodo }
      map[t.periodo][t.sector] = t.monto
    }
    return Object.values(map).sort((a, b) => a.periodo.localeCompare(b.periodo))
  })()
  const allSectors = analysis?.distribucion?.por_sector?.map(s => s.sector) || []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Estadísticas de Cobranza</h2>
        <div className="flex gap-2 flex-wrap">
          <select value={granularity} onChange={e => setGranularity(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {GRAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {DIAS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ───── TAB: Resumen ───── */}
      {tab === 'resumen' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card label="Cobrado hoy" value={`$${hoy.cobrado.toFixed(2)}`}
              sub={`${hoy.pagados} pagos de ${hoy.visitas} visitas`} color="green" />
            <Card label={`Total (${days}d)`} value={`$${totales.cobrado.toFixed(2)}`}
              sub={`${totales.pagados} pagos totales`} color="blue" />
            <Card label="Promedio diario" value={`$${promedios.cobro_diario.toFixed(2)}`}
              sub={`~${promedios.visitas_diarias} visitas/día`} color="purple" />
            <Card label="Efectividad" value={`${totales.efectividad}%`}
              sub={`${totales.ausentes} ausentes · ${totales.reagendados} reagend.`} color="orange" />
          </div>

          {/* Daily table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Detalle por período</h3>
            </div>
            {diario.length === 0 ? (
              <div className="text-center text-gray-400 py-12">Sin datos de cobranza en este período</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Fecha</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-3 py-3">Pagados</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-3 py-3 hidden sm:table-cell">Ausentes</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-3 py-3 hidden sm:table-cell">Reagend.</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Monto</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-3 py-3 hidden md:table-cell">Horario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {diario.map(d => (
                      <tr key={d.fecha} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.fecha}</td>
                        <td className="px-3 py-3 text-center"><span className="text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{d.pagados}</span></td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell"><span className="text-sm text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">{d.ausentes}</span></td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell"><span className="text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{d.reagendados}</span></td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">${d.monto_cobrado.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500 hidden md:table-cell">{d.hora_inicio} - {d.hora_fin}</td>
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

          {/* Collectors */}
          {cobradores.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Rendimiento por cobrador</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Cobrador</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase px-3 py-3">Cobros</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Monto</th>
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
        </>
      )}

      {/* ───── TAB: Análisis ───── */}
      {tab === 'analisis' && analysis && (
        <>
          {/* Box Plot */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Diagrama de cajas — Montos por sector</h3>
            <p className="text-xs text-gray-400 mb-4">Min, Q1, Mediana (línea), Q3, Max. Punto = promedio.</p>
            <BoxPlot data={analysis.distribucion.por_sector} />
            {/* Legend table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-gray-500">Sector</th>
                    <th className="text-right py-2 px-2 text-gray-500">Min</th>
                    <th className="text-right py-2 px-2 text-gray-500">Q1</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-bold">Mediana</th>
                    <th className="text-right py-2 px-2 text-gray-500">Q3</th>
                    <th className="text-right py-2 px-2 text-gray-500">Max</th>
                    <th className="text-right py-2 px-2 text-gray-500">Prom.</th>
                    <th className="text-right py-2 px-2 text-gray-500">N</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.distribucion.por_sector.map((d, i) => (
                    <tr key={d.sector} className="border-b border-gray-50">
                      <td className="py-2 px-2 font-medium" style={{ color: SECTOR_COLORS[i % SECTOR_COLORS.length] }}>{d.sector}</td>
                      <td className="py-2 px-2 text-right text-gray-600">${d.min.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">${d.q1.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-bold text-gray-900">${d.mediana.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">${d.q3.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">${d.max.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">${d.promedio.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-400">{d.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trend by sector */}
          {sectorTrend.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">Tendencia por sector</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sectorTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Legend />
                  {allSectors.map((s, i) => (
                    <Bar key={s} dataKey={s} stackId="a" fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Regression chart */}
          {trendData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Regresión lineal — Monto total</h3>
              <p className="text-xs text-gray-400 mb-4">
                Tendencia: <TrendIndicator value={analysis.regresion.general.pendiente} />
                {' · '}R² = {analysis.regresion.general.r2}
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Legend />
                  <Area type="monotone" dataKey="real" name="Monto real" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="regresion" name="Regresión" stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ───── TAB: Predicción ───── */}
      {tab === 'prediccion' && analysis && (
        <>
          {/* General prediction */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Predicción general</h3>
            <p className="text-xs text-gray-400 mb-4">
              Basado en regresión lineal de los últimos {days} días (R² = {analysis.regresion.general.r2})
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Card label="Próximo período" color="green"
                value={`$${Math.max(0, analysis.regresion.general.predicciones.siguiente).toFixed(2)}`}
                sub="1 período adelante" />
              <Card label="En 5 períodos" color="blue"
                value={`$${Math.max(0, analysis.regresion.general.predicciones.en_5_periodos).toFixed(2)}`}
                sub="5 períodos adelante" />
              <Card label="En 10 períodos" color="purple"
                value={`$${Math.max(0, analysis.regresion.general.predicciones.en_10_periodos).toFixed(2)}`}
                sub="10 períodos adelante" />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Tendencia: <TrendIndicator value={analysis.regresion.general.pendiente} />
              {analysis.regresion.general.pendiente > 0
                ? ' — La cobranza muestra crecimiento'
                : analysis.regresion.general.pendiente < 0
                  ? ' — La cobranza muestra decrecimiento'
                  : ''}
            </p>
          </div>

          {/* Per-sector predictions */}
          {analysis.regresion.por_sector.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Predicción por sector</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Sector</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-3 py-3">Tendencia</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-3 py-3">R²</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-3 py-3">Próx. período</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">En 5 períodos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {analysis.regresion.por_sector.map((s, i) => (
                      <tr key={s.sector} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: SECTOR_COLORS[i % SECTOR_COLORS.length] }}>{s.sector}</td>
                        <td className="px-3 py-3 text-right"><TrendIndicator value={s.pendiente} /></td>
                        <td className="px-3 py-3 text-center text-sm text-gray-500">{s.r2}</td>
                        <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">${Math.max(0, s.prediccion_siguiente).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">${Math.max(0, s.prediccion_5).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
