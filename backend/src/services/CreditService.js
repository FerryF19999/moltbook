/**
 * Credit Service - manages user credits
 */

const { queryOne, transaction } = require('../config/database');
const { getCreditCost } = require('../config/credits');

class CreditService {
  /**
   * Get credit balance for a user
   */
  static async getBalance(userId) {
    const row = await queryOne('SELECT balance FROM credits WHERE user_id = $1', [userId]);
    return row ? row.balance : 0;
  }

  /**
   * Initialize credits for a new user
   */
  static async initialize(userId, initialBalance = 100) {
    return queryOne(
      'INSERT INTO credits (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING RETURNING *',
      [userId, initialBalance]
    );
  }

  /**
   * Deduct credits for an API call
   * Returns { success, balance, cost } or throws
   */
  static async deduct(userId, model, metadata = {}) {
    const cost = getCreditCost(model);

    return transaction(async (client) => {
      // Lock row for update
      const { rows } = await client.query(
        'SELECT balance FROM credits WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (!rows.length) {
        throw Object.assign(new Error('No credit account found'), { status: 404 });
      }

      const currentBalance = rows[0].balance;
      if (currentBalance < cost) {
        throw Object.assign(new Error(`Insufficient credits. Need ${cost}, have ${currentBalance}`), { status: 402 });
      }

      const newBalance = currentBalance - cost;

      await client.query(
        'UPDATE credits SET balance = $1, updated_at = NOW() WHERE user_id = $2',
        [newBalance, userId]
      );

      await client.query(
        `INSERT INTO credit_transactions (user_id, type, amount, balance_after, model, metadata)
         VALUES ($1, 'deduct', $2, $3, $4, $5)`,
        [userId, -cost, newBalance, model, JSON.stringify(metadata)]
      );

      return { success: true, cost, balance: newBalance };
    });
  }

  /**
   * Top up credits
   */
  static async topup(userId, amount, metadata = {}) {
    return transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT balance FROM credits WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (!rows.length) {
        throw Object.assign(new Error('No credit account found'), { status: 404 });
      }

      const newBalance = rows[0].balance + amount;

      await client.query(
        'UPDATE credits SET balance = $1, updated_at = NOW() WHERE user_id = $2',
        [newBalance, userId]
      );

      await client.query(
        `INSERT INTO credit_transactions (user_id, type, amount, balance_after, metadata)
         VALUES ($1, 'topup', $2, $3, $4)`,
        [userId, amount, newBalance, JSON.stringify(metadata)]
      );

      return { success: true, balance: newBalance };
    });
  }

  /**
   * Get transaction history
   */
  static async getTransactions(userId, limit = 20, offset = 0) {
    const { rows } = await require('../config/database').query(
      `SELECT id, type, amount, balance_after, model, metadata, created_at
       FROM credit_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }
}

module.exports = CreditService;
