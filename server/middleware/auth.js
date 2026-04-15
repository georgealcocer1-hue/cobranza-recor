const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

/**
 * Builds a safe sector-scoped SQL filter based on the authenticated user.
 *
 * Rules:
 *   - admin → no scope; may optionally filter to any ?sector_id.
 *   - non-admin with ≥1 assigned sector → always scoped to their sectors;
 *     may filter to one of them via ?sector_id. Passing a sector_id that is
 *     not theirs returns `empty: true` (the caller should short-circuit).
 *   - non-admin with 0 assigned sectors → `empty: true` (sees nothing).
 *
 * @param {object} req       Express request (must have req.user from `auth`).
 * @param {string} column    SQL column to filter on, e.g. "cl.sector_id".
 * @param {any[]} baseParams Params already bound in the caller's query.
 *                           New placeholders ($N) continue from these.
 * @returns {{ filter: string, params: any[], empty: boolean }}
 */
function applySectorFilter(req, column, baseParams = []) {
  const user = req.user;
  const params = [...baseParams];
  const requested = req.query.sector_id != null && req.query.sector_id !== ''
    ? Number(req.query.sector_id)
    : null;
  if (requested != null && !Number.isInteger(requested)) {
    return { filter: '', params, empty: true };
  }

  if (user.role === 'admin') {
    if (requested != null) {
      params.push(requested);
      return { filter: `AND ${column} = $${params.length}`, params, empty: false };
    }
    return { filter: '', params, empty: false };
  }

  // Non-admin
  if (!Array.isArray(user.sectors) || user.sectors.length === 0) {
    return { filter: '', params, empty: true };
  }

  if (requested != null) {
    if (!user.sectors.includes(requested)) {
      return { filter: '', params, empty: true };
    }
    params.push(requested);
    return { filter: `AND ${column} = $${params.length}`, params, empty: false };
  }

  params.push(user.sectors);
  return { filter: `AND ${column} = ANY($${params.length}::int[])`, params, empty: false };
}

module.exports = { auth, adminOnly, applySectorFilter };
