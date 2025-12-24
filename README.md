# AI Proxy Server

Прокси-сервер для обхода региональных ограничений AI моделей, развернутый на Vercel.

## Возможности

- Проксирование запросов к OpenAI API
- Проксирование запросов к Anthropic Claude API
- Rate limiting для защиты от злоупотреблений
- CORS поддержка для работы с веб-приложениями
- Безопасная обработка API ключей

## Развертывание

1. Установите Vercel CLI:
\`\`\`bash
npm i -g vercel
\`\`\`

2. Настройте переменные окружения в Vercel:
\`\`\`bash
vercel env add OPENAI_API_KEY
vercel env add ANTHROPIC_API_KEY
\`\`\`

3. Разверните проект:
\`\`\`bash
vercel --prod
\`\`\`

## Использование

### OpenAI API
\`\`\`javascript
const response = await fetch('https://your-vercel-domain.vercel.app/api/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});
\`\`\`

### Anthropic API
\`\`\`javascript
const response = await fetch('https://your-vercel-domain.vercel.app/api/anthropic/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});
\`\`\`

## Безопасность

- API ключи хранятся в переменных окружения Vercel
- Rate limiting предотвращает злоупотребления
- CORS ограничения настраиваются через переменные окружения
- Все запросы логируются для мониторинга

## Лицензия

MIT
# proxy
# proxy
# proxy
