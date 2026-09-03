// Telegram ID администратора
const ADMIN_TELEGRAM_ID = 5538562889; 

const tg = window.Telegram?.WebApp || {};
if (tg.ready) tg.ready();
if (tg.expand) tg.expand();

const API_BASE = "https://roblox-shop-4e0j.onrender.com/api";

let products = [];
let cart = {}; // { productId: qty }
let selectedCategory = "all";

// ---------- Работа с локальной историей заказов ----------
function getSavedOrders() {
  try {
    return JSON.parse(localStorage.getItem("user_orders") || "[]");
  } catch (e) {
    return [];
  }
}

function saveOrderToHistory(orderId) {
  const orders = getSavedOrders();
  if (!orders.includes(orderId)) {
    orders.unshift(orderId);
    localStorage.setItem("user_orders", JSON.stringify(orders));
  }
}

// ---------- Инициализация ----------
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    applyFilters();
  } catch (err) {
    console.error("Ошибка загрузки товаров:", err);
  }
}

// ---------- Слушатели событий ----------
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();

  // --- Проверка прав Администратора ---
  const currentUserId = tg.initDataUnsafe?.user?.id;
  const adminBtn = document.getElementById("adminBtn");

  // Показываем кнопку «Админка» только владельцу
  if (adminBtn) {
    if (currentUserId === ADMIN_TELEGRAM_ID || !tg.initData) {
      adminBtn.classList.remove("hidden");
    }
    adminBtn.addEventListener("click", openAdminPanel);
  }

  // Настройка закрытия админ-панели
  const adminOverlay = document.getElementById("adminOverlay");
  const closeAdminBtn = document.getElementById("closeAdminBtn");
  if (adminOverlay && closeAdminBtn) {
    closeAdminBtn.addEventListener("click", closeAdminPanel);
    adminOverlay.addEventListener("click", (e) => {
      if (e.target === adminOverlay) closeAdminPanel();
    });
  }

  // Кнопка сохранения нового товара в админке
  document.getElementById("saveNewItemBtn")?.addEventListener("click", addNewProduct);

  // --- Остальные обработчики магазина ---
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  const toggleBtn = document.getElementById("toggleFilterBtn");
  const dropdown = document.getElementById("filterDropdown");
  if (toggleBtn && dropdown) {
    toggleBtn.addEventListener("click", () => {
      dropdown.classList.toggle("open");
    });
  }

  document.querySelectorAll('input[name="sortOption"]').forEach(radio => {
    radio.addEventListener("change", applyFilters);
  });

  // Клик по плашкам категорий
  const catContainer = document.getElementById("categoryContainer");
  if (catContainer) {
    catContainer.addEventListener("click", (e) => {
      const chip = e.target.closest(".cat-chip");
      if (!chip) return;

      document.querySelectorAll(".cat-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");

      selectedCategory = chip.dataset.category || "all";
      applyFilters();
    });
  }

  // Привязка кнопки корзины
  const openCartBtn = document.getElementById("openCartBtn");
  if (openCartBtn) {
    openCartBtn.onclick = () => {
      hideAllScreens();
      const cartScreen = document.getElementById("cartScreen");
      if (cartScreen) cartScreen.classList.remove("hidden");
      
      document.getElementById("bottomCartBar")?.classList.add("hidden"); 
      renderCart();
    };
  }

  // Привязка кнопки истории
  const openHistoryBtn = document.getElementById("openHistoryBtn");
  if (openHistoryBtn) {
    openHistoryBtn.onclick = () => {
      hideAllScreens();
      const historyScreen = document.getElementById("historyScreen");
      if (historyScreen) historyScreen.classList.remove("hidden");
      renderHistory();
    };
  }

  // Кнопки возврата в каталог
  document.getElementById("continueShoppingBtn")?.addEventListener("click", showCatalog);
  document.getElementById("backToCatalogBtn")?.addEventListener("click", showCatalog);
  document.getElementById("backFromHistoryBtn")?.addEventListener("click", showCatalog);
  document.getElementById("statusToCatalogBtn")?.addEventListener("click", showCatalog);

  // Кнопка оформления заказа
  document.getElementById("submitOrderBtn")?.addEventListener("click", submitOrder);

  // Скрытие клавиатуры при согласии с правилами
  const rulesCheckbox = document.getElementById("rulesCheckbox");
  const submitOrderBtn = document.getElementById("submitOrderBtn");
  if (rulesCheckbox && submitOrderBtn) {
    rulesCheckbox.addEventListener("change", () => {
      document.activeElement?.blur();
      setTimeout(() => {
        submitOrderBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    });
  }

  // Проверка статуса заказа
  document.getElementById("checkStatusBtn")?.addEventListener("click", () => {
    if (!window.currentOrderId) return;
    checkSingleOrderStatus(window.currentOrderId, document.getElementById("deliveryLink"));
  });

  // Логика шторки правил
  const overlay = document.getElementById('modalOverlay');
  const closeBtn = document.getElementById('closeBtn');
  if (overlay && closeBtn) {
    closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  }

  // Открытие правил
  const openRulesBtn = document.getElementById("openRulesBtn");
  const modalContent = document.querySelector("#modalOverlay .modal-content");

  if (openRulesBtn && overlay && modalContent) {
    openRulesBtn.addEventListener("click", () => {
      modalContent.innerHTML = `
        <h3 style="margin-top:0; color:#fff; font-size:16px;">Правила магазина и политика возврата</h3>
        <div style="color:#a0a0ab; font-size:13px; line-height:1.5;">
          <p><strong>1. Отмена и возврат:</strong> Ввиду специфики цифровых товаров и предметов в Roblox, после подтверждения оплаты и выдачи предмета возврат денежных средств не производится.</p>
          <p><strong>2. Точность данных:</strong> Покупатель несет полную ответственность за правильность указанного никнейма в Roblox. В случае ошибки при вводе ника возврат или повторная выдача не гарантируются.</p>
          <p><strong>3. Выдача товара:</strong> Все предметы передаются через приватный сервер или бота в игре в кратчайшие сроки после проверки оплаты.</p>
          <p><strong>4. Конфиденциальность:</strong> Ваши данные (Telegram ID и никнейм) используются только для проведения и доставки заказа.</p>
        </div>
      `;
      overlay.classList.add("active");
    });
  }
});

// ---------- Логика Админ-панели ----------
function openAdminPanel() {
  const adminOverlay = document.getElementById("adminOverlay");
  if (adminOverlay) {
    adminOverlay.classList.add("active");
    renderAdminProducts();
  }
}

function closeAdminPanel() {
  const adminOverlay = document.getElementById("adminOverlay");
  if (adminOverlay) {
    adminOverlay.classList.remove("active");
  }
}

function renderAdminProducts() {
  const container = document.getElementById("adminProductsList");
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = "<p style='color:#a0a0ab; text-align:center;'>Товары пока отсутствуют</p>";
    return;
  }

  container.innerHTML = products.map(p => `
    <div style="background: #181922; border: 1px solid #282936; border-radius: 12px; padding: 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong style="color: #fff; font-size: 15px;">${p.name}</strong>
        <button onclick="deleteProduct(${p.id})" style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer;">Удалить</button>
      </div>
      
      <div style="display: flex; gap: 10px; align-items: center;">
        <div style="flex: 1;">
          <label style="font-size: 11px; color: #a0a0ab; display: block; margin-bottom: 2px;">Цена (₸):</label>
          <input type="number" value="${p.price}" onchange="updateProductPrice(${p.id}, this.value)" style="width: 100%; background: #0f1015; border: 1px solid #282936; color: #ffd700; font-weight: bold; padding: 6px; border-radius: 6px; box-sizing: border-box;">
        </div>
        
        <div style="flex: 1;">
          <label style="font-size: 11px; color: #a0a0ab; display: block; margin-bottom: 2px;">В наличии (шт):</label>
          <input type="number" value="${p.stock ?? 1}" onchange="updateProductStock(${p.id}, this.value)" style="width: 100%; background: #0f1015; border: 1px solid #282936; color: #fff; font-weight: bold; padding: 6px; border-radius: 6px; box-sizing: border-box;">
        </div>
      </div>
    </div>
  `).join('');
}

window.updateProductPrice = function(id, newPrice) {
  const p = products.find(item => item.id == id);
  if (p) {
    p.price = Number(newPrice);
    applyFilters();
    showToast("✏️ Цена обновлена");
  }
};

window.updateProductStock = function(id, newStock) {
  const p = products.find(item => item.id == id);
  if (p) {
    p.stock = Number(newStock);
    applyFilters();
    showToast("📦 Остаток обновлен");
  }
};

window.deleteProduct = function(id) {
  products = products.filter(item => item.id != id);
  renderAdminProducts();
  applyFilters();
  showToast("🗑️ Товар удален");
};

function addNewProduct() {
  const titleInput = document.getElementById("addTitle");
  const priceInput = document.getElementById("addPrice");
  const stockInput = document.getElementById("addStock");
  const categorySelect = document.getElementById("addCategory");

  const title = titleInput ? titleInput.value.trim() : "";
  const price = priceInput ? Number(priceInput.value) : 0;
  const stock = stockInput ? Number(stockInput.value) : 1;
  const category = categorySelect ? categorySelect.value : "godly";

  if (!title || isNaN(price) || price <= 0) {
    alert("Заполните название и корректную цену товара!");
    return;
  }

  const newProd = {
    id: Date.now(),
    name: title,
    price: price,
    stock: stock,
    category: category,
    image_url: "kaspi-qr.png"
  };

  products.unshift(newProd);

  if (titleInput) titleInput.value = "";
  if (priceInput) priceInput.value = "";
  if (stockInput) stockInput.value = "";

  renderAdminProducts();
  applyFilters();
  showToast("✅ Товар добавлен!");
}

// ---------- Фильтрация и сортировка ----------
function applyFilters() {
  const searchVal = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const sortVal = document.querySelector('input[name="sortOption"]:checked')?.value || "default";

  let filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchVal);
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (sortVal === "cheap") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortVal === "expensive") {
    filtered.sort((a, b) => b.price - a.price);
  }

  renderCatalog(filtered);
}

// ---------- Каталог ----------
function renderCatalog(list) {
  const catalog = document.getElementById("catalog");
  if (!catalog) return;

  if (list.length === 0) {
    catalog.innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#a0a0ab; padding:30px 0;'>Товары не найдены 🔍</p>";
    return;
  }

  catalog.innerHTML = list.map(p => {
    const qty = cart[p.id] || 0;
    const isOutOfStock = p.stock !== undefined && p.stock <= 0;
    
    let buttonHtml = "";
    if (isOutOfStock) {
      buttonHtml = `<button class="buy-btn" style="background:#282936; color:#a0a0ab; cursor:not-allowed;" disabled>Нет в наличии</button>`;
    } else if (qty > 0) {
      buttonHtml = `<div class="qty-control-pill">
           <button class="pill-btn" onclick="changeQty(${p.id}, -1)">—</button>
           <span class="pill-count">${qty}</span>
           <button class="pill-btn" onclick="changeQty(${p.id}, 1)">+</button>
         </div>`;
    } else {
      buttonHtml = `<button class="buy-btn" onclick="addToCart(${p.id}, event)">В корзину</button>`;
    }

    return `
      <div class="item-card">
        <img src="${p.image_url || 'kaspi-qr.png'}" alt="${p.name}">
        <div class="name">${p.name}</div>
        <div class="price">${p.price} ₸</div>
        <div id="btn-container-${p.id}">${buttonHtml}</div>
      </div>
    `;
  }).join("");
}

// ---------- Работа с корзиной ----------
function addToCart(id, event) {
  cart[id] = 1;
  updateCartBadge();
  
  const targetBtn = event ? (event.currentTarget || event.target) : null;
  if (targetBtn) {
    const card = targetBtn.closest('.item-card');
    const img = card ? card.querySelector('img') : null;
    const cartBadge = document.getElementById('openCartBtn');

    if (img && cartBadge) {
      const flyingImg = img.cloneNode(true);
      const imgRect = img.getBoundingClientRect();
      const cartRect = cartBadge.getBoundingClientRect();

      flyingImg.classList.add('flying-item');
      flyingImg.style.top = `${imgRect.top}px`;
      flyingImg.style.left = `${imgRect.left}px`;
      flyingImg.style.width = `${imgRect.width}px`;
      flyingImg.style.height = `${imgRect.height}px`;

      document.body.appendChild(flyingImg);

      requestAnimationFrame(() => {
        flyingImg.style.top = `${cartRect.top + 5}px`;
        flyingImg.style.left = `${cartRect.left + (cartRect.width / 2) - 10}px`;
        flyingImg.style.width = '20px';
        flyingImg.style.height = '20px';
        flyingImg.style.opacity = '0.2';
        flyingImg.style.transform = 'scale(0.3) rotate(360deg)';
      });

      setTimeout(() => {
        flyingImg.remove();
        cartBadge.classList.add('cart-bump');
        setTimeout(() => cartBadge.classList.remove('cart-bump'), 300);
      }, 600);
    }
  }

  applyFilters();

  if (tg?.HapticFeedback) {
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
  applyFilters();
  
  const cartScreen = document.getElementById("cartScreen");
  if (cartScreen && !cartScreen.classList.contains("hidden")) {
    renderCart();
  }

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred("light");
  }
}

function removeItemCompletely(id) {
  delete cart[id];
  updateCartBadge();
  applyFilters();
  renderCart();
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred("medium");
  }
}

function updateCartBadge() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartBadge = document.getElementById("cartBadge");
  const bottomBar = document.getElementById("bottomCartBar");

  if (cartBadge) {
    cartBadge.textContent = count;
  }

  const catalog = document.getElementById("catalog");
  const isCatalogVisible = catalog && !catalog.classList.contains("hidden");

  if (bottomBar) {
    if (count > 0 && isCatalogVisible) {
      bottomBar.classList.remove("hidden");
    } else {
      bottomBar.classList.add("hidden");
    }
  }
}

// ---------- Отрисовка корзины ----------
function renderCart() {
  const container = document.getElementById("cartItems");
  if (!container) return;

  let total = 0;
  let totalCount = 0;

  const cartEntries = Object.entries(cart).filter(([_, qty]) => qty > 0);

  if (cartEntries.length === 0) {
    container.innerHTML = "<p class='empty-cart-text' style='text-align:center; color:#a0a0ab; padding:30px 0;'>Корзина пуста 🛒</p>";
    const totalEl = document.getElementById("cartTotal");
    if (totalEl) totalEl.textContent = "0";
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
        <img class="cart-item-img" src="${p.image_url || 'kaspi-qr.png'}" alt="${p.name}">
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

  const totalEl = document.getElementById("cartTotal");
  if (totalEl) totalEl.textContent = total;
  
  const countLabel = document.getElementById("cartCountLabel");
  if (countLabel) {
    countLabel.textContent = `В корзине ${totalCount} товара`;
  }
}

// ---------- Переключение экранов ----------
function hideAllScreens() {
  document.getElementById("catalog")?.classList.add("hidden");
  document.querySelector(".filters")?.classList.add("hidden");
  document.querySelector(".category-section")?.classList.add("hidden");
  
  document.getElementById("cartScreen")?.classList.add("hidden");
  document.getElementById("statusScreen")?.classList.add("hidden");
  document.getElementById("historyScreen")?.classList.add("hidden");

  document.getElementById("bottomCartBar")?.classList.add("hidden");
  document.getElementById("filterDropdown")?.classList.remove("open");
}

function showCatalog() {
  hideAllScreens();
  document.getElementById("catalog")?.classList.remove("hidden");
  document.querySelector(".filters")?.classList.remove("hidden");
  document.querySelector(".category-section")?.classList.remove("hidden");

  updateCartBadge();
}

// ---------- Оформление заказа ----------
async function submitOrder() {
  const nicknameInput = document.getElementById("nickname");
  const nickname = nicknameInput ? nicknameInput.value.trim() : "";
  
  if (!nickname) {
    if (tg.showAlert) tg.showAlert("Укажите ник в Roblox");
    else alert("Укажите ник в Roblox");
    return;
  }
  if (Object.keys(cart).length === 0) {
    if (tg.showAlert) tg.showAlert("Корзина пуста");
    else alert("Корзина пуста");
    return;
  }

  const payload = {
    telegram_id: tg.initDataUnsafe?.user?.id,
    telegram_username: tg.initDataUnsafe?.user?.username,
    roblox_nickname: nickname,
    items: Object.entries(cart).map(([id, qty]) => ({ product_id: Number(id), qty })),
    init_data: tg.initData
  };

  try {
    const res = await fetch(`${API_BASE}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.order_id) {
      cart = {};
      updateCartBadge();
      
      saveOrderToHistory(data.order_id);

      hideAllScreens();
      document.getElementById("statusScreen")?.classList.remove("hidden");
      const orderIdText = document.getElementById("orderIdText");
      if (orderIdText) orderIdText.textContent = `Заказ #${data.order_id}`;
      const deliveryLink = document.getElementById("deliveryLink");
      if (deliveryLink) deliveryLink.innerHTML = "";
      window.currentOrderId = data.order_id;
    } else {
      if (tg.showAlert) tg.showAlert("Ошибка при создании заказа, попробуйте ещё раз");
      else alert("Ошибка при создании заказа");
    }
  } catch (err) {
    if (tg.showAlert) tg.showAlert("Ошибка соединения с сервером");
    else alert("Ошибка соединения с сервером");
  }
}

// ---------- Проверка статуса заказа ----------
async function checkSingleOrderStatus(orderId, targetContainer) {
  if (!targetContainer) return;
  try {
    const res = await fetch(`${API_BASE}/order/${orderId}`);
    const data = await res.json();
    
    if (data.status === "approved") {
      targetContainer.innerHTML =
        `<p style="color:#22c55e; font-weight:bold; margin-bottom:5px;">Оплата подтверждена! ✅</p>
         <a href="${data.delivery_link}" target="_blank" style="color:#8b5cf6; word-break:break-all;">${data.delivery_link}</a>`;
    } else if (data.status === "rejected") {
      targetContainer.innerHTML = `<p style="color:#ef4444; font-weight:bold;">Оплата не найдена или отклонена. Напишите в поддержку.</p>`;
    } else {
      targetContainer.innerHTML = `<p style="color:#eab308; font-weight:bold;">Оплата ещё проверяется ⏳</p>`;
    }
  } catch (err) {
    targetContainer.innerHTML = `<p style="color:#ef4444;">Ошибка получения статуса</p>`;
  }
}

// ---------- Отрисовка Истории Заказов ----------
function renderHistory() {
  const container = document.getElementById("historyList");
  if (!container) return;

  const orders = getSavedOrders();

  if (orders.length === 0) {
    container.innerHTML = "<p style='color:#a0a0ab; text-align:center; padding: 20px 0;'>У вас пока нет заказов</p>";
    return;
  }

  container.innerHTML = orders.map(id => `
    <div style="background:#181922; border:1px solid #282936; border-radius:14px; padding:15px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong style="font-size:16px;">Заказ #${id}</strong>
        <button onclick="checkHistoryItemStatus(${id})" class="primary-btn" style="padding:6px 12px; font-size:12px;">Проверить</button>
      </div>
      <div id="history-status-${id}" style="font-size:13px; color:#a0a0ab;">Нажмите «Проверить» для обновления статуса</div>
    </div>
  `).join("");
}

window.checkHistoryItemStatus = function(orderId) {
  const target = document.getElementById(`history-status-${orderId}`);
  if (target) {
    target.innerHTML = "Загрузка...";
    checkSingleOrderStatus(orderId, target);
  }
};

// Всплывающее уведомление
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
