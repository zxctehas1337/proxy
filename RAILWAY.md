# Развертывание прокси-сервера на Railway

## 1. Подготовка

Установите Railway CLI:
```bash
npm install -g @railway/cli
```

## 2. Настройка проекта

В корне проекта выполните:
```bash
railway login
railway init
```

## 3. Настройка переменных окружения

Добавьте переменные окружения в Railway:

```bash
railway variables set OPENAI_API_KEY=your_openai_api_key
railway variables set ANTHROPIC_API_KEY=your_anthropic_api_key
railway variables set NODE_ENV=production
railway variables set ALLOWED_ORIGINS=http://localhost:3000,https://your-ide-domain.com
railway variables set RATE_LIMIT_POINTS=100
railway variables set RATE_LIMIT_DURATION=60
railway variables set API_KEY_VALIDATION=true
railway variables set LOG_REQUESTS=true
```

## 4. Развертывание

Разверните проект:
```bash
railway up
```

## 5. Получение URL

После развертывания получите URL вашего прокси:
```bash
railway domains
```

## 6. Настройка IDE

В IDE установите переменные окружения:

```bash
export PROXY_ENABLED=true
export PROXY_BASE_URL=https://your-railway-domain.railway.app
```

Или добавьте их в `.env` файл в корне проекта:

```env
PROXY_ENABLED=true
PROXY_BASE_URL=https://your-railway-domain.railway.app
```

## 7. Проверка работы

Проверьте здоровье прокси:
```bash
curl https://your-railway-domain.railway.app/health
```

Проверьте работу с OpenAI:
```bash
curl -X POST https://your-railway-domain.railway.app/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## 8. Мониторинг

- Просматривайте логи: `railway logs`
- Мониторьте метрики в панели Railway
- Проверяйте использование API ключей
- Следите за лимитами запросов

## Преимущества Railway

- Постоянный IP адрес
- Автоматическое масштабирование
- Бесплатный SSL
- Простая настройка переменных окружения
- Интеграция с GitHub
- Мониторинг и логирование

## Безопасность

- API ключи хранятся только в переменных окружения Railway
- Включена валидация API ключей
- Настроены CORS ограничения
- Rate limiting защищает от злоупотреблений
- Все запросы логируются для мониторинга

## Структура URL

```
https://your-domain.railway.app/openai/v1/chat/completions
https://your-domain.railway.app/openai/v1/models
https://your-domain.railway.app/health
```
