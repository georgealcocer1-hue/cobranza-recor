import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area,
} from 'recharts'
import api from '../api'

const DIAS_OPTIONS = [
  { value: 7, label: '7d' },
  { value: 15, label: '15d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
]
const GRAN_OPTIONS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Sem' },
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
    <div className={`rounded-2xl border p-3 sm:p-4 ${cls[color]}`}>
      <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg sm:text-2xl font-bold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs mt-0.5 opacity-70">{sub}</p>}
    </div>
  )
}

function BoxPlot({ data, width = 600, height = 280 }) {
  if (!data || data.length === 0) return <p className="text-gray-400 text-center py-8">Sin datos</p>
  const maxVal = Math.max(...data.map(d => d.max), 1)
  const pad = { top: 20, right: 20, bottom: 50, left: 45 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const barW = Math.min(50, plotW / data.length - 10)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = pad.top + plotH * (1 - t)
        return (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray={t === 0 ? '' : '3,3'} />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="10">${(maxVal * t).toFixed(0)}</text>
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
            <line x1={cx} x2={cx} y1={yMin} y2={yMax} stroke="#6b7280" strokeWidth="1.5" />
            <line x1={cx - barW / 4} x2={cx + barW / 4} y1={yMin} y2={yMin} stroke="#6b7280" strokeWidth="1.5" />
            <line x1={cx - barW / 4} x2={cx + barW / 4} y1={yMax} y2={yMax} stroke="#6b7280" strokeWidth="1.5" />
            <rect x={cx - barW / 2} y={yQ3} width={barW} height={yQ1 - yQ3}
              fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} fillOpacity="0.3"
              stroke={SECTOR_COLORS[i % SECTOR_COLORS.length]} strokeWidth="2" rx="3" />
            <line x1={cx - barW / 2} x2={cx + barW / 2} y1={yMed} y2={yMed}
              stroke={SECTOR_COLORS[i % SECTOR_COLORS.length]} strokeWidth="2.5" />
            <circle cx={cx} cy={scale(d.promedio)} r="3.5"
              fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
            <text x={cx} y={height - 8} textAnchor="middle" fill="#374151" fontSize="10" fontWeight="600">
              {d.sector.length > 10 ? d.sector.slice(0, 10) + '…' : d.sector}
            </text>
            <text x={cx} y={height - 22} textAnchor="middle" fill="#9ca3af" fontSize="9">
              n={d.n}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function TrendIndicator({ value }) {
  if (value > 0) return <span className="text-green-600 text-xs sm:text-sm font-medium">+{value.toFixed(2)}/per</span>
  if (value < 0) return <span className="text-red-600 text-xs sm:text-sm font-medium">{value.toFixed(2)}/per</span>
  return <span className="text-gray-500 text-xs sm:text-sm">estable</span>
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
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Estadísticas</h2>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Period pills */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {DIAS_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setDays(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                days === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>{o.label}</button>
          ))}
        </div>
        {/* Granularity pills */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {GRAN_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setGranularity(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                granularity === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ───── TAB: Resumen ───── */}
      {tab === 'resumen' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
            <Card label="Cobrado hoy" value={`$${hoy.cobrado.toFixed(2)}`}
              sub={`${hoy.pagados}/${hoy.visitas} visitas`} color="green" />
            <Card label={`Total ${days}d`} value={`$${totales.cobrado.toFixed(2)}`}
              sub={`${totales.pagados} pagos`} color="blue" />
            <Card label="Prom. diario" value={`$${promedios.cobro_diario.toFixed(2)}`}
              sub={`~${promedios.visitas_diarias} visitas`} color="purple" />
            <Card label="Efectividad" value={`${totales.efectividad}%`}
              sub={`${totales.ausentes} aus. · ${totales.reagendados} reag.`} color="orange" />
          </div>

          {/* Daily detail */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Detalle por período</h3>
            </div>
            {diario.length === 0 ? (
              <div className="text-center text-gray-400 py-12">Sin datos</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left text-[10px] font-semibold text-gray-500 uppercase px-3 py-2.5">Fecha</th>
                      <th className="text-center text-[10px] font-semibold text-gray-500 uppercase px-2 py-2.5">Pagados</th>
                      <th className="text-center text-[10px] font-semibold text-gray-500 uppercase px-2 py-2.5 hidden sm:table-cell">Aus.</th>
                      <th className="text-right text-[10px] font-semibold text-gray-500 uppercase px-3 py-2.5">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {diario.map(d => (
                      <tr key={d.fecha}>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{d.fecha}</td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{d.pagados}</span>
                        </td>
                        <td className="px-2 py-2.5 text-center hidden sm:table-cell">
                          <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">{d.ausentes}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900">${d.monto_cobrado.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-3 py-2.5 text-xs font-bold text-gray-900">Total</td>
                      <td className="px-2 py-2.5 text-center text-xs font-bold text-green-700">{totales.pagados}</td>
                      <td className="px-2 py-2.5 text-center text-xs font-bold text-yellow-700 hidden sm:table-cell">{totales.ausentes}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900">${totales.cobrado.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Collectors */}
          {cobradores.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Por cobrador</h3>
              </div>
              {cobradores.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                    <p className="text-xs text-gray-400">{c.pagados} cobros</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">${Number(c.monto).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ───── TAB: Análisis ───── */}
      {tab === 'analisis' && analysis && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Diagrama de cajas</h3>
            <p className="text-xs text-gray-400 mb-3">Montos por sector. Punto = promedio.</p>
            <BoxPlot data={analysis.distribucion.por_sector} />

            {/* Compact legend for mobile */}
            <div className="mt-3 space-y-1.5">
              {analysis.distribucion.por_sector.map((d, i) => (
                <div key={d.sector} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                  <span className="font-medium" style={{ color: SECTOR_COLORS[i % SECTOR_COLORS.length] }}>{d.sector}</span>
                  <div className="flex gap-3 text-gray-500">
                    <span>Med: <strong className="text-gray-900">${d.mediana.toFixed(0)}</strong></span>
                    <span>Prom: ${d.promedio.toFixed(0)}</span>
                    <span className="text-gray-300">n={d.n}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trend by sector */}
          {sectorTrend.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Tendencia por sector</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sectorTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} width={45} />
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {allSectors.map((s, i) => (
                    <Bar key={s} dataKey={s} stackId="a" fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Regression chart */}
          {trendData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Regresión lineal</h3>
              <p className="text-xs text-gray-400 mb-3">
                <TrendIndicator value={analysis.regresion.general.pendiente} />
                {' · '}R² = {analysis.regresion.general.r2}
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} width={45} />
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="real" name="Real" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={2} />
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Predicción general</h3>
            <p className="text-xs text-gray-400 mb-3">
              Regresión lineal {days}d (R² = {analysis.regresion.general.r2})
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Card label="Próx. período" color="green"
                value={`$${Math.max(0, analysis.regresion.general.predicciones.siguiente).toFixed(0)}`}
                sub="1 per." />
              <Card label="5 períodos" color="blue"
                value={`$${Math.max(0, analysis.regresion.general.predicciones.en_5_periodos).toFixed(0)}`}
                sub="5 per." />
              <Card label="10 períodos" color="purple"
                value={`$${Math.max(0, analysis.regresion.general.predicciones.en_10_periodos).toFixed(0)}`}
                sub="10 per." />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              <TrendIndicator value={analysis.regresion.general.pendiente} />
              {analysis.regresion.general.pendiente > 0
                ? ' — Crecimiento'
                : analysis.regresion.general.pendiente < 0
                  ? ' — Decrecimiento'
                  : ''}
            </p>
          </div>

          {/* Per-sector predictions as cards on mobile */}
          {analysis.regresion.por_sector.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Por sector</h3>
              <div className="space-y-2">
                {analysis.regresion.por_sector.map((s, i) => (
                  <div key={s.sector} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm" style={{ color: SECTOR_COLORS[i % SECTOR_COLORS.length] }}>{s.sector}</span>
                      <span className="text-xs text-gray-400">R²={s.r2}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Tendencia</p>
                        <TrendIndicator value={s.pendiente} />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Próx. período</p>
                        <p className="text-sm font-bold text-gray-900">${Math.max(0, s.prediccion_siguiente).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">En 5 per.</p>
                        <p className="text-sm font-bold text-gray-900">${Math.max(0, s.prediccion_5).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
