/**
 * User Service - registration & auth
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/database');
const config = require('../config');
const CreditService = require('./CreditService');

class UserService {
  static async register(email, password, name) {
    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      throw Object.assign(new Error('Email already registered'), { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await queryOne(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role, created_at`,
      [email, passwordHash, name || null]
    );

    // Initialize credits with 100 free credits
    await CreditService.initialize(user.id, 100);

    return user;
  }

  static async login(email, password) {
    const user = await queryOne(
      'SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = $1',
      [email]
    );

    if (!user || !user.is_active) {
      throw Object.assign(new Error('Invalid email or password'), { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw Object.assign(new Error('Invalid email or password'), { status: 401 });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    };
  }

  static async getById(userId) {
    return queryOne(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );
  }
}

module.exports = UserService;
