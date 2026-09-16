import Database from "better-sqlite3";

const db = new Database("shop.db");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  price INTEGER NOT NULL,
  image_url TEXT,
  in_stock INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER,
  telegram_username TEXT,
  roblox_nickname TEXT,
  items_json TEXT,
  total_price INTEGER,
  status TEXT DEFAULT 'pending', -- pending | approved | rejected | delivered
  delivery_link TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);


export default db;
