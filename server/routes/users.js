const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/users
router.get('/', auth, adminOnly, (req, res) => {
  const users = db.prepare(
    `SELECT u.id, u.username, u.role, u.full_name, u.active,
            GROUP_CONCAT(us.sector_id) as sector_ids,
            GROUP_CONCAT(s.name) as sector_names
     FROM users u
     LEFT JOIN user_sectors us ON us.user_id = u.id
     LEFT JOIN sectors s ON s.id = us.sector_id
     GROUP BY u.id
     ORDER BY u.full_name`
  ).all();

  const formatted = users.map(u => ({
    ...u,
    sectors: u.sector_ids
      ? u.sector_ids.split(',').map((id, i) => ({
          id: Number(id),
          name: u.sector_names.split(',')[i],
        }))
      : [],
    sector_ids: undefined,
    sector_names: undefined,
  }));

  res.json(formatted);
});

// POST /api/users
router.post('/', auth, adminOnly, (req, res) => {
  const { username, password, full_name, role = 'cobrador', sectors = [] } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos' });
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(
      `INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)`
    ).run(username.trim(), hash, role, full_name.trim());

    const userId = result.lastInsertRowid;
    const insertSector = db.prepare('INSERT OR IGNORE INTO user_sectors (user_id, sector_id) VALUES (?, ?)');
    for (const sid of sectors) insertSector.run(userId, sid);

    res.status(201).json({ id: userId });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }
    throw e;
  }
});

// PUT /api/users/:id
router.put('/:id', auth, adminOnly, (req, res) => {
  const { full_name, role, active, sectors } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (full_name !== undefined || role !== undefined || active !== undefined) {
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    db.prepare(
      `UPDATE users SET
        full_name = ?,
        role      = ?,
        active    = ?
       WHERE id = ?`
    ).run(
      full_name ?? current.full_name,
      role ?? current.role,
      active !== undefined ? (active ? 1 : 0) : current.active,
      req.params.id
    );
  }

  if (Array.isArray(sectors)) {
    db.prepare('DELETE FROM user_sectors WHERE user_id = ?').run(req.params.id);
    const insertSector = db.prepare('INSERT OR IGNORE INTO user_sectors (user_id, sector_id) VALUES (?, ?)');
    for (const sid of sectors) insertSector.run(req.params.id, sid);
  }

  res.json({ ok: true });
});

// PUT /api/users/:id/password — reset password
router.put('/:id/password', auth, adminOnly, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
