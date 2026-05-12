require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./index');

const migrations = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(64),
  referral_code VARCHAR(12) UNIQUE NOT NULL,
  referred_by INTEGER REFERENCES users(id),
  total_points BIGINT DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  hashrate_avg DOUBLE PRECISION DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'bronze',
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW()
);

-- Mining sessions
CREATE TABLE IF NOT EXISTS mining_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  tasks_completed INTEGER DEFAULT 0,
  points_earned BIGINT DEFAULT 0,
  avg_hashrate DOUBLE PRECISION DEFAULT 0,
  device_info JSONB
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  difficulty INTEGER DEFAULT 1,
  payload JSONB NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  expected_hash VARCHAR(128),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Task submissions
CREATE TABLE IF NOT EXISTS task_submissions (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  session_id INTEGER REFERENCES mining_sessions(id),
  result JSONB NOT NULL,
  is_valid BOOLEAN DEFAULT false,
  points_awarded BIGINT DEFAULT 0,
  compute_time_ms INTEGER,
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER REFERENCES users(id) NOT NULL,
  referred_id INTEGER REFERENCES users(id) NOT NULL,
  bonus_points BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Epochs
CREATE TABLE IF NOT EXISTS epochs (
  id SERIAL PRIMARY KEY,
  epoch_number INTEGER UNIQUE NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  total_points_distributed BIGINT DEFAULT 0,
  total_miners INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_points ON users(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON mining_sessions(user_id);
`;

async function migrate() {
  console.log('Running PROTON migrations...');
  try {
    await db.query(migrations);
    console.log('Migrations complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await db.pool.end();
  }
}

migrate();
