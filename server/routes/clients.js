const express = require('express');
const { query, queryOne, run } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let sectorFilter = '';
    let params = [];

    if (req.user.role !== 'admin' && req.user.sectors.length > 0) {
      sectorFilter = `AND c.sector_id = ANY($1::int[])`;
      params = [req.user.sectors];
    }

    const rows = await query(
      `SELECT c.*, s.name AS sector_name, u.full_name AS cobrador_name
       FROM clients c
       JOIN sectors s ON s.id = c.sector_id
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.active = 1 ${sectorFilter}
       ORDER BY s.name, c.full_name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const client = await queryOne(
      `SELECT c.*, s.name AS sector_name, u.full_name AS cobrador_name
       FROM clients c
       JOIN sectors s ON s.id = c.sector_id
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { full_name, credit_number, address, product_name, payment_period, sector_id, start_date } = req.body;
    if (!full_name || !credit_number || !payment_period || !sector_id || !start_date) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const validPeriods = ['daily', 'weekly', 'biweekly', 'monthly'];
    if (!validPeriods.includes(payment_period)) {
      return res.status(400).json({ error: 'Período de pago inválido' });
    }
    const result = await run(
      `INSERT INTO clients
         (full_name, credit_number, address, product_name, payment_period,
          sector_id, start_date, next_due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [full_name.trim(), credit_number.trim(), address || '', product_name || '',
       payment_period, sector_id, start_date, start_date, req.user.id]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El número de crédito ya existe' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { full_name, credit_number, address, product_name, payment_period, sector_id, next_due_date } = req.body;
    const current = await queryOne('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Cliente no encontrado' });
    await run(
      `UPDATE clients SET
         full_name=$1, credit_number=$2, address=$3, product_name=$4,
         payment_period=$5, sector_id=$6, next_due_date=$7
       WHERE id=$8`,
      [
        full_name ?? current.full_name,
        credit_number ?? current.credit_number,
        address ?? current.address,
        product_name ?? current.product_name,
        payment_period ?? current.payment_period,
        sector_id ?? current.sector_id,
        next_due_date ?? current.next_due_date,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El número de crédito ya existe' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await run('UPDATE clients SET active = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
