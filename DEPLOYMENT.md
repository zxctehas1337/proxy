# Развертывание прокси-сервера на Vercel

## 1. Подготовка

Установите Vercel CLI:
```bash
npm i -g vercel
```

## 2. Настройка переменных окружения

Добавьте переменные окружения в Vercel:

```bash
vercel env add OPENAI_API_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add PROXY_ENABLED
vercel env add ALLOWED_ORIGINS
vercel env add RATE_LIMIT_POINTS
vercel env add RATE_LIMIT_DURATION
```

### Переменные окружения:

- `OPENAI_API_KEY`: Ваш OpenAI API ключ
- `ANTHROPIC_API_KEY`: Ваш Anthropic API ключ  
- `PROXY_ENABLED`: Включить прокси (true/false)
- `ALLOWED_ORIGINS`: Разрешенные домены через запятую (например: `http://localhost:3000,https://your-ide-domain.com`)
- `RATE_LIMIT_POINTS`: Лимит запросов (по умолчанию: 100)
- `RATE_LIMIT_DURATION`: Период лимита в секундах (по умолчанию: 60)
- `LOG_REQUESTS`: Включить логирование запросов (true/false)
- `API_KEY_VALIDATION`: Включить валидацию API ключей (true/false)

## 3. Развертывание

Разверните проект:
```bash
vercel --prod
```

## 4. Настройка IDE

В IDE установите переменные окружения:

```bash
export PROXY_ENABLED=true
export PROXY_BASE_URL=https://your-vercel-domain.vercel.app/api
```

Или добавьте их в `.env` файл в корне проекта:

```env
PROXY_ENABLED=true
PROXY_BASE_URL=https://your-vercel-domain.vercel.app/api
```

## 5. Проверка работы

Проверьте здоровье прокси:
```bash
curl https://your-vercel-domain.vercel.app/api/health
```

Проверьте работу с OpenAI:
```bash
curl -X POST https://your-vercel-domain.vercel.app/api/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## 6. Мониторинг

- Просматривайте логи в панели Vercel
- Мониторьте использование API ключей
- Следите за лимитами запросов

## Безопасность

- API ключи хранятся только в переменных окружения Vercel
- Включите валидацию API ключей
- Ограничьте разрешенные домены
- Настройте rate limiting
- Регулярно проверяйте логи запросов
