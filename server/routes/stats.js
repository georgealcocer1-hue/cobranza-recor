const express = require('express');
const { query } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ── Statistical helpers ─────────────────────────────────────────────────────

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function boxStats(values) {
  if (values.length === 0) return { min: 0, q1: 0, mediana: 0, q3: 0, max: 0, promedio: 0, n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    mediana: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    promedio: Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2)),
    n: values.length,
  };
}

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { pendiente: 0, intercepto: 0, r2: 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = points.reduce((s, p) => s + p.y * p.y, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { pendiente: 0, intercepto: sumY / n, r2: 0 };
  const pendiente = (n * sumXY - sumX * sumY) / denom;
  const intercepto = (sumY - pendiente * sumX) / n;
  const ssRes = points.reduce((s, p) => s + Math.pow(p.y - (pendiente * p.x + intercepto), 2), 0);
  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { pendiente: Number(pendiente.toFixed(4)), intercepto: Number(intercepto.toFixed(2)), r2: Number(r2.toFixed(4)) };
}

// GET /api/stats/summary?days=30
router.get('/summary', auth, adminOnly, async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);

    // Daily breakdown: collections grouped by date
    const daily = await query(
      `SELECT
         r.due_date AS fecha,
         COUNT(*) FILTER (WHERE r.status = 'paid')        AS pagados,
         COUNT(*) FILTER (WHERE r.status = 'absent')      AS ausentes,
         COUNT(*) FILTER (WHERE r.status = 'rescheduled') AS reagendados,
         COUNT(*)                                          AS total_visitas,
         COALESCE(SUM(cr.quota_value) FILTER (WHERE r.status = 'paid'), 0) AS monto_cobrado,
         MIN(TO_CHAR(r.recorded_at, 'HH24:MI')) AS hora_inicio,
         MAX(TO_CHAR(r.recorded_at, 'HH24:MI')) AS hora_fin
       FROM collection_records r
       JOIN credits cr ON cr.id = r.credit_id
       WHERE r.recorded_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY r.due_date
       ORDER BY r.due_date DESC`,
      [days]
    );

    // Overall totals
    const totals = await query(
      `SELECT
         COALESCE(SUM(cr.quota_value) FILTER (WHERE r.status = 'paid'), 0) AS total_cobrado,
         COUNT(*) FILTER (WHERE r.status = 'paid')        AS total_pagados,
         COUNT(*) FILTER (WHERE r.status = 'absent')      AS total_ausentes,
         COUNT(*) FILTER (WHERE r.status = 'rescheduled') AS total_reagendados,
         COUNT(*)                                          AS total_visitas
       FROM collection_records r
       JOIN credits cr ON cr.id = r.credit_id
       WHERE r.recorded_at >= NOW() - INTERVAL '1 day' * $1`,
      [days]
    );

    // Today's totals
    const today = new Date().toISOString().slice(0, 10);
    const hoy = await query(
      `SELECT
         COALESCE(SUM(cr.quota_value) FILTER (WHERE r.status = 'paid'), 0) AS cobrado_hoy,
         COUNT(*) FILTER (WHERE r.status = 'paid') AS pagados_hoy,
         COUNT(*) AS visitas_hoy
       FROM collection_records r
       JOIN credits cr ON cr.id = r.credit_id
       WHERE r.due_date = $1`,
      [today]
    );

    // Top collectors
    const cobradores = await query(
      `SELECT
         u.full_name,
         COUNT(*) FILTER (WHERE r.status = 'paid') AS pagados,
         COALESCE(SUM(cr.quota_value) FILTER (WHERE r.status = 'paid'), 0) AS monto
       FROM collection_records r
       JOIN credits cr ON cr.id = r.credit_id
       JOIN users u ON u.id = r.cobrador_id
       WHERE r.recorded_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY u.id, u.full_name
       ORDER BY monto DESC`,
      [days]
    );

    const t = totals[0] || {};
    const h = hoy[0] || {};
    const diasConDatos = daily.length || 1;

    res.json({
      periodo_dias: days,
      hoy: {
        cobrado: Number(h.cobrado_hoy) || 0,
        pagados: Number(h.pagados_hoy) || 0,
        visitas: Number(h.visitas_hoy) || 0,
      },
      totales: {
        cobrado: Number(t.total_cobrado) || 0,
        pagados: Number(t.total_pagados) || 0,
        ausentes: Number(t.total_ausentes) || 0,
        reagendados: Number(t.total_reagendados) || 0,
        visitas: Number(t.total_visitas) || 0,
        efectividad: t.total_visitas > 0
          ? Math.round((Number(t.total_pagados) / Number(t.total_visitas)) * 100)
          : 0,
      },
      promedios: {
        cobro_diario: Number((Number(t.total_cobrado) / diasConDatos).toFixed(2)),
        visitas_diarias: Math.round(Number(t.total_visitas) / diasConDatos),
      },
      diario: daily.map(d => ({
        fecha: d.fecha,
        pagados: Number(d.pagados),
        ausentes: Number(d.ausentes),
        reagendados: Number(d.reagendados),
        total_visitas: Number(d.total_visitas),
        monto_cobrado: Number(d.monto_cobrado),
        hora_inicio: d.hora_inicio,
        hora_fin: d.hora_fin,
      })),
      cobradores,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/stats/analysis?days=90&granularity=day|week|month
router.get('/analysis', auth, adminOnly, async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 90, 365);
    const granularity = ['day', 'week', 'month'].includes(req.query.granularity)
      ? req.query.granularity : 'day';

    // Date grouping expression
    const dateExpr = granularity === 'month'
      ? `TO_CHAR(DATE_TRUNC('month', r.recorded_at), 'YYYY-MM')`
      : granularity === 'week'
        ? `TO_CHAR(DATE_TRUNC('week', r.recorded_at), 'YYYY-MM-DD')`
        : `r.due_date`;

    // Daily/weekly/monthly amounts with sector
    const raw = await query(
      `SELECT ${dateExpr} AS periodo,
              s.name AS sector,
              COALESCE(SUM(cr.quota_value) FILTER (WHERE r.status = 'paid'), 0) AS monto,
              COUNT(*) FILTER (WHERE r.status = 'paid') AS pagados,
              COUNT(*) AS visitas
       FROM collection_records r
       JOIN credits cr ON cr.id = r.credit_id
       JOIN clients cl ON cl.id = cr.client_id
       LEFT JOIN sectors s ON s.id = cl.sector_id
       WHERE r.recorded_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY periodo, s.name
       ORDER BY periodo`,
      [days]
    );

    // Aggregate amounts per period (for box plot of totals)
    const periodoMap = {};
    const sectorMontos = {};
    for (const r of raw) {
      const monto = Number(r.monto);
      if (!periodoMap[r.periodo]) periodoMap[r.periodo] = 0;
      periodoMap[r.periodo] += monto;
      const sec = r.sector || 'Sin sector';
      if (!sectorMontos[sec]) sectorMontos[sec] = [];
      sectorMontos[sec].push(monto);
    }
    const todosMontos = Object.values(periodoMap);

    // Box plot: general + per sector
    const distribucion = {
      general: boxStats(todosMontos),
      por_sector: Object.entries(sectorMontos).map(([sector, vals]) => ({
        sector,
        ...boxStats(vals),
      })),
    };

    // Trend data for chart (aggregated by period, split by sector)
    const tendencia = raw.map(r => ({
      periodo: r.periodo,
      sector: r.sector || 'Sin sector',
      monto: Number(r.monto),
      pagados: Number(r.pagados),
      visitas: Number(r.visitas),
    }));

    // Regression: general
    const periodos = Object.keys(periodoMap).sort();
    const generalPoints = periodos.map((p, i) => ({ x: i, y: periodoMap[p], label: p }));
    const regGeneral = linearRegression(generalPoints);

    // Regression per sector
    const sectorPeriodos = {};
    for (const r of raw) {
      const sec = r.sector || 'Sin sector';
      if (!sectorPeriodos[sec]) sectorPeriodos[sec] = {};
      if (!sectorPeriodos[sec][r.periodo]) sectorPeriodos[sec][r.periodo] = 0;
      sectorPeriodos[sec][r.periodo] += Number(r.monto);
    }

    const regPorSector = Object.entries(sectorPeriodos).map(([sector, pMap]) => {
      const ps = Object.keys(pMap).sort();
      const points = ps.map((p, i) => ({ x: i, y: pMap[p] }));
      const reg = linearRegression(points);
      const lastX = points.length - 1;
      return {
        sector,
        ...reg,
        prediccion_siguiente: Number((reg.pendiente * (lastX + 1) + reg.intercepto).toFixed(2)),
        prediccion_5: Number((reg.pendiente * (lastX + 5) + reg.intercepto).toFixed(2)),
      };
    });

    // General predictions
    const lastX = generalPoints.length - 1;
    const predicciones = {
      siguiente: Number((regGeneral.pendiente * (lastX + 1) + regGeneral.intercepto).toFixed(2)),
      en_5_periodos: Number((regGeneral.pendiente * (lastX + 5) + regGeneral.intercepto).toFixed(2)),
      en_10_periodos: Number((regGeneral.pendiente * (lastX + 10) + regGeneral.intercepto).toFixed(2)),
    };

    // Regression line points for chart
    const lineaRegresion = generalPoints.map(p => ({
      periodo: p.label,
      real: p.y,
      regresion: Number((regGeneral.pendiente * p.x + regGeneral.intercepto).toFixed(2)),
    }));

    res.json({
      granularidad: granularity,
      periodo_dias: days,
      distribucion,
      tendencia,
      regresion: {
        general: { ...regGeneral, predicciones },
        por_sector: regPorSector,
      },
      linea_regresion: lineaRegresion,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
