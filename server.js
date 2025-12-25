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
  
  // Comprehensive model list - OpenAI models sorted from cheapest to most expensive
  const models = {
    openai: [
      // GPT-4.1 series (cheapest)
      {
        id: 'gpt-4.1-nano',
        name: 'GPT-4.1 Nano',
        description: 'Самая быстрая и дешевая модель GPT-4.1 для простых задач',
        capabilities: ['text', 'function-calling'],
        context_window: 1047576,
        max_tokens: 32768,
        provider: 'openai',
        pricing: { input: 0.10, output: 0.40 }
      },
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
        description: 'Сбалансированная модель GPT-4.1 для повседневных задач',
        capabilities: ['text', 'function-calling', 'code-generation'],
        context_window: 1047576,
        max_tokens: 32768,
        provider: 'openai',
        pricing: { input: 0.40, output: 1.60 }
      },
      // GPT-4o Mini
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Компактная и быстрая версия GPT-4o',
        capabilities: ['text', 'vision', 'function-calling', 'code-generation'],
        context_window: 128000,
        max_tokens: 16384,
        provider: 'openai',
        pricing: { input: 0.15, output: 0.60 }
      },
      // o3-mini (reasoning, budget)
      {
        id: 'o3-mini',
        name: 'O3 Mini',
        description: 'Бюджетная reasoning модель для логических задач',
        capabilities: ['text', 'reasoning', 'code-generation'],
        context_window: 200000,
        max_tokens: 100000,
        provider: 'openai',
        pricing: { input: 1.10, output: 4.40 }
      },
      // o4-mini (latest reasoning mini)
      {
        id: 'o4-mini',
        name: 'O4 Mini',
        description: 'Новейшая компактная reasoning модель',
        capabilities: ['text', 'reasoning', 'code-generation', 'analysis'],
        context_window: 200000,
        max_tokens: 100000,
        provider: 'openai',
        pricing: { input: 1.10, output: 4.40 }
      },
      // GPT-4o
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Флагманская мультимодальная модель OpenAI',
        capabilities: ['text', 'vision', 'function-calling', 'code-generation', 'analysis'],
        context_window: 128000,
        max_tokens: 16384,
        provider: 'openai',
        pricing: { input: 2.50, output: 10.00 }
      },
      {
        id: 'chatgpt-4o-latest',
        name: 'ChatGPT-4o Latest',
        description: 'Последняя версия GPT-4o для ChatGPT',
        capabilities: ['text', 'vision', 'function-calling', 'code-generation', 'analysis'],
        context_window: 128000,
        max_tokens: 16384,
        provider: 'openai',
        pricing: { input: 2.50, output: 10.00 }
      },
      // GPT-4.1 (standard)
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        description: 'Улучшенная версия GPT-4 с расширенным контекстом',
        capabilities: ['text', 'function-calling', 'code-generation', 'analysis'],
        context_window: 1047576,
        max_tokens: 32768,
        provider: 'openai',
        pricing: { input: 2.00, output: 8.00 }
      },
      // o1 series
      {
        id: 'o1-mini',
        name: 'O1 Mini',
        description: 'Компактная reasoning модель для STEM задач',
        capabilities: ['text', 'reasoning', 'code-generation'],
        context_window: 128000,
        max_tokens: 65536,
        provider: 'openai',
        pricing: { input: 1.10, output: 4.40 }
      },
      {
        id: 'o1',
        name: 'O1',
        description: 'Продвинутая reasoning модель для сложных задач',
        capabilities: ['text', 'reasoning', 'code-generation', 'analysis'],
        context_window: 200000,
        max_tokens: 100000,
        provider: 'openai',
        pricing: { input: 15.00, output: 60.00 }
      },
      {
        id: 'o1-pro',
        name: 'O1 Pro',
        description: 'Профессиональная версия O1 с улучшенным reasoning',
        capabilities: ['text', 'reasoning', 'code-generation', 'analysis'],
        context_window: 200000,
        max_tokens: 100000,
        provider: 'openai',
        pricing: { input: 150.00, output: 600.00 }
      },
      // o3 series
      {
        id: 'o3',
        name: 'O3',
        description: 'Новейшая reasoning модель с улучшенными возможностями',
        capabilities: ['text', 'reasoning', 'code-generation', 'analysis'],
        context_window: 200000,
        max_tokens: 100000,
        provider: 'openai',
        pricing: { input: 10.00, output: 40.00 }
      },
      {
        id: 'o3-pro',
        name: 'O3 Pro',
        description: 'Профессиональная версия O3 для сложнейших задач',
        capabilities: ['text', 'reasoning', 'code-generation', 'analysis'],
        context_window: 200000,
        max_tokens: 100000,
        provider: 'openai',
        pricing: { input: 20.00, output: 80.00 }
      },
      // GPT-4.5 Preview
      {
        id: 'gpt-4.5-preview',
        name: 'GPT-4.5 Preview',
        description: 'Превью следующего поколения GPT с улучшенным EQ',
        capabilities: ['text', 'vision', 'function-calling', 'code-generation', 'analysis'],
        context_window: 128000,
        max_tokens: 16384,
        provider: 'openai',
        pricing: { input: 75.00, output: 150.00 }
      },
      // GPT-5 series (newest)
      {
        id: 'gpt-5',
        name: 'GPT-5',
        description: 'Новейшая флагманская модель OpenAI',
        capabilities: ['text', 'vision', 'function-calling', 'code-generation', 'analysis', 'reasoning'],
        context_window: 256000,
        max_tokens: 32768,
        provider: 'openai',
        pricing: { input: 10.00, output: 30.00 }
      },
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        description: 'Компактная версия GPT-5',
        capabilities: ['text', 'vision', 'function-calling', 'code-generation'],
        context_window: 256000,
        max_tokens: 16384,
        provider: 'openai',
        pricing: { input: 1.50, output: 6.00 }
      },
      // GPT-5.2 series (latest)
      {
        id: 'gpt-5.2-mini',
        name: 'GPT-5.2 Mini',
        description: 'Компактная версия GPT-5.2 для быстрых задач',
        capabilities: ['text', 'vision', 'function-calling', 'code-generation'],
        context_window: 256000,
        max_tokens: 16384,
        provider: 'openai',
        pricing: { input: 2.00, output: 8.00 }
      },
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        description: 'Последняя версия GPT-5 с улучшенными возможностями',
        capabilities: ['text', 'vision', 'function-calling', 'code-generation', 'analysis', 'reasoning'],
        context_window: 256000,
        max_tokens: 32768,
        provider: 'openai',
        pricing: { input: 12.00, output: 36.00 }
      },
      {
        id: 'gpt-5.2-pro',
        name: 'GPT-5.2 Pro',
        description: 'Профессиональная версия GPT-5.2 для сложных задач',
        capabilities: ['text', 'vision', 'function-calling', 'code-generation', 'analysis', 'reasoning'],
        context_window: 512000,
        max_tokens: 65536,
        provider: 'openai',
        pricing: { input: 25.00, output: 75.00 }
      },
      // Codex models
      {
        id: 'codex-mini',
        name: 'Codex Mini',
        description: 'Компактная модель для генерации кода',
        capabilities: ['text', 'code-generation', 'function-calling'],
        context_window: 192000,
        max_tokens: 65536,
        provider: 'openai',
        pricing: { input: 1.50, output: 6.00 }
      },
      // Image models
      {
        id: 'gpt-image-1',
        name: 'GPT Image 1',
        description: 'Модель для генерации и понимания изображений',
        capabilities: ['vision', 'image-generation'],
        context_window: 32000,
        max_tokens: 4096,
        provider: 'openai',
        pricing: { input: 5.00, output: 20.00 }
      },
      // Audio models
      {
        id: 'gpt-4o-audio-preview',
        name: 'GPT-4o Audio Preview',
        description: 'GPT-4o с поддержкой аудио ввода/вывода',
        capabilities: ['text', 'audio', 'function-calling'],
        context_window: 128000,
        max_tokens: 16384,
        provider: 'openai',
        pricing: { input: 2.50, output: 10.00 }
      },
      {
        id: 'gpt-4o-realtime-preview',
        name: 'GPT-4o Realtime Preview',
        description: 'GPT-4o для real-time приложений',
        capabilities: ['text', 'audio', 'function-calling', 'realtime'],
        context_window: 128000,
        max_tokens: 4096,
        provider: 'openai',
        pricing: { input: 5.00, output: 20.00 }
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
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'google' },
      { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'google' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'google' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', provider: 'google' }
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
