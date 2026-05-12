async function leaderboardRoutes(fastify, options) {
  // Global leaderboard
  fastify.get('/', async (request) => {
    const { limit = 50, offset = 0 } = request.query;

    const result = await fastify.db.query(
      `SELECT id, username, total_points, total_tasks_completed, hashrate_avg, tier, created_at
       FROM users
       WHERE is_banned = false
       ORDER BY total_points DESC
       LIMIT $1 OFFSET $2`,
      [Math.min(limit, 100), offset]
    );

    const countResult = await fastify.db.query(
      'SELECT COUNT(*) as total FROM users WHERE is_banned = false'
    );

    return {
      miners: result.rows.map((row, i) => ({
        rank: parseInt(offset) + i + 1,
        username: row.username,
        points: parseInt(row.total_points),
        tasks: row.total_tasks_completed,
        hashrate: row.hashrate_avg,
        tier: row.tier,
        joined: row.created_at,
      })),
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    };
  });

  // Top miners this epoch
  fastify.get('/epoch', async (request) => {
    const result = await fastify.db.query(
      `SELECT u.username, u.tier, SUM(ts.points_awarded) as epoch_points, COUNT(ts.id) as epoch_tasks
       FROM task_submissions ts
       JOIN users u ON ts.user_id = u.id
       WHERE ts.submitted_at > NOW() - INTERVAL '1 hour'
         AND ts.is_valid = true
         AND u.is_banned = false
       GROUP BY u.id, u.username, u.tier
       ORDER BY epoch_points DESC
       LIMIT 20`
    );

    return {
      epoch: 'current',
      duration: '1 hour',
      top_miners: result.rows.map((row, i) => ({
        rank: i + 1,
        username: row.username,
        tier: row.tier,
        points: parseInt(row.epoch_points),
        tasks: parseInt(row.epoch_tasks),
      })),
    };
  });

  // Stats overview
  fastify.get('/stats', async () => {
    const totalMiners = await fastify.db.query(
      'SELECT COUNT(*) as count FROM users WHERE is_banned = false'
    );
    const totalPoints = await fastify.db.query(
      'SELECT COALESCE(SUM(total_points), 0) as total FROM users'
    );
    const totalTasks = await fastify.db.query(
      'SELECT COUNT(*) as count FROM task_submissions WHERE is_valid = true'
    );
    const activeMiners = await fastify.db.query(
      "SELECT COUNT(*) as count FROM users WHERE last_seen > NOW() - INTERVAL '5 minutes'"
    );

    return {
      total_miners: parseInt(totalMiners.rows[0].count),
      total_points_distributed: parseInt(totalPoints.rows[0].total),
      total_tasks_completed: parseInt(totalTasks.rows[0].count),
      active_miners: parseInt(activeMiners.rows[0].count),
      network_hashrate: Math.floor(Math.random() * 1000000 + 500000), // Fake for now
    };
  });
}

module.exports = leaderboardRoutes;
