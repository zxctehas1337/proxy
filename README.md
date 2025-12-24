# AI Proxy Server

Прокси-сервер для обхода региональных ограничений AI моделей, развернутый на Railway.

## Возможности

- Проксирование запросов к OpenAI API
- Rate limiting для защиты от злоупотреблений
- CORS поддержка для работы с веб-приложениями
- Безопасная обработка API ключей
- Health check эндпоинт
- Логирование запросов

## Развертывание на Railway

### 1. Установка Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Настройка проекта
```bash
railway login
railway init
railway up
```

### 3. Настройка переменных окружения
```bash
railway variables set OPENAI_API_KEY=your_openai_api_key
railway variables set NODE_ENV=production
railway variables set ALLOWED_ORIGINS=http://localhost:3000
```

## Использование

### OpenAI API
```javascript
const response = await fetch('https://your-domain.railway.app/openai/v1/chat/completions', {
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
```

### Health Check
```bash
curl https://your-domain.railway.app/health
```

## Структура проекта

- `server.js` - основной Express сервер
- `api/security.js` - модуль безопасности
- `api/error-handler.js` - обработка ошибок
- `railway.json` - конфигурация Railway
- `.env.example` - пример переменных окружения

## Безопасность

- API ключи хранятся в переменных окружения Railway
- Rate limiting предотвращает злоупотребления
- CORS ограничения настраиваются через переменные окружения
- Валидация API ключей

## Лицензия

MIT
