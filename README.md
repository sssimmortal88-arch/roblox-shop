# MM2 Shop — Telegram Mini App

## Структура проекта
```
frontend/               — Mini App (HTML/JS), открывается внутри Telegram
  index.html
  style.css
  app.js
backend/                — Node.js/Express API + SQLite + бот админа
  server.js
  db.js
  bot.js
  package.json
roblox-integration/     — доставка предметов
  DeliveryScript.server.lua   — кладётся в игру MM2 (Roblox Studio → ServerScriptService)
  inviteBot.js                — опционально, автоматизация выдачи ссылок через noblox.js
```

## Технологический стек
- **Frontend**: чистый HTML/CSS/JS + `Telegram.WebApp` SDK (без сборщика, чтобы проще было захостить статику)
- **Backend**: Node.js + Express + better-sqlite3 (легко перейти на PostgreSQL при росте)
- **Бот**: node-telegram-bot-api (уведомления + inline-кнопки подтверждения оплаты)
- **Доставка предметов**: Lua-скрипт внутри самой игры MM2, который опрашивает backend
- **Оплата**: статичный Kaspi QR / реквизиты + ручное подтверждение админом (готовых KZT-эквайрингов с открытым API мало; альтернативы — Kaspi Pay for Business API, если есть ИП/юрлицо)

## Как запустить

### 1. Backend
```bash
cd backend
npm install
echo "BOT_TOKEN=твой_токен_бота" >> .env
echo "ADMIN_CHAT_ID=твой_telegram_id" >> .env
npm start
```

### 2. Регистрация Mini App в Telegram
1. Напиши @BotFather → `/newapp` → выбери своего бота.
2. Укажи URL, где захостишь `frontend/` (Vercel/Netlify/твой сервер, обязательно HTTPS).
3. В `frontend/app.js` пропиши реальный `API_BASE`.

### 3. Roblox-доставка
1. В Roblox Studio открой свою игру MM2 (или создай отдельный "выдачный" сервер).
2. Вставь `DeliveryScript.server.lua` в `ServerScriptService`.
3. Настрой `ITEM_TOOLS` — соответствие названия товара инструменту/питомцу в игре.
4. Включи HttpService: `game:GetService("HttpService").HttpEnabled = true`.

### 4. (Опционально) Автоматизация приглашений через noblox.js
```bash
cd roblox-integration
npm install noblox.js dotenv
echo "ROBLOX_COOKIE=..." >> .env
echo "ROBLOX_GAME_ID=..." >> .env
echo "STATIC_VIP_CODE=..." >> .env
node inviteBot.js
```
⚠️ Используй запасной Roblox-аккаунт для раздачи — автоматизация действий аккаунта через сторонние библиотеки формально противоречит правилам Roblox, есть риск блокировки этого аккаунта (не основного).

## Поток заказа (end-to-end)
1. Покупатель открывает Mini App → выбирает товары → корзина.
2. Указывает ник Roblox → видит Kaspi QR/реквизиты → жмёт "Я оплатил".
3. Backend создаёт заказ (status=`pending`) и шлёт тебе карточку в Telegram с кнопками ✅/❌.
4. Ты сверяешь платёж в Kaspi вручную → жмёшь ✅.
5. Заказ переходит в `approved`, покупателю в Mini App становится доступна ссылка на приватный сервер.
6. Игровой скрипт видит игрока на сервере с нужным ником → выдаёт предмет → помечает заказ `delivered`.

## Что стоит доработать перед продакшеном
- Включить проверку `validateInitData()` в `server.js` (сейчас закомментирована для удобства тестов) — без неё заказы можно подделывать.
- Добавить рейт-лимит на `/api/order`, чтобы не заспамили.
- Хранить `items_json` заказа отдельной таблицей `order_items`, если нужна аналитика по продажам.
- Логи/бэкапы SQLite-файла `shop.db`.
