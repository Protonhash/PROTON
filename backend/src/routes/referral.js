async function referralRoutes(fastify, options) {
  // Get my referrals
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.id;

    const result = await fastify.db.query(
      `SELECT r.*, u.username, u.total_points, u.created_at as user_joined
       FROM referrals r
       JOIN users u ON r.referred_id = u.id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    const totalBonus = await fastify.db.query(
      'SELECT COALESCE(SUM(bonus_points), 0) as total FROM referrals WHERE referrer_id = $1',
      [userId]
    );

    return {
      referrals: result.rows.map((r) => ({
        username: r.username,
        points: parseInt(r.total_points),
        bonus_earned: parseInt(r.bonus_points),
        joined: r.user_joined,
      })),
      total_referrals: result.rows.length,
      total_bonus_earned: parseInt(totalBonus.rows[0].total),
    };
  });

  // Get referral code
  fastify.get('/code', { preHandler: [fastify.authenticate] }, async (request) => {
    const result = await fastify.db.query(
      'SELECT referral_code FROM users WHERE id = $1',
      [request.user.id]
    );

    return {
      referral_code: result.rows[0].referral_code,
      referral_link: `https://proton.fun/join?ref=${result.rows[0].referral_code}`,
    };
  });
}

module.exports = referralRoutes;
