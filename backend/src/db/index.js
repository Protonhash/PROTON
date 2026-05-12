const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://proton:proton@localhost:5432/proton',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
