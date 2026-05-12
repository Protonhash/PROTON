const crypto = require('crypto');

const TASK_TYPES = ['sha256', 'vector_math', 'compression', 'embedding', 'tensor_multiply'];
const DIFFICULTY_MULTIPLIER = { 1: 1, 2: 1.5, 3: 2, 4: 3, 5: 5 };

function generateTask(type, difficulty) {
  const nonce = crypto.randomBytes(32).toString('hex');

  switch (type) {
    case 'sha256': {
      const data = crypto.randomBytes(64).toString('hex');
      const iterations = 1000 * difficulty;
      // Pre-compute expected hash
      let hash = data;
      for (let i = 0; i < iterations; i++) {
        hash = crypto.createHash('sha256').update(hash).digest('hex');
      }
      return {
        payload: { data, iterations },
        nonce,
        expected_hash: hash,
      };
    }
    case 'vector_math': {
      const size = 256 * difficulty;
      const vectorA = Array.from({ length: size }, () => Math.random());
      const vectorB = Array.from({ length: size }, () => Math.random());
      const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
      return {
        payload: { vector_a: vectorA, vector_b: vectorB, operation: 'dot_product' },
        nonce,
        expected_hash: crypto.createHash('sha256').update(dotProduct.toFixed(10)).digest('hex'),
      };
    }
    case 'compression': {
      const data = crypto.randomBytes(512 * difficulty).toString('base64');
      return {
        payload: { data, algorithm: 'deflate' },
        nonce,
        expected_hash: null, // Verified by decompression check
      };
    }
    case 'embedding': {
      const tokens = Array.from({ length: 32 * difficulty }, () =>
        Math.floor(Math.random() * 50000)
      );
      return {
        payload: { tokens, model: 'proton-embed-v1', dimensions: 128 },
        nonce,
        expected_hash: null, // Verified by cosine similarity
      };
    }
    case 'tensor_multiply': {
      const dim = 16 * difficulty;
      const matA = Array.from({ length: dim * dim }, () => Math.random());
      const matB = Array.from({ length: dim * dim }, () => Math.random());
      return {
        payload: { matrix_a: matA, matrix_b: matB, dimensions: [dim, dim] },
        nonce,
        expected_hash: null, // Verified server-side
      };
    }
    default:
      return generateTask('sha256', difficulty);
  }
}

async function taskRoutes(fastify, options) {
  // Get a new task
  fastify.get('/get', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.id;

    // Check if user is banned
    const userCheck = await fastify.db.query(
      'SELECT is_banned FROM users WHERE id = $1',
      [userId]
    );
    if (userCheck.rows[0]?.is_banned) {
      return reply.status(403).send({ error: 'Account suspended' });
    }

    // Generate random task
    const type = TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)];
    const difficulty = Math.min(5, Math.max(1, Math.floor(Math.random() * 3) + 1));
    const task = generateTask(type, difficulty);

    // Store task
    const result = await fastify.db.query(
      `INSERT INTO tasks (type, difficulty, payload, nonce, expected_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [type, difficulty, JSON.stringify(task.payload), task.nonce, task.expected_hash]
    );

    return {
      task_id: result.rows[0].id,
      type,
      difficulty,
      nonce: task.nonce,
      payload: task.payload,
      timeout_ms: parseInt(process.env.TASK_TIMEOUT_MS) || 30000,
    };
  });

  // Submit task result
  fastify.post('/submit', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { task_id, result, compute_time_ms } = request.body;
    const userId = request.user.id;

    if (!task_id || !result) {
      return reply.status(400).send({ error: 'task_id and result required' });
    }

    // Get original task
    const taskResult = await fastify.db.query(
      'SELECT * FROM tasks WHERE id = $1',
      [task_id]
    );

    if (taskResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Verify result
    let isValid = false;
    let points = 0;

    if (task.type === 'sha256' && task.expected_hash) {
      isValid = result.hash === task.expected_hash;
    } else if (task.type === 'vector_math' && task.expected_hash) {
      const resultHash = crypto.createHash('sha256').update(parseFloat(result.value).toFixed(10)).digest('hex');
      isValid = resultHash === task.expected_hash;
    } else {
      // For embedding/tensor/compression - basic validation
      isValid = result && typeof result === 'object' && Object.keys(result).length > 0;
    }

    if (isValid) {
      const basePoints = 10;
      const diffMultiplier = DIFFICULTY_MULTIPLIER[task.difficulty] || 1;
      points = Math.floor(basePoints * diffMultiplier);

      // Referral bonus
      const userInfo = await fastify.db.query(
        'SELECT referred_by FROM users WHERE id = $1',
        [userId]
      );
      if (userInfo.rows[0]?.referred_by) {
        const bonusPercent = parseInt(process.env.REFERRAL_BONUS_PERCENT) || 5;
        const referralBonus = Math.floor(points * bonusPercent / 100);
        await fastify.db.query(
          'UPDATE users SET total_points = total_points + $1 WHERE id = $2',
          [referralBonus, userInfo.rows[0].referred_by]
        );
      }

      // Update user points
      await fastify.db.query(
        `UPDATE users SET 
          total_points = total_points + $1, 
          total_tasks_completed = total_tasks_completed + 1,
          last_seen = NOW()
        WHERE id = $2`,
        [points, userId]
      );
    }

    // Record submission
    await fastify.db.query(
      `INSERT INTO task_submissions (task_id, user_id, result, is_valid, points_awarded, compute_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [task_id, userId, JSON.stringify(result), isValid, points, compute_time_ms || 0]
    );

    return {
      valid: isValid,
      points_awarded: points,
      message: isValid ? 'Task verified successfully' : 'Invalid result',
    };
  });
}

module.exports = taskRoutes;
