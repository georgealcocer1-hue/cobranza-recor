const express = require('express');
const { query } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
