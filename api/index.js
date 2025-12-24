const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 100,
  duration: 60,
});

const PROXY_TARGETS = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://api.gemini.com',
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    return res.status(200).end();
  }

  try {
    await rateLimiter.consume(req.ip);
  } catch (rejRes) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { provider } = req.query;
  const targetBase = PROXY_TARGETS[provider];

  if (!targetBase) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  const targetUrl = `${targetBase}${req.url.replace(`/api/${provider}`, '')}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
        'X-API-Key': req.headers['x-api-key'] || '',
        'User-Agent': 'AI-Proxy/1.0',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy server error' });
  }
};
