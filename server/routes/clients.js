const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/clients
router.get('/', auth, (req, res) => {
  let sectorFilter = '';
  let params = [];

  if (req.user.role !== 'admin' && req.user.sectors.length > 0) {
    sectorFilter = `AND c.sector_id IN (${req.user.sectors.map(() => '?').join(',')})`;
    params = req.user.sectors;
  }

  const clients = db.prepare(
    `SELECT c.*, s.name AS sector_name, u.full_name AS cobrador_name
     FROM clients c
     JOIN sectors s ON s.id = c.sector_id
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.active = 1 ${sectorFilter}
     ORDER BY s.name, c.full_name`
  ).all(...params);

  res.json(clients);
});

// GET /api/clients/:id
router.get('/:id', auth, (req, res) => {
  const client = db.prepare(
    `SELECT c.*, s.name AS sector_name, u.full_name AS cobrador_name
     FROM clients c
     JOIN sectors s ON s.id = c.sector_id
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.id = ?`
  ).get(req.params.id);

  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(client);
});

// POST /api/clients
router.post('/', auth, (req, res) => {
  const {
    full_name, credit_number, address, product_name,
    payment_period, sector_id, start_date,
  } = req.body;

  if (!full_name || !credit_number || !payment_period || !sector_id || !start_date) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const validPeriods = ['daily', 'weekly', 'biweekly', 'monthly'];
  if (!validPeriods.includes(payment_period)) {
    return res.status(400).json({ error: 'Período de pago inválido' });
  }

  try {
    const result = db.prepare(
      `INSERT INTO clients
         (full_name, credit_number, address, product_name, payment_period,
          sector_id, start_date, next_due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      full_name.trim(),
      credit_number.trim(),
      address || '',
      product_name || '',
      payment_period,
      sector_id,
      start_date,
      start_date, // next_due_date starts equal to start_date
      req.user.id
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'El número de crédito ya existe' });
    }
    throw e;
  }
});

// PUT /api/clients/:id — admin only
router.put('/:id', auth, adminOnly, (req, res) => {
  const {
    full_name, credit_number, address, product_name,
    payment_period, sector_id, next_due_date,
  } = req.body;

  const current = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Cliente no encontrado' });

  try {
    db.prepare(
      `UPDATE clients SET
         full_name      = ?,
         credit_number  = ?,
         address        = ?,
         product_name   = ?,
         payment_period = ?,
         sector_id      = ?,
         next_due_date  = ?
       WHERE id = ?`
    ).run(
      full_name ?? current.full_name,
      credit_number ?? current.credit_number,
      address ?? current.address,
      product_name ?? current.product_name,
      payment_period ?? current.payment_period,
      sector_id ?? current.sector_id,
      next_due_date ?? current.next_due_date,
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'El número de crédito ya existe' });
    }
    throw e;
  }
});

// DELETE /api/clients/:id — admin only (soft delete)
router.delete('/:id', auth, adminOnly, (req, res) => {
  db.prepare('UPDATE clients SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
