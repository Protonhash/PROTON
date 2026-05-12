const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');

async function authRoutes(fastify, options) {
  // Register
  fastify.post('/register', async (request, reply) => {
    const { username, password, email, referral_code } = request.body;

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' });
    }

    if (username.length < 3 || username.length > 50) {
      return reply.status(400).send({ error: 'Username must be 3-50 characters' });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userReferralCode = nanoid(8).toUpperCase();

    let referrerId = null;
    if (referral_code) {
      const referrer = await fastify.db.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [referral_code]
      );
      if (referrer.rows.length > 0) {
        referrerId = referrer.rows[0].id;
      }
    }

    try {
      const result = await fastify.db.query(
        `INSERT INTO users (username, email, password_hash, referral_code, referred_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, referral_code, total_points, tier, created_at`,
        [username, email || null, passwordHash, userReferralCode, referrerId]
      );

      const user = result.rows[0];

      // Record referral
      if (referrerId) {
        await fastify.db.query(
          'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)',
          [referrerId, user.id]
        );
      }

      const token = fastify.jwt.sign({ id: user.id, username: user.username });

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          referral_code: user.referral_code,
          total_points: user.total_points,
          tier: user.tier,
        },
      };
    } catch (err) {
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Username or email already exists' });
      }
      throw err;
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' });
    }

    const result = await fastify.db.query(
      'SELECT id, username, password_hash, referral_code, total_points, tier, is_banned FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.is_banned) {
      return reply.status(403).send({ error: 'Account suspended' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // Update last seen
    await fastify.db.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    const token = fastify.jwt.sign({ id: user.id, username: user.username });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        referral_code: user.referral_code,
        total_points: user.total_points,
        tier: user.tier,
      },
    };
  });

  // Get profile
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const result = await fastify.db.query(
      `SELECT id, username, email, wallet_address, referral_code, total_points, 
              total_tasks_completed, hashrate_avg, tier, created_at, last_seen
       FROM users WHERE id = $1`,
      [request.user.id]
    );
    return { user: result.rows[0] };
  });

  // Bind wallet
  fastify.post('/wallet', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { wallet_address } = request.body;
    if (!wallet_address) {
      return reply.status(400).send({ error: 'Wallet address required' });
    }

    await fastify.db.query(
      'UPDATE users SET wallet_address = $1 WHERE id = $2',
      [wallet_address, request.user.id]
    );

    return { success: true, wallet_address };
  });
}

module.exports = authRoutes;
