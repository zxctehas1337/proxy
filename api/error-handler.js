class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class ValidationError extends APIError {
  constructor(message = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class ProxyError extends APIError {
  constructor(message = 'Proxy error', originalError = null) {
    super(message, 502, 'PROXY_ERROR');
    this.originalError = originalError;
  }
}

function errorHandler(error, req, res, next) {
  const requestId = req.requestId || 'unknown';
  
  // Log the error
  console.error(JSON.stringify({
    requestId,
    error: {
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
      statusCode: error.statusCode || 500,
      timestamp: error.timestamp || new Date().toISOString(),
      stack: error.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }
  }));

  // Send error response
  const response = {
    error: {
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
      requestId,
      timestamp: error.timestamp || new Date().toISOString(),
    }
  };

  // Include additional details in development
  if (process.env.NODE_ENV === 'development') {
    response.error.details = {
      stack: error.stack,
      originalError: error.originalError,
    };
  }

  res.status(error.statusCode || 500).json(response);
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  APIError,
  RateLimitError,
  AuthenticationError,
  ValidationError,
  ProxyError,
  errorHandler,
  asyncHandler,
};
