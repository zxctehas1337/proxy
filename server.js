require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { validateOrigin, validateApiKey, logRequest, generateRequestId } = require('./api/security');
const { errorHandler, asyncHandler, ProxyError } = require('./api/error-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: parseInt(process.env.RATE_LIMIT_POINTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_DURATION) || 60,
});

// Middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: (origin, callback) => {
    if (validateOrigin({ headers: { origin } })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Request logging middleware
app.use((req, res, next) => {
  req.requestId = generateRequestId();
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logRequest(req, res.statusCode, responseTime);
  });
  
  next();
});

// Health check
app.get('/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };

  try {
    // Test connectivity to OpenAI
    const openaiTest = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }).catch(() => null);

    health.services = {
      openai: openaiTest ? 'available' : 'unreachable',
    };

    res.status(200).json(health);
  } catch (error) {
    health.status = 'unhealthy';
    health.error = error.message;
    res.status(503).json(health);
  }
}));

// OpenAI proxy routes
app.all('/openai/v1/chat/completions', asyncHandler(async (req, res) => {
  await rateLimiter.consume(req.ip);
  
  if (!validateApiKey(req)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.authorization || `Bearer ${process.env.OPENAI_API_KEY}`,
      'User-Agent': 'AI-Proxy/1.0',
    },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  });

  const data = await response.json();
  res.status(response.status).json(data);
}));

app.all('/openai/v1/models', asyncHandler(async (req, res) => {
  await rateLimiter.consume(req.ip);
  
  if (!validateApiKey(req)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': req.headers.authorization || `Bearer ${process.env.OPENAI_API_KEY}`,
      'User-Agent': 'AI-Proxy/1.0',
    },
  });

  const data = await response.json();
  res.status(response.status).json(data);
}));

// Generic proxy for other OpenAI endpoints
app.all('/openai/*', asyncHandler(async (req, res) => {
  await rateLimiter.consume(req.ip);
  
  if (!validateApiKey(req)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const targetUrl = `https://api.openai.com${req.originalUrl.replace('/openai', '')}`;
  
  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.authorization || `Bearer ${process.env.OPENAI_API_KEY}`,
      'User-Agent': 'AI-Proxy/1.0',
    },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  });

  const data = await response.json();
  res.status(response.status).json(data);
}));

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    }
  });
});

app.listen(PORT, () => {
  console.log(`AI Proxy Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
