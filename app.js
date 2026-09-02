const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_BASE = "https://roblox-shop-4e0j.onrender.com/api";

let products = [];
let cart = {}; // { productId: qty }

// ---------- Инициализация ----------
async function loadProducts() {
  const res = await fetch(`${API_BASE}/products`);
  products = await res.json();
  renderCatalog(products);
}

function renderCatalog(list) {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = list.map(p => `
    <div class="item-card">
      <img src="${p.image_url}" alt="${p.name}">
      <div class="name">${p.name}</div>
      <div class="price">${p.price} ₸</div>
      <button onclick="addToCart(${p.id})">В корзину</button>
    </div>
  `).join("");
}

// ---------- Фильтры ----------
document.getElementById("searchInput").addEventListener("input", applyFilters);
document.getElementById("categoryFilter").addEventListener("change", applyFilters);

function applyFilters() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const cat = document.getElementById("categoryFilter").value;
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(q) && (cat === "all" || p.category === cat)
  );
  renderCatalog(filtered);
}

// ---------- Корзина ----------
function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    updateCartBadge();
    tg.HapticFeedback.impactOccurred("light");

    // Всплывающее уведомление
    showToast("🛒 Товар добавлен в корзину!");

    // Анимация нажатия на кнопку
    if (window.event && window.event.target) {
        const btn = window.event.target;
        btn.classList.add('added');
        setTimeout(() => btn.classList.remove('added'), 400);
    }
}

function updateCartBadge() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  document.getElementById("cartBadge").textContent = `🛒 ${count}`;
}

// Отрисовка интерактивной корзины с кнопками "+" и "-"
function renderCart() {
  const container = document.getElementById("cartItems");
  let total = 0;

  const cartEntries = Object.entries(cart).filter(([_, qty]) => qty > 0);

  if (cartEntries.length === 0) {
    container.innerHTML = "<p class='empty-cart-text'>Корзина пуста 🛒</p>";
    document.getElementById("cartTotal").textContent = "0";
    return;
  }

  container.innerHTML = cartEntries.map(([id, qty]) => {
    const p = products.find(p => p.id == id);
    if (!p) return "";
    const sum = p.price * qty;
    total += sum;

    return `
      <div class="cart-line">
        <div class="cart-item-info">
          <span class="cart-item-name">${p.name}</span>
          <span class="cart-item-price">${sum} ₸</span>
        </div>
        <div class="cart-controls">
          <button type="button" class="qty-btn" onclick="changeQty(${p.id}, -1)">-</button>
          <span class="qty-count">${qty}</span>
          <button type="button" class="qty-btn" onclick="changeQty(${p.id}, 1)">+</button>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("cartTotal").textContent = total;
}

// Функция управления количеством товара (+1 / -1)
function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id] += delta;
  
  if (cart[id] <= 0) {
    delete cart[id];
  }

  updateCartBadge();
  renderCart();
  
  if (window.tg && tg.HapticFeedback) {
    tg.HapticFeedback.impactOccurred("light");
  }
}

document.getElementById("openCartBtn").onclick = () => {
  document.getElementById("catalog").classList.add("hidden");
  document.querySelector(".filters").classList.add("hidden");
  document.getElementById("cartScreen").classList.remove("hidden");
  renderCart();
};

document.getElementById("backToCatalogBtn").onclick = () => {
  document.getElementById("cartScreen").classList.add("hidden");
  document.getElementById("catalog").classList.remove("hidden");
  document.querySelector(".filters").classList.remove("hidden");
};

// ---------- Оформление заказа ----------
document.getElementById("submitOrderBtn").onclick = async () => {
  const nickname = document.getElementById("nickname").value.trim();
  if (!nickname) {
    tg.showAlert("Укажите ник в Roblox");
    return;
  }
  if (Object.keys(cart).length === 0) {
    tg.showAlert("Корзина пуста");
    return;
  }

  const payload = {
    telegram_id: tg.initDataUnsafe?.user?.id,
    telegram_username: tg.initDataUnsafe?.user?.username,
    roblox_nickname: nickname,
    items: Object.entries(cart).map(([id, qty]) => ({ product_id: Number(id), qty })),
    init_data: tg.initData // backend должен провалидировать эту строку
  };

  const res = await fetch(`${API_BASE}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  if (data.order_id) {
    cart = {};
    updateCartBadge();
    document.getElementById("cartScreen").classList.add("hidden");
    document.getElementById("statusScreen").classList.remove("hidden");
    document.getElementById("orderIdText").textContent = `Заказ #${data.order_id}`;
    window.currentOrderId = data.order_id;
  } else {
    tg.showAlert("Ошибка при создании заказа, попробуйте ещё раз");
  }
};

// ---------- Проверка статуса ----------
document.getElementById("checkStatusBtn").onclick = async () => {
  const res = await fetch(`${API_BASE}/order/${window.currentOrderId}`);
  const data = await res.json();
  if (data.status === "approved") {
    document.getElementById("deliveryLink").innerHTML =
      `<p>Оплата подтверждена! Ссылка на приватный сервер:</p>
       <a href="${data.delivery_link}" target="_blank">${data.delivery_link}</a>`;
  } else if (data.status === "rejected") {
    document.getElementById("deliveryLink").innerHTML = `<p>Оплата не найдена. Напишите в поддержку.</p>`;
  } else {
    tg.showAlert("Оплата ещё проверяется, попробуйте позже");
  }
};

loadProducts();

// Функция вызова красивого уведомления
function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}
