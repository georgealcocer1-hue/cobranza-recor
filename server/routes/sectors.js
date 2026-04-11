const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/sectors — all users
router.get('/', auth, (req, res) => {
  const sectors = db.prepare('SELECT * FROM sectors ORDER BY name').all();
  res.json(sectors);
});

// POST /api/sectors — admin only
router.post('/', auth, adminOnly, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }
  try {
    const result = db.prepare('INSERT INTO sectors (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un sector con ese nombre' });
    }
    throw e;
  }
});

// PUT /api/sectors/:id — admin only
router.put('/:id', auth, adminOnly, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }
  try {
    db.prepare('UPDATE sectors SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un sector con ese nombre' });
    }
    throw e;
  }
});

// DELETE /api/sectors/:id — admin only
router.delete('/:id', auth, adminOnly, (req, res) => {
  const inUse = db.prepare('SELECT COUNT(*) as cnt FROM clients WHERE sector_id = ?').get(req.params.id);
  if (inUse.cnt > 0) {
    return res.status(409).json({ error: 'No se puede eliminar: hay clientes en este sector' });
  }
  db.prepare('DELETE FROM sectors WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
