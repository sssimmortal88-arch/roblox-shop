import TelegramBot from "node-telegram-bot-api";
import db from "./db.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // твой telegram id / id админ-группы

export const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Отправить админу карточку нового заказа с кнопками
export function notifyAdminNewOrder(order, items) {
  const itemsText = items.map(i => `• ${i.name} x${i.qty} — ${i.price * i.qty} ₸`).join("\n");
  const text =
    `🆕 Новый заказ #${order.id}\n` +
    `Покупатель: @${order.telegram_username || "без username"} (id: ${order.telegram_id})\n` +
    `Roblox ник: ${order.roblox_nickname}\n\n` +
    `${itemsText}\n\n` +
    `Итого: ${order.total_price} ₸\n` +
    `Статус: ожидает подтверждения оплаты`;

  bot.sendMessage(ADMIN_CHAT_ID, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить оплату", callback_data: `approve_${order.id}` },
          { text: "❌ Отклонить", callback_data: `reject_${order.id}` }
        ]
      ]
    }
  });
}

// Обработка нажатий кнопок админом
bot.on("callback_query", async (query) => {
  const [action, orderId] = query.data.split("_");
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);

  if (!order) return bot.answerCallbackQuery(query.id, { text: "Заказ не найден" });

  if (action === "approve") {
    // Генерируем ссылку на приватный сервер (или заглушку - заполнит доставщик)
    const deliveryLink = `https://www.roblox.com/games/YOUR_GAME_ID/MM2?privateServerLinkCode=PENDING_${order.id}`;
    db.prepare("UPDATE orders SET status = 'approved', delivery_link = ? WHERE id = ?")
      .run(deliveryLink, order.id);

    bot.editMessageText(query.message.text + "\n\n✅ ОПЛАТА ПОДТВЕРЖДЕНА", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });

    // Если знаем telegram_id покупателя - можно написать ему напрямую
    if (order.telegram_id) {
      bot.sendMessage(order.telegram_id,
        `Оплата по заказу #${order.id} подтверждена! Открой Mini App и нажми "Проверить статус", чтобы получить ссылку на выдачу предметов.`
      );
    }
  }

  if (action === "reject") {
    db.prepare("UPDATE orders SET status = 'rejected' WHERE id = ?").run(order.id);
    bot.editMessageText(query.message.text + "\n\n❌ ОТКЛОНЕНО", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });
  }

  bot.answerCallbackQuery(query.id);
});
