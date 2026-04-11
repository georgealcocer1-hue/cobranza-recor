const express = require('express');
const bcrypt = require('bcryptjs');
const { query, queryOne, run } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.username, u.role, u.full_name, u.active,
             STRING_AGG(us.sector_id::text, ',') AS sector_ids,
             STRING_AGG(s.name, ',')             AS sector_names
      FROM users u
      LEFT JOIN user_sectors us ON us.user_id = u.id
      LEFT JOIN sectors s ON s.id = us.sector_id
      GROUP BY u.id
      ORDER BY u.full_name
    `);

    const formatted = users.map(u => ({
      id: u.id, username: u.username, role: u.role,
      full_name: u.full_name, active: u.active,
      sectors: u.sector_ids
        ? u.sector_ids.split(',').map((id, i) => ({
            id: Number(id),
            name: u.sector_names.split(',')[i],
          }))
        : [],
    }));
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { username, password, full_name, role = 'cobrador', sectors = [] } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const result = await run(
      `INSERT INTO users (username, password_hash, role, full_name)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [username.trim(), hash, role, full_name.trim()]
    );
    const userId = result.rows[0].id;
    for (const sid of sectors) {
      await run(
        'INSERT INTO user_sectors (user_id, sector_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, sid]
      );
    }
    res.status(201).json({ id: userId });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { full_name, role, active, sectors } = req.body;
    const current = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (full_name !== undefined || role !== undefined || active !== undefined) {
      await run(
        `UPDATE users SET full_name = $1, role = $2, active = $3 WHERE id = $4`,
        [
          full_name ?? current.full_name,
          role ?? current.role,
          active !== undefined ? (active ? 1 : 0) : current.active,
          req.params.id,
        ]
      );
    }

    if (Array.isArray(sectors)) {
      await run('DELETE FROM user_sectors WHERE user_id = $1', [req.params.id]);
      for (const sid of sectors) {
        await run(
          'INSERT INTO user_sectors (user_id, sector_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, sid]
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/:id/password', auth, adminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    }
    const hash = bcrypt.hashSync(password, 10);
    await run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
