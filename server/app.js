require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize DB on first request (serverless-safe)
const { initDb } = require('./db');
let dbReady = null;
app.use(async (req, res, next) => {
  if (!dbReady) dbReady = initDb().catch(err => { dbReady = null; throw err; });
  try { await dbReady; next(); }
  catch (err) { console.error(err); res.status(503).json({ error: 'Base de datos no disponible' }); }
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sectors', require('./routes/sectors'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/credits', require('./routes/credits').router);
app.use('/api/collections', require('./routes/collections'));

// Serve built React app in production (local `npm start`)
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

module.exports = app;
