import express from "express";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import db from "./db.js";
import { notifyAdminNewOrder } from "./bot.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;

// --- Валидация initData от Telegram Mini App (важно для безопасности!) ---
// Без этого кто угодно сможет слать POST /api/order с любыми данными.
function validateInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    params.delete("hash");

    const dataCheckArr = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckArr).digest("hex");

    return computedHash === hash;
  } catch {
    return false;
  }
}

// --- Каталог ---
app.get("/api/products", (req, res) => {
  const products = db.prepare("SELECT * FROM products WHERE in_stock = 1").all();
  res.json(products);
});

// --- Создание заказа ---
app.post("/api/order", (req, res) => {
  const { telegram_id, telegram_username, roblox_nickname, items, init_data } = req.body;

  // В продакшене раскомментировать - обязательная проверка подлинности запроса из Mini App
  // if (!validateInitData(init_data)) {
  //   return res.status(403).json({ error: "invalid init data" });
  // }

  if (!roblox_nickname || !items || items.length === 0) {
    return res.status(400).json({ error: "invalid payload" });
  }

  const products = db.prepare("SELECT * FROM products").all();
  const enrichedItems = items.map(i => {
    const p = products.find(p => p.id === i.product_id);
    return { name: p.name, price: p.price, qty: i.qty };
  });
  const total = enrichedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  const info = db.prepare(`
    INSERT INTO orders (telegram_id, telegram_username, roblox_nickname, items_json, total_price)
    VALUES (?, ?, ?, ?, ?)
  `).run(telegram_id, telegram_username, roblox_nickname, JSON.stringify(enrichedItems), total);

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(info.lastInsertRowid);
  notifyAdminNewOrder(order, enrichedItems);

  res.json({ order_id: order.id });
});

// --- Статус заказа (Mini App опрашивает этот эндпоинт) ---
app.get("/api/order/:id", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "not found" });
  res.json({ status: order.status, delivery_link: order.delivery_link });
});

// --- Эндпоинт, который опрашивает Roblox-скрипт (см. roblox-integration/) ---
// Отдаёт заказы status='approved', ещё не выданные ('delivered')
app.get("/api/pending-deliveries", (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'approved'").all();
  res.json(orders.map(o => ({
    order_id: o.id,
    roblox_nickname: o.roblox_nickname,
    items: JSON.parse(o.items_json)
  })));
});

// --- Roblox-скрипт вызывает это после успешной выдачи предмета игроку ---
app.post("/api/mark-delivered/:id", (req, res) => {
  db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
