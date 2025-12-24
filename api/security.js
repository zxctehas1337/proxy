const crypto = require('crypto');

const SECURITY_CONFIG = {
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',').map(origin => origin.trim()),
  maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE) || 10 * 1024 * 1024, // 10MB
  apiKeyValidation: process.env.API_KEY_VALIDATION === 'true',
  logRequests: process.env.LOG_REQUESTS === 'true',
};

function validateOrigin(req) {
  const origin = req.headers.origin;
  if (SECURITY_CONFIG.allowedOrigins.includes('*') || 
      SECURITY_CONFIG.allowedOrigins.includes(origin)) {
    return true;
  }
  return false;
}

function validateApiKey(req) {
  if (!SECURITY_CONFIG.apiKeyValidation) {
    return true;
  }
  
  const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                 req.headers['x-api-key'];
  
  // Simple validation - in production, you'd want proper API key management
  return apiKey && apiKey.length >= 20;
}

function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  delete sanitized['authorization'];
  delete sanitized['x-api-key'];
  delete sanitized['cookie'];
  delete sanitized['set-cookie'];
  return sanitized;
}

function logRequest(req, statusCode, responseTime) {
  if (SECURITY_CONFIG.logRequests) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      statusCode,
      responseTime,
      sanitizedHeaders: sanitizeHeaders(req.headers)
    }));
  }
}

function generateRequestId() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  SECURITY_CONFIG,
  validateOrigin,
  validateApiKey,
  sanitizeHeaders,
  logRequest,
  generateRequestId,
};
