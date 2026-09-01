// Этот скрипт запускается отдельно на твоём сервере (не внутри Roblox).
// Он логинится под аккаунтом-раздатчиком и создаёт/выдаёт ссылку на приватный сервер
// для конкретного заказа. Позже эта ссылка сохраняется в БД как delivery_link.
//
// ВАЖНО: автоматизация аккаунта через сторонние библиотеки формально нарушает
// правила Roblox (риск блокировки аккаунта-раздатчика). Используй запасной
// аккаунт, не основной.

import noblox from "noblox.js";
import dotenv from "dotenv";
import db from "../backend/db.js";

dotenv.config();

const GAME_ID = process.env.ROBLOX_GAME_ID; // universeId твоей игры MM2-сервера

async function main() {
  await noblox.setCookie(process.env.ROBLOX_COOKIE);
  const me = await noblox.getCurrentUser();
  console.log(`Залогинен как: ${me.UserName}`);

  // Пример: раз в 15 сек проверяем approved-заказы без delivery_link и создаём приватный сервер
  setInterval(async () => {
    const orders = db.prepare(
      "SELECT * FROM orders WHERE status = 'approved' AND (delivery_link IS NULL OR delivery_link LIKE '%PENDING%')"
    ).all();

    for (const order of orders) {
      try {
        // noblox.js не имеет прямого метода создания private server link для всех игр -
        // на практике проще заранее создать один приватный сервер (VIP-server) в Studio
        // и просто выдавать его постоянную ссылку каждому покупателю.
        const staticPrivateServerLink = `https://www.roblox.com/games/${GAME_ID}/MM2?privateServerLinkCode=${process.env.STATIC_VIP_CODE}`;

        db.prepare("UPDATE orders SET delivery_link = ? WHERE id = ?")
          .run(staticPrivateServerLink, order.id);

        console.log(`Заказу #${order.id} выдана ссылка`);
      } catch (err) {
        console.error(`Ошибка при обработке заказа #${order.id}:`, err.message);
      }
    }
  }, 15000);
}

main();
