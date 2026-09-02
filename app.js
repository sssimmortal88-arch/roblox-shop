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

// ---------- Каталог ----------
function renderCatalog(list) {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = list.map(p => {
    const qty = cart[p.id] || 0;
    
    // Если товар уже в корзине, показываем фиолетовый переключатель "- 1 +"
    const buttonHtml = qty > 0 
      ? `<div class="qty-control-pill">
           <button class="pill-btn" onclick="changeQty(${p.id}, -1)">—</button>
           <span class="pill-count">${qty}</span>
           <button class="pill-btn" onclick="changeQty(${p.id}, 1)">+</button>
         </div>`
      : `<button class="buy-btn" onclick="addToCart(${p.id})">В корзину</button>`;

    return `
      <div class="item-card">
        <img src="${p.image_url}" alt="${p.name}">
        <div class="name">${p.name}</div>
        <div class="price">${p.price} ₸</div>
        <div id="btn-container-${p.id}">${buttonHtml}</div>
      </div>
    `;
  }).join("");
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

// ---------- Работа с товарами ----------
// Функция добавления товара с анимацией полёта в корзину
function addToCart(id) {
    cart[id] = 1;
    updateCartBadge();
    
    // Запуск анимации полёта картинки в корзину
    if (window.event && window.event.target) {
        const btn = window.event.target;
        const card = btn.closest('.item-card');
        const img = card ? card.querySelector('img') : null;
        const cartBadge = document.getElementById('openCartBtn');

        if (img && cartBadge) {
            // Клонируем картинку товара
            const flyingImg = img.cloneNode(true);
            const imgRect = img.getBoundingClientRect();
            const cartRect = cartBadge.getBoundingClientRect();

            // Задаём начальные координаты клона
            flyingImg.classList.add('flying-item');
            flyingImg.style.top = `${imgRect.top}px`;
            flyingImg.style.left = `${imgRect.left}px`;
            flyingImg.style.width = `${imgRect.width}px`;
            flyingImg.style.height = `${imgRect.height}px`;

            document.body.appendChild(flyingImg);

            // Запускаем перемещение к значку корзины (в правый верхний угол)
            requestAnimationFrame(() => {
                flyingImg.style.top = `${cartRect.top + 5}px`;
                flyingImg.style.left = `${cartRect.left + 10}px`;
                flyingImg.style.width = '20px';
                flyingImg.style.height = '20px';
                flyingImg.style.opacity = '0.2';
                flyingImg.style.transform = 'scale(0.3) rotate(360deg)';
            });

            // Удаляем клон после завершения анимации и «встряхиваем» корзину
            setTimeout(() => {
                flyingImg.remove();
                cartBadge.classList.add('cart-bump');
                setTimeout(() => cartBadge.classList.remove('cart-bump'), 300);
            }, 600);
        }
    }

    applyFilters(); // Обновляем кнопку на фиолетовый переключатель

    if (window.tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred("light");
    }
    showToast("🛒 Товар добавлен в корзину!");
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id] += delta;
  
  if (cart[id] <= 0) {
    delete cart[id];
  }

  updateCartBadge();
  applyFilters(); // Обновляем состояние кнопок в каталоге
  
  // Если открыт экран корзины, обновляем и его
  const cartScreen = document.getElementById("cartScreen");
  if (cartScreen && !cartScreen.classList.contains("hidden")) {
    renderCart();
  }

  if (window.tg && tg.HapticFeedback) {
    tg.HapticFeedback.impactOccurred("light");
  }
}

// Полное удаление товара по нажатию на крестик в корзине
function removeItemCompletely(id) {
  delete cart[id];
  updateCartBadge();
  applyFilters();
  renderCart();
  if (window.tg && tg.HapticFeedback) {
    tg.HapticFeedback.impactOccurred("medium");
  }
}

function updateCartBadge() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  document.getElementById("cartBadge").textContent = `🛒 ${count}`;
}

// ---------- Отрисовка стильной корзины ----------
function renderCart() {
  const container = document.getElementById("cartItems");
  let total = 0;
  let totalCount = 0;

  const cartEntries = Object.entries(cart).filter(([_, qty]) => qty > 0);

  if (cartEntries.length === 0) {
    container.innerHTML = "<p class='empty-cart-text'>Корзина пуста 🛒</p>";
    document.getElementById("cartTotal").textContent = "0";
    const countLabel = document.getElementById("cartCountLabel");
    if (countLabel) countLabel.textContent = "В корзине 0 товаров";
    return;
  }

  container.innerHTML = cartEntries.map(([id, qty]) => {
    const p = products.find(p => p.id == id);
    if (!p) return "";
    const sum = p.price * qty;
    total += sum;
    totalCount += qty;

    return `
      <div class="cart-card">
        <img class="cart-item-img" src="${p.image_url}" alt="${p.name}">
        <div class="cart-card-content">
          <div class="cart-card-top">
            <span class="cart-card-title">${p.name}</span>
            <button type="button" class="cart-remove-btn" onclick="removeItemCompletely(${p.id})">✕</button>
          </div>
          <div class="cart-card-price">${p.price} ₸</div>
          <div class="cart-pill-controls">
            <button type="button" class="cart-pill-btn" onclick="changeQty(${p.id}, -1)">—</button>
            <span class="cart-pill-count">${qty}</span>
            <button type="button" class="cart-pill-btn" onclick="changeQty(${p.id}, 1)">+</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("cartTotal").textContent = total;
  
  const countLabel = document.getElementById("cartCountLabel");
  if (countLabel) {
    countLabel.textContent = `В корзине ${totalCount} товара`;
  }
}

// ---------- Переключение экранов ----------
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
    init_data: tg.initData
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

// Функция вызова всплывающего уведомления
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
