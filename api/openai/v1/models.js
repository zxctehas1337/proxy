const rateLimiter = require('../../rate-limiter');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  try {
    await rateLimiter.consume(req.ip);
  } catch (rejRes) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': req.headers.authorization || `Bearer ${process.env.OPENAI_API_KEY}`,
        'User-Agent': 'AI-Proxy/1.0',
      },
    });

    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(response.status).json(data);
  } catch (error) {
    console.error('OpenAI models proxy error:', error);
    res.status(500).json({ error: 'Proxy server error' });
  }
};
