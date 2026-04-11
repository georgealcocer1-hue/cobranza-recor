const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ── Date helpers ────────────────────────────────────────────────────────────

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

// ── GET /api/collections/today ───────────────────────────────────────────────

router.get('/today', auth, (req, res) => {
  let sectorFilter = '';
  let params = [];

  if (req.user.role !== 'admin' && req.user.sectors.length > 0) {
    sectorFilter = `AND c.sector_id IN (${req.user.sectors.map(() => '?').join(',')})`;
    params = req.user.sectors;
  }

  // Optional sector filter from query param (for admin filtering by sector)
  if (req.query.sector_id) {
    sectorFilter = 'AND c.sector_id = ?';
    params = [req.query.sector_id];
  }

  const clients = db.prepare(
    `SELECT c.id, c.full_name, c.credit_number, c.address, c.product_name,
            c.payment_period, c.next_due_date,
            s.id AS sector_id, s.name AS sector_name
     FROM clients c
     JOIN sectors s ON s.id = c.sector_id
     WHERE c.active = 1
       AND c.next_due_date <= DATE('now', 'localtime')
       ${sectorFilter}
     ORDER BY s.name, c.full_name`
  ).all(...params);

  res.json(clients);
});

// ── POST /api/collections/record ────────────────────────────────────────────

router.post('/record', auth, (req, res) => {
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

  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND active = 1').get(client_id);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

  // Insert record
  db.prepare(
    `INSERT INTO collection_records (client_id, cobrador_id, due_date, status, new_due_date, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(client_id, req.user.id, due_date, status, new_due_date || null, notes || '');

  // Advance next_due_date based on status
  let nextDueDate;
  if (status === 'paid') {
    nextDueDate = advanceDate(due_date, client.payment_period);
  } else if (status === 'rescheduled') {
    nextDueDate = new_due_date;
  } else {
    // absent: do not change next_due_date
    nextDueDate = client.next_due_date;
  }

  if (status !== 'absent') {
    db.prepare('UPDATE clients SET next_due_date = ? WHERE id = ?').run(nextDueDate, client_id);
  }

  res.json({ ok: true, next_due_date: nextDueDate });
});

// ── GET /api/collections/history/:clientId ──────────────────────────────────

router.get('/history/:clientId', auth, (req, res) => {
  const records = db.prepare(
    `SELECT r.id, r.due_date, r.status, r.new_due_date, r.notes, r.recorded_at,
            u.full_name AS cobrador_name
     FROM collection_records r
     LEFT JOIN users u ON u.id = r.cobrador_id
     WHERE r.client_id = ?
     ORDER BY r.due_date DESC, r.recorded_at DESC`
  ).all(req.params.clientId);

  res.json(records);
});

module.exports = router;
