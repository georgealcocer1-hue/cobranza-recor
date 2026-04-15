const { Pool } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  return pool.query(sql, params);
}

async function initDb() {
  // Schema migrations: fix tables created with old schema
  try {
    await pool.query(`SELECT credit_id FROM collection_records LIMIT 1`);
  } catch (e) {
    if (e.message && e.message.includes('credit_id')) {
      await pool.query(`DROP TABLE IF EXISTS collection_records`);
    }
  }
  // Add missing 'phone' column to clients (added in redesign)
  try {
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT ''`);
  } catch (e) { /* table may not exist yet */ }

  // Fix legacy 'clients' tables that mixed credit columns into clients
  // (drop credit-related columns and relax sector_id NOT NULL)
  try {
    await pool.query(`ALTER TABLE clients DROP COLUMN IF EXISTS credit_number`);
    await pool.query(`ALTER TABLE clients DROP COLUMN IF EXISTS product_name`);
    await pool.query(`ALTER TABLE clients DROP COLUMN IF EXISTS payment_period`);
    await pool.query(`ALTER TABLE clients DROP COLUMN IF EXISTS start_date`);
    await pool.query(`ALTER TABLE clients DROP COLUMN IF EXISTS next_due_date`);
    await pool.query(`ALTER TABLE clients ALTER COLUMN sector_id DROP NOT NULL`);
  } catch (e) { /* table may not exist yet */ }

  // Run each statement separately — required for serverless PostgreSQL drivers
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'cobrador',
      full_name     TEXT    NOT NULL,
      active        INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sectors (
      id   SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sectors (
      user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
      sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, sector_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id         SERIAL PRIMARY KEY,
      full_name  TEXT    NOT NULL,
      phone      TEXT    DEFAULT '',
      address    TEXT    DEFAULT '',
      sector_id  INTEGER REFERENCES sectors(id),
      active     INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS credits (
      id                SERIAL PRIMARY KEY,
      client_id         INTEGER NOT NULL REFERENCES clients(id),
      credit_number     TEXT    UNIQUE NOT NULL,
      quota_value       NUMERIC(12,2) NOT NULL DEFAULT 0,
      product_reference TEXT    DEFAULT '',
      payment_period    TEXT    NOT NULL,
      specific_days     TEXT    DEFAULT '[]',
      start_date        TEXT    NOT NULL,
      next_due_date     TEXT    NOT NULL,
      active            INTEGER NOT NULL DEFAULT 1,
      created_by        INTEGER REFERENCES users(id),
      created_at        TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS collection_records (
      id           SERIAL PRIMARY KEY,
      credit_id    INTEGER NOT NULL REFERENCES credits(id),
      cobrador_id  INTEGER REFERENCES users(id),
      due_date     TEXT    NOT NULL,
      status       TEXT    NOT NULL,
      new_due_date TEXT,
      notes        TEXT    DEFAULT '',
      recorded_at  TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_records_credit_due
      ON collection_records(credit_id, due_date DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_credits_due_date
      ON credits(next_due_date, active)
  `);

  // Seed admin if empty
  const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM users');
  if (Number(rows[0].cnt) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, role, full_name)
       VALUES ('admin', $1, 'admin', 'Administrador')`,
      [hash]
    );
    console.log('DB inicializada. Usuario: admin / admin123');
  }
}

module.exports = { pool, query, queryOne, run, initDb };
