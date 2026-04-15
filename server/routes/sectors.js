const express = require('express');
const { query, queryOne, run } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM sectors ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const result = await run(
      'INSERT INTO sectors (name) VALUES ($1) RETURNING id, name',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un sector con ese nombre' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    await run('UPDATE sectors SET name = $1 WHERE id = $2', [name.trim(), req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un sector con ese nombre' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const inUse = await queryOne(
      'SELECT COUNT(*) AS cnt FROM clients WHERE sector_id = $1 AND active = 1',
      [req.params.id]
    );
    if (Number(inUse.cnt) > 0) {
      return res.status(409).json({ error: 'No se puede eliminar: hay clientes en este sector' });
    }
    // Release soft-deleted clients still referencing this sector,
    // so the FK constraint doesn't block the DELETE.
    await run(
      'UPDATE clients SET sector_id = NULL WHERE sector_id = $1 AND active = 0',
      [req.params.id]
    );
    await run('DELETE FROM sectors WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error del servidor' });
  }
});

module.exports = router;
