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
const ADMIN_TELEGRAM_ID = 5538562889;

// --- Валидация initData от Telegram Mini App ---
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

// --- Каталог товаров ---
app.get("/api/products", (req, res) => {
  const products = db.prepare("SELECT * FROM products").all();
  res.json(products);
});

// ==================== АДМИН-ПАНЕЛЬ (РАБОТА С БАЗОЙ) ====================

// 1. Добавление товара в БД
app.post("/api/admin/products", (req, res) => {
  const { telegram_id, name, price, stock, category, image_url } = req.body;

  if (Number(telegram_id) !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: "Отказано в доступе" });
  }

  const info = db.prepare(`
    INSERT INTO products (name, price, stock, in_stock, category, image_url)
    VALUES (?, ?, ?, 1, ?, ?)
  `).run(name, price, stock || 1, category || 'godly', image_url || 'kaspi-qr.png');

  res.json({ id: info.lastInsertRowid, name, price, stock });
});

// 2. Изменение цены или количества товара в БД
app.patch("/api/admin/products/:id", (req, res) => {
  const { telegram_id, price, stock } = req.body;

  if (Number(telegram_id) !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: "Отказано в доступе" });
  }

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!product) return res.status(404).json({ error: "Товар не найден" });

  const newPrice = price !== undefined ? price : product.price;
  const newStock = stock !== undefined ? stock : product.stock;
  const inStock = newStock > 0 ? 1 : 0;

  db.prepare(`
    UPDATE products SET price = ?, stock = ?, in_stock = ? WHERE id = ?
  `).run(newPrice, newStock, inStock, req.params.id);

  res.json({ success: true });
});

// 3. Удаление товара из БД
app.delete("/api/admin/products/:id", (req, res) => {
  const { telegram_id } = req.body;

  if (Number(telegram_id) !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: "Отказано в доступе" });
  }

  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ==================== ЗАКАЗЫ И ВЫДАЧА ====================

// Создание заказа
app.post("/api/order", (req, res) => {
  const { telegram_id, telegram_username, roblox_nickname, items } = req.body;

  if (!roblox_nickname || !items || items.length === 0) {
    return res.status(400).json({ error: "invalid payload" });
  }

  const products = db.prepare("SELECT * FROM products").all();
  
  // 1. Проверяем остатки перед созданием заказа
  for (const item of items) {
    const p = products.find(p => p.id === item.product_id);
    if (!p || p.stock < item.qty) {
      return res.status(400).json({ error: `Товара "${p ? p.name : 'Товар'}" нет в таком количестве!` });
    }
  }

  const enrichedItems = items.map(i => {
    const p = products.find(p => p.id === i.product_id);
    return { name: p.name, price: p.price, qty: i.qty };
  });
  const total = enrichedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  // 2. Создаем заказ
  const info = db.prepare(`
    INSERT INTO orders (telegram_id, telegram_username, roblox_nickname, items_json, total_price)
    VALUES (?, ?, ?, ?, ?)
  `).run(telegram_id, telegram_username, roblox_nickname, JSON.stringify(enrichedItems), total);

  // 3. Списываем купленный товар и скрываем, если остаток 0
  for (const item of items) {
    db.prepare(`
      UPDATE products 
      SET stock = stock - ?, 
          in_stock = CASE WHEN (stock - ?) > 0 THEN 1 ELSE 0 END 
      WHERE id = ?
    `).run(item.qty, item.qty, item.product_id);
  }

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(info.lastInsertRowid);
  notifyAdminNewOrder(order, enrichedItems);

  res.json({ order_id: order.id });
});
// Статус заказа
app.get("/api/order/:id", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "not found" });
  res.json({ status: order.status, delivery_link: order.delivery_link });
});

// Заказы для Roblox-бота
app.get("/api/pending-deliveries", (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'approved'").all();
  res.json(orders.map(o => ({
    order_id: o.id,
    roblox_nickname: o.roblox_nickname,
    items: JSON.parse(o.items_json)
  })));
});

// Подтверждение выдачи от Roblox-бота
app.post("/api/mark-delivered/:id", (req, res) => {
  db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
