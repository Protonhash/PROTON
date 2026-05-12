const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, createTransferInstruction, getMint } = require('@solana/spl-token');
const bs58 = require('bs58');

// Config
const CLAIM_RATE = () => parseInt(process.env.CLAIM_RATE) || 1000; // points per 1 token
const CLAIM_MIN = () => parseInt(process.env.CLAIM_MIN_POINTS) || 100;
const CLAIM_COOLDOWN_MS = () => parseInt(process.env.CLAIM_COOLDOWN_MS) || 3600000; // 1 hour

async function claimRoutes(fastify, options) {

  // Check claim eligibility
  fastify.get('/status', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.id;

    const userResult = await fastify.db.query(
      'SELECT total_points, wallet_address FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    const claimedResult = await fastify.db.query(
      'SELECT COALESCE(SUM(tokens_claimed), 0) as total_claimed, MAX(claimed_at) as last_claim FROM token_claims WHERE user_id = $1',
      [userId]
    );
    const claimed = claimedResult.rows[0];

    const totalPoints = parseInt(user.total_points);
    const totalClaimed = parseFloat(claimed.total_claimed);
    const claimRate = CLAIM_RATE();
    const claimableTokens = Math.floor(totalPoints / claimRate) - totalClaimed;
    const lastClaim = claimed.last_claim;

    // Cooldown check
    const now = Date.now();
    const cooldownMs = CLAIM_COOLDOWN_MS();
    const canClaimAt = lastClaim ? new Date(lastClaim).getTime() + cooldownMs : 0;
    const canClaim = now >= canClaimAt && claimableTokens > 0 && !!user.wallet_address;

    const claimEnabled = process.env.CLAIM_ENABLED === 'true';
    const tokenMint = process.env.PROTON_TOKEN_MINT || null;

    return {
      eligible: canClaim && claimEnabled,
      claim_enabled: claimEnabled,
      total_points: totalPoints,
      claim_rate: claimRate,
      total_tokens_earned: Math.floor(totalPoints / claimRate),
      total_tokens_claimed: totalClaimed,
      claimable_tokens: Math.max(0, claimableTokens),
      wallet_bound: !!user.wallet_address,
      wallet_address: user.wallet_address || null,
      token_mint: tokenMint,
      cooldown_remaining_ms: Math.max(0, canClaimAt - now),
      last_claim: lastClaim,
    };
  });

  // Claim tokens
  fastify.post('/claim', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.id;
    const { amount } = request.body || {};

    // Check if claims are enabled
    if (process.env.CLAIM_ENABLED !== 'true') {
      return reply.status(503).send({ error: 'Token claims are not yet enabled. Stay tuned!' });
    }

    // Check token mint is configured
    const tokenMint = process.env.PROTON_TOKEN_MINT;
    if (!tokenMint) {
      return reply.status(503).send({ error: 'Token not configured yet' });
    }

    // Check distribution wallet
    const distKey = process.env.CLAIM_WALLET_PRIVATE_KEY;
    if (!distKey) {
      return reply.status(503).send({ error: 'Distribution wallet not configured' });
    }

    // Get user info
    const userResult = await fastify.db.query(
      'SELECT total_points, wallet_address FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    if (!user.wallet_address) {
      return reply.status(400).send({ error: 'Bind your Solana wallet first (POST /api/auth/wallet)' });
    }

    // Calculate claimable
    const claimedResult = await fastify.db.query(
      'SELECT COALESCE(SUM(tokens_claimed), 0) as total_claimed, MAX(claimed_at) as last_claim FROM token_claims WHERE user_id = $1',
      [userId]
    );
    const claimed = claimedResult.rows[0];

    const totalPoints = parseInt(user.total_points);
    const totalClaimed = parseFloat(claimed.total_claimed);
    const claimRate = CLAIM_RATE();
    const maxClaimable = Math.floor(totalPoints / claimRate) - totalClaimed;

    if (maxClaimable <= 0) {
      return reply.status(400).send({ error: 'No tokens available to claim. Keep mining!' });
    }

    // Cooldown check
    const lastClaim = claimed.last_claim;
    if (lastClaim) {
      const elapsed = Date.now() - new Date(lastClaim).getTime();
      if (elapsed < CLAIM_COOLDOWN_MS()) {
        const remaining = Math.ceil((CLAIM_COOLDOWN_MS() - elapsed) / 60000);
        return reply.status(429).send({ error: `Cooldown active. Try again in ${remaining} minutes.` });
      }
    }

    // Determine claim amount
    const claimAmount = amount ? Math.min(amount, maxClaimable) : maxClaimable;
    if (claimAmount < 1) {
      return reply.status(400).send({ error: 'Minimum claim is 1 token' });
    }

    // Execute Solana transfer
    try {
      const txSignature = await transferTokens(
        distKey,
        tokenMint,
        user.wallet_address,
        claimAmount
      );

      // Record claim
      await fastify.db.query(
        `INSERT INTO token_claims (user_id, tokens_claimed, points_spent, tx_signature, wallet_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, claimAmount, claimAmount * claimRate, txSignature, user.wallet_address]
      );

      return {
        success: true,
        tokens_claimed: claimAmount,
        points_spent: claimAmount * claimRate,
        tx_signature: txSignature,
        explorer_url: `https://solscan.io/tx/${txSignature}`,
        remaining_claimable: maxClaimable - claimAmount,
      };
    } catch (err) {
      console.error('Token transfer failed:', err.message);
      return reply.status(500).send({
        error: 'Token transfer failed. Try again later.',
        detail: err.message,
      });
    }
  });

  // Claim history
  fastify.get('/history', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.id;
    const { limit = 20, offset = 0 } = request.query;

    const result = await fastify.db.query(
      `SELECT * FROM token_claims WHERE user_id = $1 ORDER BY claimed_at DESC LIMIT $2 OFFSET $3`,
      [userId, Math.min(limit, 50), offset]
    );

    const totalResult = await fastify.db.query(
      'SELECT COALESCE(SUM(tokens_claimed), 0) as total FROM token_claims WHERE user_id = $1',
      [userId]
    );

    return {
      claims: result.rows.map(c => ({
        tokens: parseFloat(c.tokens_claimed),
        points_spent: parseInt(c.points_spent),
        tx_signature: c.tx_signature,
        wallet: c.wallet_address,
        claimed_at: c.claimed_at,
        explorer_url: `https://solscan.io/tx/${c.tx_signature}`,
      })),
      total_claimed: parseFloat(totalResult.rows[0].total),
    };
  });
}

// Solana SPL Token Transfer
async function transferTokens(distributionKeyBase58, tokenMintAddress, recipientAddress, amount) {
  const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(RPC_URL, 'confirmed');

  // Distribution wallet keypair
  const distributionKeypair = Keypair.fromSecretKey(bs58.decode(distributionKeyBase58));

  // Token mint
  const mintPubkey = new PublicKey(tokenMintAddress);
  const recipientPubkey = new PublicKey(recipientAddress);

  // Get mint info for decimals
  const mintInfo = await getMint(connection, mintPubkey);
  const decimals = mintInfo.decimals;
  const transferAmount = BigInt(amount) * BigInt(10 ** decimals);

  // Get or create associated token accounts
  const senderATA = await getOrCreateAssociatedTokenAccount(
    connection,
    distributionKeypair,
    mintPubkey,
    distributionKeypair.publicKey
  );

  const recipientATA = await getOrCreateAssociatedTokenAccount(
    connection,
    distributionKeypair,
    mintPubkey,
    recipientPubkey
  );

  // Create transfer instruction
  const transferIx = createTransferInstruction(
    senderATA.address,
    recipientATA.address,
    distributionKeypair.publicKey,
    transferAmount
  );

  // Build and send transaction
  const transaction = new Transaction().add(transferIx);
  transaction.feePayer = distributionKeypair.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  transaction.sign(distributionKeypair);
  const txSignature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(txSignature, 'confirmed');

  return txSignature;
}

module.exports = claimRoutes;
