/**
 * Payment Service — Midtrans integration
 */

const crypto = require('crypto');
const { snap, coreApi, CREDIT_PACKAGES, midtransConfig } = require('../config/midtrans');
const { queryOne, queryAll, transaction } = require('../config/database');
const CreditService = require('./CreditService');

class PaymentService {
  /**
   * Generate a unique order ID
   */
  static generateOrderId(userId) {
    const ts = Date.now();
    const rand = crypto.randomBytes(4).toString('hex');
    return `MOLT-${userId}-${ts}-${rand}`;
  }

  /**
   * Create a Midtrans Snap transaction
   * @param {string} userId
   * @param {string} packageId - key from CREDIT_PACKAGES (e.g. 'starter')
   * @param {object} userInfo - { email, name } (optional)
   * @returns {{ orderId, snapToken, redirectUrl }}
   */
  static async createTransaction(userId, packageId, userInfo = {}) {
    const pkg = CREDIT_PACKAGES[packageId];
    if (!pkg) {
      throw Object.assign(new Error(`Invalid package: ${packageId}. Options: ${Object.keys(CREDIT_PACKAGES).join(', ')}`), { status: 400 });
    }

    const orderId = this.generateOrderId(userId);

    // Insert payment record (pending)
    await queryOne(
      `INSERT INTO payments (order_id, user_id, amount, credits_to_add, package_id, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [orderId, userId, pkg.priceIDR, pkg.credits, packageId]
    );

    // Build Midtrans Snap parameter
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: pkg.priceIDR,
      },
      item_details: [{
        id: packageId,
        price: pkg.priceIDR,
        quantity: 1,
        name: pkg.label,
      }],
      customer_details: {
        first_name: userInfo.name || `User ${userId}`,
        email: userInfo.email || undefined,
      },
      enabled_payments: [
        'bca_va', 'bni_va', 'bri_va', 'permata_va', 'other_va',
        'gopay', 'shopeepay',
      ],
    };

    const snapResponse = await snap.createTransaction(parameter);

    // Store snap token
    await queryOne(
      'UPDATE payments SET snap_token = $1 WHERE order_id = $2',
      [snapResponse.token, orderId]
    );

    return {
      orderId,
      snapToken: snapResponse.token,
      redirectUrl: snapResponse.redirect_url,
      package: pkg,
    };
  }

  /**
   * Handle Midtrans webhook notification
   * Verifies signature and updates payment + credits
   */
  static async handleNotification(notificationBody) {
    // Verify with Midtrans SDK (checks signature automatically)
    const statusResponse = await coreApi.transaction.notification(notificationBody);

    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    // Verify signature manually as extra check
    const serverKey = midtransConfig.serverKey;
    const signatureKey = statusResponse.signature_key;
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${orderId}${statusResponse.status_code}${statusResponse.gross_amount}${serverKey}`)
      .digest('hex');

    if (signatureKey !== expectedSignature) {
      throw Object.assign(new Error('Invalid signature'), { status: 403 });
    }

    // Get payment record
    const payment = await queryOne('SELECT * FROM payments WHERE order_id = $1', [orderId]);
    if (!payment) {
      throw Object.assign(new Error(`Payment not found: ${orderId}`), { status: 404 });
    }

    // Already settled — idempotent
    if (payment.status === 'settlement' || payment.status === 'capture') {
      return { orderId, status: payment.status, message: 'Already processed' };
    }

    let newStatus;
    let shouldAddCredits = false;

    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      if (fraudStatus === 'accept' || !fraudStatus) {
        newStatus = 'settlement';
        shouldAddCredits = true;
      } else {
        newStatus = 'fraud';
      }
    } else if (transactionStatus === 'pending') {
      newStatus = 'pending';
    } else if (['deny', 'cancel', 'expire'].includes(transactionStatus)) {
      newStatus = transactionStatus;
    } else {
      newStatus = transactionStatus;
    }

    // Update payment status
    await queryOne(
      `UPDATE payments SET status = $1, payment_type = $2, midtrans_response = $3, updated_at = NOW()
       WHERE order_id = $4`,
      [newStatus, statusResponse.payment_type || null, JSON.stringify(statusResponse), orderId]
    );

    // Add credits if payment succeeded
    if (shouldAddCredits && !payment.credits_added) {
      await transaction(async (client) => {
        // Mark credits as added (prevent double credit)
        await client.query(
          'UPDATE payments SET credits_added = true, updated_at = NOW() WHERE order_id = $1 AND credits_added = false',
          [orderId]
        );

        // Use CreditService topup
        await CreditService.topup(payment.user_id, payment.credits_to_add, {
          payment_order_id: orderId,
          payment_type: statusResponse.payment_type,
        });
      });
    }

    return { orderId, status: newStatus, creditsAdded: shouldAddCredits ? payment.credits_to_add : 0 };
  }

  /**
   * Check payment status from Midtrans
   */
  static async checkStatus(orderId) {
    const payment = await queryOne('SELECT * FROM payments WHERE order_id = $1', [orderId]);
    if (!payment) {
      throw Object.assign(new Error('Payment not found'), { status: 404 });
    }

    // Also fetch live status from Midtrans
    let midtransStatus = null;
    try {
      midtransStatus = await coreApi.transaction.status(orderId);
    } catch (e) {
      // May fail if transaction hasn't been initiated at Midtrans yet
      midtransStatus = null;
    }

    return {
      orderId: payment.order_id,
      userId: payment.user_id,
      amount: payment.amount,
      credits: payment.credits_to_add,
      package: payment.package_id,
      status: payment.status,
      creditsAdded: payment.credits_added,
      paymentType: payment.payment_type,
      createdAt: payment.created_at,
      midtransStatus: midtransStatus ? midtransStatus.transaction_status : null,
    };
  }

  /**
   * Get payment history for a user
   */
  static async getUserPayments(userId, limit = 20, offset = 0) {
    return queryAll(
      `SELECT order_id, amount, credits_to_add, package_id, status, payment_type, credits_added, created_at
       FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
  }
}

module.exports = PaymentService;
