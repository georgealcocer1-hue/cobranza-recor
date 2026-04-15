const express = require('express');
const { query, queryOne, run } = require('../db');
const { auth } = require('../middleware/auth');
const { advanceDate } = require('./credits');

const router = express.Router();

// GET /api/collections/today
router.get('/today', auth, async (req, res) => {
  try {
    // Accepts ?date=YYYY-MM-DD; defaults to today
    const refDate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '')
      ? req.query.date
      : new Date().toISOString().slice(0, 10);
    let sectorFilter = '';
    let params = [refDate];

    if (req.query.sector_id) {
      sectorFilter = 'AND cl.sector_id = $2';
      params.push(req.query.sector_id);
    } else if (req.user.role !== 'admin' && req.user.sectors.length > 0) {
      sectorFilter = 'AND cl.sector_id = ANY($2::int[])';
      params.push(req.user.sectors);
    }

    const rows = await query(
      `SELECT cr.id, cr.credit_number, cr.quota_value, cr.payment_period,
              cr.specific_days, cr.next_due_date,
              cl.id AS client_id, cl.full_name AS client_name,
              cl.phone AS client_phone, cl.address AS client_address,
              s.id AS sector_id, s.name AS sector_name
       FROM credits cr
       JOIN clients cl ON cl.id = cr.client_id
       LEFT JOIN sectors s ON s.id = cl.sector_id
       WHERE cr.active = 1 AND cl.active = 1
         AND cr.next_due_date <= $1
         ${sectorFilter}
       ORDER BY s.name, cl.full_name`,
      params
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

// POST /api/collections/record
router.post('/record', auth, async (req, res) => {
  try {
    const { credit_id, due_date, status, new_due_date, notes } = req.body;
    if (!credit_id || !due_date || !status) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (!['paid', 'absent', 'rescheduled'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    if (status === 'rescheduled' && !new_due_date) {
      return res.status(400).json({ error: 'Indica la nueva fecha de pago' });
    }

    const credit = await queryOne(
      'SELECT * FROM credits WHERE id = $1 AND active = 1', [credit_id]
    );
    if (!credit) return res.status(404).json({ error: 'Crédito no encontrado' });

    await run(
      `INSERT INTO collection_records (credit_id, cobrador_id, due_date, status, new_due_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [credit_id, req.user.id, due_date, status, new_due_date || null, notes || '']
    );

    const specificDays = JSON.parse(credit.specific_days || '[]');
    let nextDueDate = credit.next_due_date;
    if (status === 'paid') {
      nextDueDate = advanceDate(due_date, credit.payment_period, specificDays);
    } else if (status === 'rescheduled') {
      nextDueDate = new_due_date;
    }

    if (status !== 'absent') {
      await run('UPDATE credits SET next_due_date = $1 WHERE id = $2', [nextDueDate, credit_id]);
    }

    res.json({ ok: true, next_due_date: nextDueDate });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

// GET /api/collections/history/:creditId
router.get('/history/:creditId', auth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT r.id, r.due_date, r.status, r.new_due_date, r.notes,
              TO_CHAR(r.recorded_at, 'YYYY-MM-DD HH24:MI') AS recorded_at,
              u.full_name AS cobrador_name
       FROM collection_records r
       LEFT JOIN users u ON u.id = r.cobrador_id
       WHERE r.credit_id = $1
       ORDER BY r.due_date DESC, r.recorded_at DESC`,
      [req.params.creditId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }); }
});

module.exports = router;
