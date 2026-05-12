async function ownerRoutes(fastify, options) {
  // Middleware: verify owner secret
  function verifyOwner(request, reply, done) {
    const secret = request.headers['x-owner-secret'] || request.query.secret;
    const ownerSecret = process.env.OWNER_SECRET || 'proton-owner-admin-key';
    if (secret !== ownerSecret) {
      reply.status(403).send({ error: 'Forbidden: invalid owner credentials' });
      return;
    }
    done();
  }

  // Get owner dashboard - total fees, balance, stats
  fastify.get('/dashboard', { preHandler: verifyOwner }, async (request) => {
    const ownerWallet = process.env.OWNER_WALLET || 'NOT_SET';

    // Total fees collected
    const feesResult = await fastify.db.query(
      'SELECT COALESCE(SUM(fee_points), 0) as total_fees, COUNT(*) as total_transactions FROM owner_fees WHERE owner_wallet = $1',
      [ownerWallet]
    );

    // Fees last 24h
    const fees24h = await fastify.db.query(
      `SELECT COALESCE(SUM(fee_points), 0) as fees_24h, COUNT(*) as txns_24h 
       FROM owner_fees 
       WHERE owner_wallet = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [ownerWallet]
    );

    // Fees last 7 days
    const fees7d = await fastify.db.query(
      `SELECT COALESCE(SUM(fee_points), 0) as fees_7d 
       FROM owner_fees 
       WHERE owner_wallet = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [ownerWallet]
    );

    // Withdrawal history
    const withdrawals = await fastify.db.query(
      `SELECT COALESCE(SUM(total_withdrawn), 0) as total_withdrawn 
       FROM owner_balance WHERE wallet_address = $1`,
      [ownerWallet]
    );

    const totalFees = parseInt(feesResult.rows[0].total_fees);
    const totalWithdrawn = parseInt(withdrawals.rows[0].total_withdrawn);

    return {
      owner_wallet: ownerWallet,
      fee_percent: parseFloat(process.env.OWNER_FEE_PERCENT) || 10,
      total_fees_collected: totalFees,
      total_withdrawn: totalWithdrawn,
      available_balance: totalFees - totalWithdrawn,
      last_24h: {
        fees: parseInt(fees24h.rows[0].fees_24h),
        transactions: parseInt(fees24h.rows[0].txns_24h),
      },
      last_7d: {
        fees: parseInt(fees7d.rows[0].fees_7d),
      },
      estimated_token_value: totalFees * 0.001, // fake USD estimate
    };
  });

  // Get fee history (paginated)
  fastify.get('/fees', { preHandler: verifyOwner }, async (request) => {
    const { limit = 50, offset = 0 } = request.query;

    const result = await fastify.db.query(
      `SELECT of.*, u.username 
       FROM owner_fees of
       JOIN users u ON of.user_id = u.id
       ORDER BY of.created_at DESC
       LIMIT $1 OFFSET $2`,
      [Math.min(limit, 200), offset]
    );

    const countResult = await fastify.db.query('SELECT COUNT(*) as total FROM owner_fees');

    return {
      fees: result.rows.map(f => ({
        id: f.id,
        miner: f.username,
        gross_points: parseInt(f.gross_points),
        fee_points: parseInt(f.fee_points),
        net_to_miner: parseInt(f.net_points),
        fee_percent: f.fee_percent,
        created_at: f.created_at,
      })),
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    };
  });

  // Update owner wallet address
  fastify.post('/wallet', { preHandler: verifyOwner }, async (request, reply) => {
    const { wallet_address } = request.body;
    if (!wallet_address || wallet_address.length < 32) {
      return reply.status(400).send({ error: 'Valid Solana wallet address required (32+ chars)' });
    }

    // Update in env won't persist, but update DB records going forward
    process.env.OWNER_WALLET = wallet_address;

    return {
      success: true,
      wallet_address,
      message: 'Owner wallet updated. Update .env for persistence across restarts.',
    };
  });

  // Update fee percentage
  fastify.post('/fee-percent', { preHandler: verifyOwner }, async (request, reply) => {
    const { fee_percent } = request.body;
    if (fee_percent === undefined || fee_percent < 0 || fee_percent > 50) {
      return reply.status(400).send({ error: 'fee_percent must be between 0 and 50' });
    }

    process.env.OWNER_FEE_PERCENT = fee_percent.toString();

    return {
      success: true,
      fee_percent,
      message: `Fee updated to ${fee_percent}%. Update .env for persistence.`,
    };
  });

  // Withdraw - mark balance as withdrawn (actual Solana transfer handled externally)
  fastify.post('/withdraw', { preHandler: verifyOwner }, async (request, reply) => {
    const { amount } = request.body;
    const ownerWallet = process.env.OWNER_WALLET || 'NOT_SET';

    if (ownerWallet === 'NOT_SET' || ownerWallet === 'YOUR_SOLANA_WALLET_ADDRESS_HERE') {
      return reply.status(400).send({ error: 'Set your OWNER_WALLET in .env first' });
    }

    // Calculate available
    const feesResult = await fastify.db.query(
      'SELECT COALESCE(SUM(fee_points), 0) as total FROM owner_fees WHERE owner_wallet = $1',
      [ownerWallet]
    );
    const balanceResult = await fastify.db.query(
      'SELECT COALESCE(SUM(total_withdrawn), 0) as withdrawn FROM owner_balance WHERE wallet_address = $1',
      [ownerWallet]
    );

    const totalFees = parseInt(feesResult.rows[0].total);
    const totalWithdrawn = parseInt(balanceResult.rows[0].withdrawn);
    const available = totalFees - totalWithdrawn;

    const withdrawAmount = amount || available; // Default: withdraw all

    if (withdrawAmount <= 0) {
      return reply.status(400).send({ error: 'Nothing to withdraw' });
    }
    if (withdrawAmount > available) {
      return reply.status(400).send({ error: `Insufficient balance. Available: ${available}` });
    }

    // Record withdrawal
    await fastify.db.query(
      `INSERT INTO owner_balance (wallet_address, total_fees_collected, total_withdrawn, last_updated)
       VALUES ($1, 0, $2, NOW())
       ON CONFLICT (wallet_address) DO UPDATE SET
         total_withdrawn = owner_balance.total_withdrawn + $2,
         last_updated = NOW()`,
      [ownerWallet, withdrawAmount]
    );

    return {
      success: true,
      withdrawn: withdrawAmount,
      remaining_balance: available - withdrawAmount,
      wallet: ownerWallet,
      message: `Marked ${withdrawAmount} points as withdrawn to ${ownerWallet}. Token conversion pending.`,
      // In production: trigger Solana SPL transfer here
    };
  });

  // Get daily revenue chart data
  fastify.get('/revenue', { preHandler: verifyOwner }, async (request) => {
    const { days = 30 } = request.query;

    const result = await fastify.db.query(
      `SELECT DATE(created_at) as date, 
              SUM(fee_points) as daily_fees,
              COUNT(*) as daily_txns
       FROM owner_fees
       WHERE created_at > NOW() - INTERVAL '${Math.min(days, 90)} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );

    return {
      revenue: result.rows.map(r => ({
        date: r.date,
        fees: parseInt(r.daily_fees),
        transactions: parseInt(r.daily_txns),
      })),
    };
  });
}

module.exports = ownerRoutes;
