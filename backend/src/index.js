require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const minerRoutes = require('./routes/miner');
const leaderboardRoutes = require('./routes/leaderboard');
const referralRoutes = require('./routes/referral');
const ownerRoutes = require('./routes/owner');
const claimRoutes = require('./routes/claim');
const db = require('./db');

async function start() {
  // Plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(jwt, { secret: process.env.JWT_SECRET || 'proton-dev-secret' });

  // Decorators
  fastify.decorate('db', db);

  // Auth hook
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(taskRoutes, { prefix: '/api/tasks' });
  await fastify.register(minerRoutes, { prefix: '/api/miner' });
  await fastify.register(leaderboardRoutes, { prefix: '/api/leaderboard' });
  await fastify.register(referralRoutes, { prefix: '/api/referral' });
  await fastify.register(ownerRoutes, { prefix: '/api/owner' });
  await fastify.register(claimRoutes, { prefix: '/api/claim' });

  // Health
  fastify.get('/health', async () => ({ status: 'ok', version: '0.1.0', name: 'PROTON' }));

  // Start
  const port = process.env.PORT || 3001;
  const host = process.env.HOST || '0.0.0.0';
  await fastify.listen({ port, host });
  console.log(`⚡ PROTON Backend running on ${host}:${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
