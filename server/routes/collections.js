const express = require('express');
const { query, queryOne, run } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

function advanceDate(dateStr, period) {
  const d = new Date(dateStr + 'T00:00:00');
  switch (period) {
    case 'daily':    d.setDate(d.getDate() + 1); break;
    case 'weekly':   d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly':  d.setMonth(d.getMonth() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let sectorFilter = '';
    let params = [today];

    if (req.query.sector_id) {
      sectorFilter = 'AND c.sector_id = $2';
      params.push(req.query.sector_id);
    } else if (req.user.role !== 'admin' && req.user.sectors.length > 0) {
      sectorFilter = `AND c.sector_id = ANY($2::int[])`;
      params.push(req.user.sectors);
    }

    const rows = await query(
      `SELECT c.id, c.full_name, c.credit_number, c.address, c.product_name,
              c.payment_period, c.next_due_date,
              s.id AS sector_id, s.name AS sector_name
       FROM clients c
       JOIN sectors s ON s.id = c.sector_id
       WHERE c.active = 1
         AND c.next_due_date <= $1
         ${sectorFilter}
       ORDER BY s.name, c.full_name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/record', auth, async (req, res) => {
  try {
    const { client_id, due_date, status, new_due_date, notes } = req.body;
    if (!client_id || !due_date || !status) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const validStatuses = ['paid', 'absent', 'rescheduled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    if (status === 'rescheduled' && !new_due_date) {
      return res.status(400).json({ error: 'Debe indicar la nueva fecha de pago' });
    }

    const client = await queryOne(
      'SELECT * FROM clients WHERE id = $1 AND active = 1',
      [client_id]
    );
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    await run(
      `INSERT INTO collection_records (client_id, cobrador_id, due_date, status, new_due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [client_id, req.user.id, due_date, status, new_due_date || null, notes || '']
    );

    let nextDueDate = client.next_due_date;
    if (status === 'paid') {
      nextDueDate = advanceDate(due_date, client.payment_period);
    } else if (status === 'rescheduled') {
      nextDueDate = new_due_date;
    }

    if (status !== 'absent') {
      await run('UPDATE clients SET next_due_date = $1 WHERE id = $2', [nextDueDate, client_id]);
    }

    res.json({ ok: true, next_due_date: nextDueDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/history/:clientId', auth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT r.id, r.due_date, r.status, r.new_due_date, r.notes,
              TO_CHAR(r.recorded_at, 'YYYY-MM-DD HH24:MI') AS recorded_at,
              u.full_name AS cobrador_name
       FROM collection_records r
       LEFT JOIN users u ON u.id = r.cobrador_id
       WHERE r.client_id = $1
       ORDER BY r.due_date DESC, r.recorded_at DESC`,
      [req.params.clientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
