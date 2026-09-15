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

// Массив со всеми ID администраторов
const ADMIN_TELEGRAM_IDS = [5538562889, 1325498689];

// Проверка прав администратора
function isAdmin(telegramId) {
  return ADMIN_TELEGRAM_IDS.includes(Number(telegramId));
}

// --- АВТОМАТИЧЕСКАЯ МИГРАЦИЯ И АВТО-ЗАПОЛНЕНИЕ БД ---
try {
  // 1. Создаем таблицу products, если ее еще нет
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL
    );
  `);

  // 2. Проверяем существующие колонки и добавляем недостающие
  const columns = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
  
  if (!columns.includes("stock")) db.exec("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 1");
  if (!columns.includes("in_stock")) db.exec("ALTER TABLE products ADD COLUMN in_stock INTEGER DEFAULT 1");
  if (!columns.includes("category")) db.exec("ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'godly'");
  if (!columns.includes("image_url")) db.exec("ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT 'kaspi-qr.png'");

  // 3. Авто-заполнение базовыми товарами, если база пустая после перезапуска
  const countObj = db.prepare("SELECT COUNT(*) as count FROM products").get();
  if (countObj && countObj.count === 0) {
    const insert = db.prepare(`
      INSERT INTO products (name, price, stock, in_stock, category, image_url)
      VALUES (?, ?, ?, 1, ?, ?)
    `);

    // Начальный ассортимент товаров
    insert.run("Ghostblade", 160, 10, "godly", "ghostblade.png");
    insert.run("Prismatic", 220, 5, "godly", "prismatic.webp");
    insert.run("Ice Dragon", 300, 3, "godly", "icedragon.webp");
    insert.run("Pumpking", 450, 2, "godly", "Pumpking.webp");

    console.log("Стартовые товары автоматически добавлены в базу данных!");
  }
} catch (e) {
  console.error("Ошибка при инициализации базы данных:", e);
}

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
  try {
    const products = db.prepare("SELECT * FROM products").all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== АДМИН-ПАНЕЛЬ (РАБОТА С БАЗОЙ) ====================

// 1. Добавление товара в БД
app.post("/api/admin/products", (req, res) => {
  try {
    const { telegram_id, name, price, stock, category, image_url } = req.body;

    if (!isAdmin(telegram_id)) {
      return res.status(403).json({ error: "Отказано в доступе" });
    }

    if (!name || price === undefined) {
      return res.status(400).json({ error: "Название и цена обязательны" });
    }

    const info = db.prepare(`
      INSERT INTO products (name, price, stock, in_stock, category, image_url)
      VALUES (?, ?, ?, 1, ?, ?)
    `).run(
      name, 
      Number(price), 
      Number(stock) || 1, 
      category || 'godly', 
      image_url || 'kaspi-qr.png'
    );

    res.json({ id: info.lastInsertRowid, name, price, stock });
  } catch (err) {
    console.error("Ошибка добавления товара:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Изменение цены или количества товара в БД (поддержка PUT и PATCH)
const updateProductHandler = (req, res) => {
  try {
    const { telegram_id, price, stock } = req.body;

    if (!isAdmin(telegram_id)) {
      return res.status(403).json({ error: "Отказано в доступе" });
    }

    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (!product) return res.status(404).json({ error: "Товар не найден" });

    const newPrice = price !== undefined ? Number(price) : product.price;
    const newStock = stock !== undefined ? Number(stock) : product.stock;
    const inStock = newStock > 0 ? 1 : 0;

    db.prepare(`
      UPDATE products SET price = ?, stock = ?, in_stock = ? WHERE id = ?
    `).run(newPrice, newStock, inStock, req.params.id);

    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка обновления товара:", err);
    res.status(500).json({ error: err.message });
  }
};

app.put("/api/admin/products/:id", updateProductHandler);
app.patch("/api/admin/products/:id", updateProductHandler);

// 3. Удаление товара из БД
app.delete("/api/admin/products/:id", (req, res) => {
  try {
    const { telegram_id } = req.body;

    if (!isAdmin(telegram_id)) {
      return res.status(403).json({ error: "Отказано в доступе" });
    }

    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ЗАКАЗЫ И ВЫДАЧА ====================

// Создание заказа
app.post("/api/order", (req, res) => {
  try {
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
    if (notifyAdminNewOrder) notifyAdminNewOrder(order, enrichedItems);

    res.json({ order_id: order.id });
  } catch (err) {
    console.error("Ошибка создания заказа:", err);
    res.status(500).json({ error: err.message });
  }
});

// Статус заказа
app.get("/api/order/:id", (req, res) => {
  try {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
    if (!order) return res.status(404).json({ error: "not found" });
    res.json({ status: order.status, delivery_link: order.delivery_link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Заказы для Roblox-бота
app.get("/api/pending-deliveries", (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM orders WHERE status = 'approved'").all();
    res.json(orders.map(o => ({
      order_id: o.id,
      roblox_nickname: o.roblox_nickname,
      items: JSON.parse(o.items_json)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Подтверждение выдачи от Roblox-бота
app.post("/api/mark-delivered/:id", (req, res) => {
  try {
    db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
insert.run("Prismatic", 220, 1, "godly", "prismatic.webp"); //
insert.run("Pumpking", 250, 1, "godly", "Pumpking.webp"); //
insert.run("Ice Dragon", 210, 1, "godly", "icedragon.webp"); //
insert.run("Ice Shard", 230, 1, "godly", "iceshard.webp"); //
insert.run("Spider", 260, 1, "godly", "spider.webp"); //
insert.run("Vampire's Edge", 260, 1, "godly", "vampedge.webp"); //
insert.run("Pixel", 270, 1, "godly", "pixel.webp"); //
insert.run("Battle Axe", 220, 1, "godly", "baxe.webp"); //
insert.run("Battle Axe 2", 450, 1, "godly", "baxe2.webp"); //
insert.run("Frostbite", 260, 1, "godly", "frostbite.webp"); //
insert.run("Red Luger", 220, 1, "godly", "redluger.webp"); //
insert.run("Peppermint", 320, 1, "godly", "peppermint.webp"); //
insert.run("Slasher", 360, 1, "godly", "slasher.webp"); //
insert.run("Saw", 250, 1, "godly", "saw.webp"); //
insert.run("Green Luger", 600, 1, "godly", "greenluger.webp"); //
insert.run("Icewing", 450, 1, "godly", "icewing.webp"); //
insert.run("Ghostblade", 180, 1, "godly", "ghostblade.webp"); //
insert.run("Xmas", 280, 1, "godly", "xmas.webp"); //
insert.run("Handsaw", 200, 1, "godly", "handsaw.webp"); //
insert.run("Frostsaber", 200, 1, "godly", "frostsaber.webp"); //
insert.run("Snowflake", 200, 1, "godly", "snowflake.webp"); //
insert.run("Tides", 250, 1, "godly", "tides.webp"); //
insert.run("Fang", 250, 1, "godly", "fang.webp"); //
insert.run("Flames", 200, 1, "godly", "flames.webp"); //
insert.run("Nebula", 300, 1, "godly", "nebula.webp"); //
insert.run("Heat", 260, 1, "godly", "heat.webp"); //
