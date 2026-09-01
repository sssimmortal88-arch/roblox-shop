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

// Демо-товары (замени на свои)
const count = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
if (count === 0) {
  const insert = db.prepare(
    "INSERT INTO products (name, category, price, image_url) VALUES (?, ?, ?, ?)"
  );
  insert.run("Godly Chroma Lightbringer", "knife", 4500, "https://example.com/img1.png");
  insert.run("Godly Vampire", "gun", 3200, "https://example.com/img2.png");
  insert.run("Chroma Bat", "knife", 6000, "https://example.com/img3.png");
  insert.run("Huge Cat Pet", "pet", 1500, "https://example.com/img4.png");
}

export default db;
