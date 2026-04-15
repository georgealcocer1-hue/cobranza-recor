const express = require('express');
const { query, queryOne, run } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/clients
router.get('/', auth, async (req, res) => {
  try {
    let sectorFilter = '';
    let params = [];
    if (req.user.role !== 'admin' && req.user.sectors.length > 0) {
      sectorFilter = 'AND c.sector_id = ANY($1::int[])';
      params = [req.user.sectors];
    }
    const rows = await query(
      `SELECT c.*, s.name AS sector_name
       FROM clients c
       LEFT JOIN sectors s ON s.id = c.sector_id
       WHERE c.active = 1 ${sectorFilter}
       ORDER BY c.full_name`,
      params
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

// GET /api/clients/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const client = await queryOne(
      `SELECT c.*, s.name AS sector_name
       FROM clients c
       LEFT JOIN sectors s ON s.id = c.sector_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Include their credits
    const credits = await query(
      `SELECT cr.* FROM credits cr WHERE cr.client_id = $1 AND cr.active = 1
       ORDER BY cr.created_at DESC`,
      [req.params.id]
    );
    res.json({ ...client, credits });
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }); }
});

// POST /api/clients
router.post('/', auth, async (req, res) => {
  try {
    const { full_name, phone, address, sector_id } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    const result = await run(
      `INSERT INTO clients (full_name, phone, address, sector_id, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [full_name.trim(), phone || '', address || '', sector_id || null, req.user.id]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'El sector o usuario referenciado no existe' });
    }
    if (err.code === '23502') {
      return res.status(400).json({ error: `Campo requerido faltante: ${err.column}` });
    }
    res.status(500).json({ error: err.message || 'Error del servidor' });
  }
});

// PUT /api/clients/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { full_name, phone, address, sector_id } = req.body;
    const current = await queryOne('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Cliente no encontrado' });
    await run(
      `UPDATE clients SET full_name=$1, phone=$2, address=$3, sector_id=$4 WHERE id=$5`,
      [
        full_name ?? current.full_name,
        phone ?? current.phone,
        address ?? current.address,
        sector_id ?? current.sector_id,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }); }
});

// DELETE /api/clients/:id — admin
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await run('UPDATE clients SET active = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }); }
});

module.exports = router;
