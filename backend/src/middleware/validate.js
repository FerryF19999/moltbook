/**
 * Input Validation & Sanitization Middleware
 * Prevents XSS, SQL injection via input sanitization
 */

/**
 * Sanitize a string value - strip HTML tags and dangerous characters
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<[^>]*>/g, '')           // Strip HTML tags
    .replace(/[<>"'`;]/g, '')          // Remove dangerous chars
    .trim();
}

/**
 * Recursively sanitize all string values in an object
 */
function sanitizeObject(obj) {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}

/**
 * Middleware to sanitize request body
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Middleware to sanitize query params
 */
function sanitizeQuery(req, res, next) {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate that required fields exist and are non-empty strings
 */
function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => !req.body[f] || (typeof req.body[f] === 'string' && !req.body[f].trim()));
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }
    next();
  };
}

/**
 * Validate string length
 */
function maxLength(field, max) {
  return (req, res, next) => {
    if (req.body[field] && typeof req.body[field] === 'string' && req.body[field].length > max) {
      return res.status(400).json({
        success: false,
        error: `${field} must be ${max} characters or less`
      });
    }
    next();
  };
}

/**
 * Validate ID parameter is a valid UUID or integer
 */
function validateIdParam(req, res, next) {
  const { id } = req.params;
  if (id && !/^[0-9a-f-]{36}$|^\d+$/.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }
  next();
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeBody,
  sanitizeQuery,
  isValidEmail,
  requireFields,
  maxLength,
  validateIdParam
};
