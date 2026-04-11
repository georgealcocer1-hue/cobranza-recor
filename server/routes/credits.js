const express = require('express');
const { query, queryOne, run } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

const VALID_PERIODS = ['daily', 'weekly', 'biweekly', 'monthly', 'specific_days'];

// ── Date helpers ────────────────────────────────────────────────────────────

function advanceDate(dateStr, period, specificDays = []) {
  const d = new Date(dateStr + 'T00:00:00');
  if (period === 'daily')    { d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
  if (period === 'weekly')   { d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }
  if (period === 'biweekly') { d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); }
  if (period === 'monthly')  { d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); }
  if (period === 'specific_days' && specificDays.length > 0) {
    // Find next occurrence of any of the specified days after dateStr
    d.setDate(d.getDate() + 1);
    for (let i = 0; i < 7; i++) {
      if (specificDays.includes(d.getDay())) return d.toISOString().slice(0, 10);
      d.setDate(d.getDate() + 1);
    }
  }
  return dateStr;
}

// GET /api/credits
router.get('/', auth, async (req, res) => {
  try {
    let sectorFilter = '';
    let params = [];
    if (req.user.role !== 'admin' && req.user.sectors.length > 0) {
      sectorFilter = 'AND cl.sector_id = ANY($1::int[])';
      params = [req.user.sectors];
    }
    const rows = await query(
      `SELECT cr.*, cl.full_name AS client_name, cl.phone AS client_phone,
              cl.address AS client_address, s.name AS sector_name
       FROM credits cr
       JOIN clients cl ON cl.id = cr.client_id
       LEFT JOIN sectors s ON s.id = cl.sector_id
       WHERE cr.active = 1 ${sectorFilter}
       ORDER BY cl.full_name, cr.credit_number`,
      params
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

// GET /api/credits/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const row = await queryOne(
      `SELECT cr.*, cl.full_name AS client_name, cl.phone AS client_phone,
              cl.address AS client_address, s.name AS sector_name
       FROM credits cr
       JOIN clients cl ON cl.id = cr.client_id
       LEFT JOIN sectors s ON s.id = cl.sector_id
       WHERE cr.id = $1`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Crédito no encontrado' });
    row.specific_days = JSON.parse(row.specific_days || '[]');
    res.json(row);
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }); }
});

// POST /api/credits
router.post('/', auth, async (req, res) => {
  try {
    const { client_id, credit_number, quota_value, product_reference,
            payment_period, specific_days = [], start_date } = req.body;

    if (!client_id || !credit_number || !payment_period || !start_date) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (!VALID_PERIODS.includes(payment_period)) {
      return res.status(400).json({ error: 'Período inválido' });
    }
    if (payment_period === 'specific_days' && specific_days.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un día' });
    }

    // Calculate first due date
    let next_due_date = start_date;
    if (payment_period === 'specific_days') {
      // Find the first occurrence of a selected day on or after start_date
      const d = new Date(start_date + 'T00:00:00');
      for (let i = 0; i < 7; i++) {
        if (specific_days.includes(d.getDay())) { next_due_date = d.toISOString().slice(0, 10); break; }
        d.setDate(d.getDate() + 1);
      }
    }

    const result = await run(
      `INSERT INTO credits
         (client_id, credit_number, quota_value, product_reference,
          payment_period, specific_days, start_date, next_due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [client_id, credit_number.trim(), quota_value || 0, product_reference || '',
       payment_period, JSON.stringify(specific_days), start_date, next_due_date, req.user.id]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El N° de crédito ya existe' });
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/credits/:id — admin
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { quota_value, product_reference, payment_period, specific_days, next_due_date } = req.body;
    const current = await queryOne('SELECT * FROM credits WHERE id = $1', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Crédito no encontrado' });
    await run(
      `UPDATE credits SET quota_value=$1, product_reference=$2, payment_period=$3,
         specific_days=$4, next_due_date=$5 WHERE id=$6`,
      [
        quota_value ?? current.quota_value,
        product_reference ?? current.product_reference,
        payment_period ?? current.payment_period,
        JSON.stringify(specific_days ?? JSON.parse(current.specific_days || '[]')),
        next_due_date ?? current.next_due_date,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }); }
});

// DELETE /api/credits/:id — admin (soft delete)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await run('UPDATE credits SET active = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }); }
});

module.exports = { router, advanceDate };
