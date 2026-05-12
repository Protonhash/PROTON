async function minerRoutes(fastify, options) {
  // Heartbeat
  fastify.post('/heartbeat', { preHandler: [fastify.authenticate] }, async (request) => {
    const { hashrate, cpu_usage, gpu_usage, tasks_in_progress } = request.body;
    const userId = request.user.id;

    await fastify.db.query(
      `UPDATE users SET last_seen = NOW(), hashrate_avg = $1 WHERE id = $2`,
      [hashrate || 0, userId]
    );

    return {
      status: 'ok',
      server_time: Date.now(),
      next_heartbeat_ms: 30000,
    };
  });

  // Start mining session
  fastify.post('/session/start', { preHandler: [fastify.authenticate] }, async (request) => {
    const { device_info } = request.body;
    const userId = request.user.id;

    const result = await fastify.db.query(
      `INSERT INTO mining_sessions (user_id, device_info)
       VALUES ($1, $2) RETURNING id, started_at`,
      [userId, JSON.stringify(device_info || {})]
    );

    return {
      session_id: result.rows[0].id,
      started_at: result.rows[0].started_at,
    };
  });

  // End mining session
  fastify.post('/session/end', { preHandler: [fastify.authenticate] }, async (request) => {
    const { session_id } = request.body;
    const userId = request.user.id;

    const result = await fastify.db.query(
      `UPDATE mining_sessions 
       SET ended_at = NOW() 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [session_id, userId]
    );

    if (result.rows.length === 0) {
      return { error: 'Session not found' };
    }

    return { session: result.rows[0] };
  });

  // Get mining stats
  fastify.get('/stats', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.id;

    const userStats = await fastify.db.query(
      `SELECT total_points, total_tasks_completed, hashrate_avg, tier FROM users WHERE id = $1`,
      [userId]
    );

    const recentTasks = await fastify.db.query(
      `SELECT COUNT(*) as count, SUM(points_awarded) as points 
       FROM task_submissions 
       WHERE user_id = $1 AND submitted_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    const sessions = await fastify.db.query(
      `SELECT COUNT(*) as total_sessions,
              SUM(tasks_completed) as total_session_tasks
       FROM mining_sessions WHERE user_id = $1`,
      [userId]
    );

    const user = userStats.rows[0];
    const recent = recentTasks.rows[0];
    const sessionData = sessions.rows[0];

    // Estimated allocation (fake but motivating)
    const estimatedAllocation = Math.floor(user.total_points * 0.42);

    return {
      total_points: parseInt(user.total_points),
      total_tasks: user.total_tasks_completed,
      hashrate: user.hashrate_avg,
      tier: user.tier,
      last_24h: {
        tasks: parseInt(recent.count) || 0,
        points: parseInt(recent.points) || 0,
      },
      sessions: {
        total: parseInt(sessionData.total_sessions) || 0,
        tasks: parseInt(sessionData.total_session_tasks) || 0,
      },
      estimated_allocation: estimatedAllocation,
    };
  });

  // Benchmark submit
  fastify.post('/benchmark', { preHandler: [fastify.authenticate] }, async (request) => {
    const { cpu_score, gpu_score, memory_mb, cores, device_name } = request.body;
    const userId = request.user.id;

    // Store benchmark as device info in latest session
    const deviceInfo = { cpu_score, gpu_score, memory_mb, cores, device_name };

    // Update user tier based on benchmark
    let tier = 'bronze';
    const totalScore = (cpu_score || 0) + (gpu_score || 0);
    if (totalScore > 50000) tier = 'diamond';
    else if (totalScore > 20000) tier = 'platinum';
    else if (totalScore > 10000) tier = 'gold';
    else if (totalScore > 5000) tier = 'silver';

    await fastify.db.query(
      'UPDATE users SET tier = $1 WHERE id = $2',
      [tier, userId]
    );

    return {
      tier,
      cpu_score: cpu_score || 0,
      gpu_score: gpu_score || 0,
      total_score: totalScore,
      message: `Device classified as ${tier} tier`,
    };
  });
}

module.exports = minerRoutes;
