require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

// ── Required env validation ────────────────────────────────────────────────
// Fail fast on boot if a critical secret is missing or is the placeholder
// that was committed to the repo. JWT_SECRET must be set to a real, random
// value in the hosting env (Vercel, local .env, etc.).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 24
    || JWT_SECRET.includes('cambiar_en_produccion')) {
  // eslint-disable-next-line no-console
  console.error(
    '[BOOT] JWT_SECRET ausente o débil. Define una variable de entorno ' +
    'JWT_SECRET con al menos 24 caracteres aleatorios (openssl rand -hex 32).'
  );
  throw new Error('JWT_SECRET no configurado de forma segura');
}

const app = express();

// Trust the proxy in front (Vercel/etc) so req.ip reflects the real client.
// Without this, express-rate-limit would bucket every request under the
// proxy's IP and effectively rate-limit everyone together.
app.set('trust proxy', 1);

// CORS: allow only configured origins. ALLOWED_ORIGINS is a comma-separated
// list, e.g. "https://cobranza-recor.vercel.app,http://localhost:5173".
// Requests without an Origin header (curl, health checks) are allowed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS bloqueado para origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

// Initialize DB on first request (serverless-safe)
const { initDb } = require('./db');
let dbReady = null;
app.use(async (req, res, next) => {
  if (!dbReady) dbReady = initDb().catch(err => { dbReady = null; throw err; });
  try { await dbReady; next(); }
  catch (err) {
    console.error('initDb error:', err);
    res.status(503).json({ error: 'Base de datos no disponible', detail: err.message });
  }
});

// Health check (diagnóstico)
app.get('/api/health', async (req, res) => {
  try {
    const { pool } = require('./db');
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'conectada' });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sectors', require('./routes/sectors'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/credits', require('./routes/credits').router);
app.use('/api/collections', require('./routes/collections'));
app.use('/api/stats', require('./routes/stats'));

// Serve built React app in production (local `npm start`)
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// ── Global error handler ──────────────────────────────────────────────────
// Anything a route passes to `next(err)` — or any uncaught rejection in an
// async handler — ends up here. Logs the full error server-side and returns
// a useful status based on PostgreSQL error codes.
//
//   23502 not_null_violation  → 400
//   23503 fk_violation        → 409 (usually "still in use")
//   23505 unique_violation    → 409
//   23514 check_violation     → 400
app.use((err, req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(`[${req.method} ${req.originalUrl}]`, err);

  // CORS rejection
  if (err && err.message && err.message.startsWith('CORS bloqueado')) {
    return res.status(403).json({ error: err.message });
  }

  // Map known PostgreSQL error codes
  const pgCode = err && err.code;
  if (pgCode === '23502') {
    return res.status(400).json({ error: `Campo requerido faltante${err.column ? `: ${err.column}` : ''}` });
  }
  if (pgCode === '23503') {
    return res.status(409).json({ error: 'Operación bloqueada: el registro está siendo referenciado por otros datos' });
  }
  if (pgCode === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos únicos' });
  }
  if (pgCode === '23514') {
    return res.status(400).json({ error: 'Datos inválidos (restricción de check)' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Error del servidor',
  });
});

module.exports = app;
