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

// Models endpoint
app.get('/models', asyncHandler(async (req, res) => {
  await rateLimiter.consume(req.ip);
  
  // Comprehensive model list
  const models = {
    openai: [
      {
        id: 'gpt-5-nano',
        name: 'GPT-5 Nano',
        description: 'Compact and efficient GPT-5 model for basic tasks',
        capabilities: ['text', 'function-calling'],
        context_window: 128000,
        max_tokens: 4096,
        provider: 'openai'
      },
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        description: 'Balanced GPT-5 model for everyday tasks',
        capabilities: ['text', 'function-calling', 'code-generation'],
        context_window: 128000,
        max_tokens: 8192,
        provider: 'openai'
      },
      {
        id: 'gpt-5-chat-latest',
        name: 'GPT-5 Chat Latest',
        description: 'Latest GPT-5 model optimized for conversations',
        capabilities: ['text', 'function-calling', 'code-generation', 'analysis'],
        context_window: 128000,
        max_tokens: 16384,
        provider: 'openai'
      },
      {
        id: 'gpt-5',
        name: 'GPT-5',
        description: 'Standard GPT-5 model with advanced capabilities',
        capabilities: ['text', 'function-calling', 'code-generation', 'analysis'],
        context_window: 128000,
        max_tokens: 16384,
        provider: 'openai'
      },
      {
        id: 'gpt-5.1-Codex',
        name: 'GPT-5.1 Codex',
        description: 'GPT-5.1 model specialized for code generation and programming',
        capabilities: ['text', 'code-generation', 'function-calling', 'analysis'],
        context_window: 128000,
        max_tokens: 16384,
        provider: 'openai'
      },
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        description: 'Refined GPT-4 model with improved performance',
        capabilities: ['text', 'function-calling', 'code-generation', 'analysis'],
        context_window: 128000,
        max_tokens: 8192,
        provider: 'openai'
      },
      {
        id: 'o3-deep-research',
        name: 'O3 Deep Research',
        description: 'Advanced reasoning model for deep research and complex analysis',
        capabilities: ['text', 'analysis', 'reasoning'],
        context_window: 128000,
        max_tokens: 32768,
        provider: 'openai'
      },
      {
        id: 'gpt-image-1',
        name: 'GPT Image 1',
        description: 'GPT model specialized for image generation and understanding',
        capabilities: ['vision', 'text', 'analysis'],
        context_window: 128000,
        max_tokens: 4096,
        provider: 'openai'
      }
    ],
    xai: [
      { id: 'grok-4-fast-non-reasoning', name: 'Grok-4 Fast (Non-Reasoning)', provider: 'xai' },
      { id: 'grok-4-fast-reasoning', name: 'Grok-4 Fast (Reasoning)', provider: 'xai' },
      { id: 'grok-4-1-fast-non-reasoning', name: 'Grok-4.1 Fast (Non-Reasoning)', provider: 'xai' },
      { id: 'grok-4-1-fast-reasoning', name: 'Grok-4.1 Fast (Reasoning)', provider: 'xai' },
      { id: 'grok-code-fast-1', name: 'Grok Code Fast', provider: 'xai' },
      { id: 'grok-4', name: 'Grok-4', provider: 'xai' }
    ],
    anthropic: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' }
    ],
    google: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google' },
      { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'google' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'google' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
      { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'google' }
    ]
  };

  res.status(200).json({
    models,
    total: Object.values(models).flat().length,
    timestamp: new Date().toISOString()
  });
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
