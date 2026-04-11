const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? AND active = 1'
  ).get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  // Get assigned sectors
  const sectors = db.prepare(
    'SELECT sector_id FROM user_sectors WHERE user_id = ?'
  ).all(user.id).map(r => r.sector_id);

  const payload = {
    id: user.id,
    role: user.role,
    full_name: user.full_name,
    sectors,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

  res.json({ token, user: payload });
});

module.exports = router;
