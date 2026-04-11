const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new DatabaseSync(path.join(dataDir, 'cobranza.db'));

// Enable WAL for better performance and foreign key enforcement
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ── Create tables ──────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'cobrador',
    full_name     TEXT    NOT NULL,
    active        INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sectors (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_sectors (
    user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, sector_id)
  );

  CREATE TABLE IF NOT EXISTS clients (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at     TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS collection_records (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id    INTEGER NOT NULL REFERENCES clients(id),
    cobrador_id  INTEGER REFERENCES users(id),
    due_date     TEXT    NOT NULL,
    status       TEXT    NOT NULL,
    new_due_date TEXT,
    notes        TEXT    DEFAULT '',
    recorded_at  TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_records_client_due
    ON collection_records(client_id, due_date DESC);

  CREATE INDEX IF NOT EXISTS idx_clients_due_date
    ON clients(next_due_date, active);
`);

// ── Seed default admin ─────────────────────────────────────────────────────

const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
if (userCount.cnt === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    `INSERT INTO users (username, password_hash, role, full_name)
     VALUES ('admin', ?, 'admin', 'Administrador')`
  ).run(hash);
  console.log('Base de datos inicializada. Usuario por defecto: admin / admin123');
}

module.exports = db;
