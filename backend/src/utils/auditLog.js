/**
 * Audit Logging Utility
 * Logs security-relevant events for monitoring and forensics
 */

const { queryOne } = require('../config/database');

const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical',
};

/**
 * Log an audit event to database (if table exists) and console
 */
async function auditLog(event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    level: details.level || LOG_LEVELS.INFO,
    userId: details.userId || null,
    agentId: details.agentId || null,
    ip: details.ip || null,
    userAgent: details.userAgent || null,
    metadata: details.metadata || {},
  };

  // Always log to console in structured format
  const logLine = `[AUDIT] ${entry.timestamp} ${entry.level.toUpperCase()} ${event}` +
    (entry.userId ? ` user=${entry.userId}` : '') +
    (entry.agentId ? ` agent=${entry.agentId}` : '') +
    (entry.ip ? ` ip=${entry.ip}` : '');
  
  if (entry.level === LOG_LEVELS.ERROR || entry.level === LOG_LEVELS.CRITICAL) {
    console.error(logLine, entry.metadata);
  } else if (entry.level === LOG_LEVELS.WARN) {
    console.warn(logLine, entry.metadata);
  } else {
    console.log(logLine);
  }

  // Try to persist to DB (non-blocking, don't fail if table doesn't exist)
  try {
    await queryOne(
      `INSERT INTO audit_logs (event, level, user_id, agent_id, ip, user_agent, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [event, entry.level, entry.userId, entry.agentId, entry.ip, entry.userAgent, JSON.stringify(entry.metadata)]
    );
  } catch (err) {
    // Table may not exist yet - that's OK, console log is the fallback
  }
}

/**
 * Create audit log middleware that logs every request
 */
function auditMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    // Only log mutations and auth failures
    if (req.method !== 'GET' || res.statusCode === 401 || res.statusCode === 403) {
      auditLog('http_request', {
        level: res.statusCode >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.INFO,
        userId: req.user?.id || null,
        agentId: req.agent?.id || null,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
        }
      });
    }
  });
  
  next();
}

module.exports = { auditLog, auditMiddleware, LOG_LEVELS };
