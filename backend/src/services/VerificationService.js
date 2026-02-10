/**
 * Verification Service - GitHub & Telegram verification
 */

const crypto = require('crypto');
const { queryOne, query } = require('../config/database');

class VerificationService {
  /**
   * Generate a unique verification token for a user
   */
  static async generateToken(userId, type) {
    const token = `moltbook_verify_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Invalidate old tokens
    await query(
      'UPDATE verification_tokens SET used = true WHERE user_id = $1 AND type = $2 AND used = false',
      [userId, type]
    );

    await query(
      `INSERT INTO verification_tokens (user_id, type, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, type, token, expiresAt]
    );

    return token;
  }

  /**
   * Verify GitHub - check that a Gist exists with the token
   */
  static async verifyGithub(userId, gistUrl) {
    // Extract gist ID from URL
    const gistMatch = gistUrl.match(/gist\.github\.com\/([^/]+)\/([a-f0-9]+)/);
    if (!gistMatch) {
      throw Object.assign(new Error('Invalid Gist URL format'), { status: 400 });
    }

    const githubUsername = gistMatch[1];
    const gistId = gistMatch[2];

    // Get pending token for this user
    const tokenRow = await queryOne(
      `SELECT token FROM verification_tokens 
       WHERE user_id = $1 AND type = 'github' AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (!tokenRow) {
      throw Object.assign(new Error('No pending verification token. Generate one first.'), { status: 400 });
    }

    // Fetch the Gist from GitHub API
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Moltbook-Verify' }
    });

    if (!response.ok) {
      throw Object.assign(new Error('Could not fetch Gist. Make sure it is public.'), { status: 400 });
    }

    const gist = await response.json();

    // Check if any file in the Gist contains the token
    const files = Object.values(gist.files || {});
    const found = files.some(file => file.content && file.content.includes(tokenRow.token));

    if (!found) {
      throw Object.assign(new Error('Verification token not found in Gist. Make sure you pasted the exact token.'), { status: 400 });
    }

    // Mark token as used
    await query(
      'UPDATE verification_tokens SET used = true WHERE user_id = $1 AND type = $2',
      [userId, 'github']
    );

    // Save verification
    await query(
      `INSERT INTO verifications (user_id, type, metadata)
       VALUES ($1, 'github', $2)
       ON CONFLICT (user_id, type) DO UPDATE SET verified_at = NOW(), metadata = $2`,
      [userId, JSON.stringify({ github_username: githubUsername, gist_id: gistId })]
    );

    // Update user
    await query(
      'UPDATE users SET github_verified = true, github_username = $2 WHERE id = $1',
      [userId, githubUsername]
    );

    return { githubUsername, gistId };
  }

  /**
   * Verify Telegram - called from bot webhook when user sends /verify [token]
   */
  static async verifyTelegram(telegramUserId, telegramUsername, token) {
    const tokenRow = await queryOne(
      `SELECT user_id FROM verification_tokens 
       WHERE token = $1 AND type = 'telegram' AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (!tokenRow) {
      throw Object.assign(new Error('Invalid or expired token'), { status: 400 });
    }

    // Mark token as used
    await query(
      'UPDATE verification_tokens SET used = true WHERE token = $1',
      [token]
    );

    // Save verification
    await query(
      `INSERT INTO verifications (user_id, type, metadata)
       VALUES ($1, 'telegram', $2)
       ON CONFLICT (user_id, type) DO UPDATE SET verified_at = NOW(), metadata = $2`,
      [tokenRow.user_id, JSON.stringify({ telegram_user_id: telegramUserId, telegram_username: telegramUsername })]
    );

    // Update user
    await query(
      'UPDATE users SET telegram_verified = true, telegram_user_id = $2 WHERE id = $1',
      [tokenRow.user_id, telegramUserId]
    );

    // Also create/update telegram_links for bot functionality
    await query(
      `INSERT INTO telegram_links (telegram_user_id, telegram_username, user_id, chat_id)
       VALUES ($1, $2, $3, $1)
       ON CONFLICT (telegram_user_id) DO UPDATE SET user_id = $3, updated_at = NOW()`,
      [telegramUserId, telegramUsername || '', tokenRow.user_id]
    );

    return { userId: tokenRow.user_id };
  }

  /**
   * Get verification status for a user
   */
  static async getStatus(userId) {
    const user = await queryOne(
      'SELECT github_verified, telegram_verified, github_username, telegram_user_id FROM users WHERE id = $1',
      [userId]
    );

    return {
      github: { verified: user?.github_verified || false, username: user?.github_username || null },
      telegram: { verified: user?.telegram_verified || false, userId: user?.telegram_user_id || null },
    };
  }

  /**
   * Disconnect a verification
   */
  static async disconnect(userId, type) {
    await query('DELETE FROM verifications WHERE user_id = $1 AND type = $2', [userId, type]);
    
    if (type === 'github') {
      await query('UPDATE users SET github_verified = false, github_username = NULL WHERE id = $1', [userId]);
    } else if (type === 'telegram') {
      await query('UPDATE users SET telegram_verified = false, telegram_user_id = NULL WHERE id = $1', [userId]);
      await query('DELETE FROM telegram_links WHERE user_id = $1', [userId]);
    }
  }
}

module.exports = VerificationService;
