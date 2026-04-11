const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper: run a query and return rows
async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

// Helper: run a query and return first row
async function queryOne(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

// Helper: run INSERT/UPDATE/DELETE, return { rowCount, rows }
async function run(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

// ── Create tables ──────────────────────────────────────────────────────────

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'cobrador',
      full_name     TEXT    NOT NULL,
      active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sectors (
      id   SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sectors (
      user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
      sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, sector_id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id             SERIAL PRIMARY KEY,
      full_name      TEXT    NOT NULL,
      credit_number  TEXT    UNIQUE NOT NULL,
      address        TEXT    DEFAULT '',
      product_name   TEXT    DEFAULT '',
      payment_period TEXT    NOT NULL,
      sector_id      INTEGER NOT NULL REFERENCES sectors(id),
      start_date     TEXT    NOT NULL,
      next_due_date  TEXT    NOT NULL,
      active         INTEGER NOT NULL DEFAULT 1,
      created_by     INTEGER REFERENCES users(id),
      created_at     TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS collection_records (
      id           SERIAL PRIMARY KEY,
      client_id    INTEGER NOT NULL REFERENCES clients(id),
      cobrador_id  INTEGER REFERENCES users(id),
      due_date     TEXT    NOT NULL,
      status       TEXT    NOT NULL,
      new_due_date TEXT,
      notes        TEXT    DEFAULT '',
      recorded_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_records_client_due
      ON collection_records(client_id, due_date DESC);

    CREATE INDEX IF NOT EXISTS idx_clients_due_date
      ON clients(next_due_date, active);
  `);

  // Seed default admin if no users exist
  const result = await pool.query('SELECT COUNT(*) AS cnt FROM users');
  if (Number(result.rows[0].cnt) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, role, full_name)
       VALUES ('admin', $1, 'admin', 'Administrador')`,
      [hash]
    );
    console.log('Base de datos inicializada. Usuario por defecto: admin / admin123');
  }
}

initDb().catch(err => {
  console.error('Error inicializando la base de datos:', err.message);
  process.exit(1);
});

module.exports = { pool, query, queryOne, run };
