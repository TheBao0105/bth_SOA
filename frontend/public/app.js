/* Giao diện client gọi 3 service: Auth (TH2), Product (TH3), Order (TH4) */
const cfg = window.SOA_CONFIG;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- Lưu phiên đăng nhập ----------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const state = {
  token: store.get('soa_token'),
  user: store.get('soa_user'),
  products: [],
  cart: new Map(), // product_id -> quantity
  order: null,     // đơn đang mở
};

// ---------- Tiện ích ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 });
const date = (s) => (s ? new Date(s).toLocaleString('vi-VN') : '');
const STATUS = { pending: 'Chờ xử lý', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const badge = (s) => `<span class="badge ${esc(s)}">${esc(STATUS[s] || s)}</span>`;

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  // Hộp thoại modal nằm trên cùng, nên gắn thông báo vào hộp thoại đang mở để không bị che
  const host = $('dialog[open]') || document.body;
  let box = [...host.children].find((c) => c.classList.contains('toasts'));
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    host.append(box);
  }
  box.append(el);
  setTimeout(() => el.remove(), 3500);
}

/** Gọi API một service. Tự gắn token, ném lỗi kèm message từ server. */
async function api(base, path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Không kết nối được service ${base}`);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && state.token && base !== cfg.authUrl) {
    logout();
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  }
  if (!res.ok) {
    const detail = data?.errors ? `: ${data.errors.join(', ')}` : '';
    throw new Error((data?.message || `Lỗi ${res.status}`) + detail);
  }
  return data;
}
const run = (fn) => async (...args) => {
  try { await fn(...args); } catch (err) { toast(err.message, 'error'); }
};

// ---------- Trạng thái service ----------
async function pingServices() {
  for (const [name, url] of [['auth', cfg.authUrl], ['product', cfg.productUrl], ['order', cfg.orderUrl]]) {
    const el = $(`.svc[data-svc="${name}"]`);
    $(`[data-port="${name}"]`).textContent = new URL(url).port;
    try {
      const r = await fetch(url + '/', { signal: AbortSignal.timeout(2000) });
      el.className = `svc ${r.ok ? 'up' : 'down'}`;
    } catch {
      el.className = 'svc down';
    }
  }
}

// =====================================================================
// TH2 - Đăng nhập / đăng ký
// =====================================================================
function showView() {
  const loggedIn = !!state.token;
  $('#authView').hidden = loggedIn;
  $('#appView').hidden = !loggedIn;
  $('#userBox').hidden = !loggedIn;
  if (loggedIn) {
    $('#userName').textContent = `Xin chào, ${state.user?.username || ''}`;
    switchTab('products');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  store.del('soa_token');
  store.del('soa_user');
  showView();
}

$$('[data-auth-tab]').forEach((btn) =>
  btn.addEventListener('click', () => {
    $$('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b === btn));
    $('#loginForm').hidden = btn.dataset.authTab !== 'login';
    $('#registerForm').hidden = btn.dataset.authTab !== 'register';
  })
);

$('#loginForm').addEventListener('submit', run(async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const data = await api(cfg.authUrl, '/auth/login', { method: 'POST', body: f });
  state.token = data.token;
  state.user = data.user;
  store.set('soa_token', data.token);
  store.set('soa_user', data.user);
  e.target.reset();
  toast(`Đăng nhập thành công`, 'success');
  showView();
}));

$('#registerForm').addEventListener('submit', run(async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  await api(cfg.authUrl, '/auth/register', { method: 'POST', body: f });
  toast('Đăng ký thành công, hãy đăng nhập', 'success');
  $('#loginForm [name=username]').value = f.username;
  e.target.reset();
  $('[data-auth-tab="login"]').click();
}));

$('#logoutBtn').addEventListener('click', logout);

// =====================================================================
// Tabs
// =====================================================================
function switchTab(name) {
  $$('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.panel').forEach((p) => (p.hidden = p.id !== `tab-${name}`));
  if (name === 'products') run(loadProducts)();
  if (name === 'newOrder') run(async () => { await loadProducts(); renderCart(); })();
  if (name === 'orders') run(loadOrders)();
}
$$('[data-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// =====================================================================
// TH3 - Sản phẩm
// =====================================================================
async function loadProducts() {
  const q = $('#productSearch').value.trim();
  state.products = await api(cfg.productUrl, '/products' + (q ? `?search=${encodeURIComponent(q)}` : ''));
  renderProducts();
  renderPickList();
}

function renderProducts() {
  const rows = state.products.map((p) => `
    <tr>
      <td>${p.id}</td>
      <td><b>${esc(p.name)}</b></td>
      <td class="desc" title="${esc(p.description)}">${esc(p.description)}</td>
      <td class="num">${money(p.price)}</td>
      <td class="num ${p.quantity <= 5 ? 'low' : ''}">${p.quantity}</td>
      <td class="actions-cell">
        <button class="btn sm" data-edit-product="${p.id}">Sửa</button>
        <button class="btn sm danger" data-del-product="${p.id}">Xóa</button>
      </td>
    </tr>`).join('');
  $('#productRows').innerHTML = rows || '<tr><td colspan="6" class="empty">Chưa có sản phẩm</td></tr>';
}

let searchTimer;
$('#productSearch').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(run(loadProducts), 300);
});

let editingProductId = null;
function openProductDialog(p) {
  editingProductId = p?.id ?? null;
  $('#productDialogTitle').textContent = p ? `Sửa sản phẩm #${p.id}` : 'Thêm sản phẩm';
  const f = $('#productForm');
  f.reset();
  if (p) for (const k of ['name', 'description', 'price', 'quantity']) f.elements[k].value = p[k] ?? '';
  $('#productDialog').showModal();
}
$('#addProductBtn').addEventListener('click', () => openProductDialog());

$('#productForm').addEventListener('submit', run(async (e) => {
  if (e.submitter?.value !== 'save') return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const body = { ...f, price: Number(f.price), quantity: Number(f.quantity) };
  if (editingProductId) {
    await api(cfg.productUrl, `/products/${editingProductId}`, { method: 'PUT', body });
    toast('Đã cập nhật sản phẩm', 'success');
  } else {
    await api(cfg.productUrl, '/products', { method: 'POST', body });
    toast('Đã thêm sản phẩm', 'success');
  }
  $('#productDialog').close();
  await loadProducts();
}));

$('#productRows').addEventListener('click', run(async (e) => {
  const editId = e.target.dataset.editProduct;
  const delId = e.target.dataset.delProduct;
  if (editId) openProductDialog(state.products.find((p) => p.id == editId));
  if (delId) {
    const p = state.products.find((x) => x.id == delId);
    if (!confirm(`Xóa sản phẩm "${p.name}"?`)) return;
    await api(cfg.productUrl, `/products/${delId}`, { method: 'DELETE' });
    toast('Đã xóa sản phẩm', 'success');
    await loadProducts();
  }
}));

// =====================================================================
// TH4 - Tạo đơn hàng
// =====================================================================
function renderPickList() {
  const rows = state.products.map((p) => `
    <tr>
      <td>${esc(p.name)}</td>
      <td class="num">${money(p.price)}</td>
      <td class="num ${p.quantity <= 5 ? 'low' : ''}">${p.quantity}</td>
      <td class="num"><input type="number" min="1" value="1" data-pick-qty="${p.id}"></td>
      <td class="actions-cell"><button class="btn sm" data-pick="${p.id}" ${p.quantity < 1 ? 'disabled' : ''}>Thêm</button></td>
    </tr>`).join('');
  $('#pickRows').innerHTML = rows || '<tr><td colspan="5" class="empty">Chưa có sản phẩm</td></tr>';
}

function renderCart() {
  let total = 0;
  const rows = [...state.cart].map(([id, qty]) => {
    const p = state.products.find((x) => x.id === id);
    if (!p) return '';
    const line = p.price * qty;
    total += line;
    return `
      <tr>
        <td>${esc(p.name)}</td>
        <td class="num"><input type="number" min="1" value="${qty}" data-cart-qty="${id}"></td>
        <td class="num">${money(line)}</td>
        <td class="actions-cell"><button type="button" class="btn sm danger" data-cart-del="${id}">✕</button></td>
      </tr>`;
  }).join('');
  $('#cartRows').innerHTML = rows || '<tr><td colspan="4" class="empty">Chưa chọn sản phẩm nào</td></tr>';
  $('#cartTotal').textContent = money(total);
}

$('#pickRows').addEventListener('click', (e) => {
  const id = Number(e.target.dataset.pick);
  if (!id) return;
  const qty = Math.max(1, Number($(`[data-pick-qty="${id}"]`).value) || 1);
  state.cart.set(id, (state.cart.get(id) || 0) + qty);
  renderCart();
});
$('#cartRows').addEventListener('change', (e) => {
  const id = Number(e.target.dataset.cartQty);
  if (id) { state.cart.set(id, Math.max(1, Number(e.target.value) || 1)); renderCart(); }
});
$('#cartRows').addEventListener('click', (e) => {
  const id = Number(e.target.dataset.cartDel);
  if (id) { state.cart.delete(id); renderCart(); }
});

$('#orderForm').addEventListener('submit', run(async (e) => {
  e.preventDefault();
  if (!state.cart.size) throw new Error('Hãy chọn ít nhất một sản phẩm');
  const f = Object.fromEntries(new FormData(e.target));
  const items = [...state.cart].map(([product_id, quantity]) => ({ product_id, quantity }));
  const data = await api(cfg.orderUrl, '/orders', { method: 'POST', body: { ...f, items } });
  toast(`Đã tạo đơn hàng #${data.data.id}`, 'success');
  state.cart.clear();
  e.target.reset();
  switchTab('orders');
  openOrder(data.data.id);
}));

// =====================================================================
// TH4 - Danh sách & chi tiết đơn hàng
// =====================================================================
async function loadOrders() {
  const s = $('#statusFilter').value;
  const data = await api(cfg.orderUrl, '/orders' + (s ? `?status=${s}` : ''));
  const rows = data.data.map((o) => `
    <tr>
      <td>#${o.id}</td>
      <td>${esc(o.customer_name)}</td>
      <td>${esc(o.customer_email)}</td>
      <td class="num">${o.items.length}</td>
      <td class="num"><b>${money(o.total_amount)}</b></td>
      <td>${badge(o.status)}</td>
      <td>${date(o.created_at || o.createdAt)}</td>
      <td class="actions-cell">
        <button class="btn sm" data-open-order="${o.id}">Chi tiết</button>
        <button class="btn sm danger" data-del-order="${o.id}">Xóa</button>
      </td>
    </tr>`).join('');
  $('#orderRows').innerHTML = rows || '<tr><td colspan="8" class="empty">Chưa có đơn hàng</td></tr>';
}
$('#statusFilter').addEventListener('change', run(loadOrders));
$('#reloadOrdersBtn').addEventListener('click', run(loadOrders));

$('#orderRows').addEventListener('click', run(async (e) => {
  const openId = e.target.dataset.openOrder;
  const delId = e.target.dataset.delOrder;
  if (openId) await openOrder(openId);
  if (delId) {
    if (!confirm(`Xóa đơn hàng #${delId}? Đơn đang chờ xử lý sẽ được hoàn lại tồn kho.`)) return;
    await api(cfg.orderUrl, `/orders/${delId}`, { method: 'DELETE' });
    toast('Đã xóa đơn hàng', 'success');
    await loadOrders();
  }
}));

async function openOrder(id) {
  const { data: o } = await api(cfg.orderUrl, `/orders/${id}`);
  state.order = o;
  const editable = o.status === 'pending';

  $('#orderTitle').innerHTML = `Đơn hàng #${o.id} ${badge(o.status)}`;
  $('#orderInfo').innerHTML = `
    <div><span>Khách hàng</span>${esc(o.customer_name)}</div>
    <div><span>Email</span>${esc(o.customer_email)}</div>
    <div><span>Tổng tiền</span><b>${money(o.total_amount)}</b></div>
    <div><span>Ngày tạo</span>${date(o.created_at || o.createdAt)}</div>
    <div><span>Cập nhật</span>${date(o.updated_at || o.updatedAt)}</div>`;

  $('#itemRows').innerHTML = o.items.map((it) => `
    <tr>
      <td>${it.product_id}</td>
      <td>${esc(it.product_name)}</td>
      <td class="num">${money(it.unit_price)}</td>
      <td class="num">${editable ? `<input type="number" min="1" value="${it.quantity}" data-item-qty="${it.id}">` : it.quantity}</td>
      <td class="num">${money(it.total_price)}</td>
      <td class="actions-cell">${editable ? `<button class="btn sm danger" data-item-del="${it.id}">Xóa</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">Đơn hàng chưa có mặt hàng</td></tr>';

  $('#addItemForm').hidden = !editable;
  if (editable) {
    state.products = await api(cfg.productUrl, '/products'); // luôn lấy tồn kho mới nhất
    $('#addItemProduct').innerHTML = state.products
      .map((p) => `<option value="${p.id}">${esc(p.name)} — ${money(p.price)} (còn ${p.quantity})</option>`).join('');
  }

  $('#orderActions').innerHTML = editable
    ? `<button class="btn danger" data-status="cancelled">Hủy đơn</button>
       <button class="btn success" data-status="completed">Hoàn thành</button>`
    : '';

  if (!$('#orderDialog').open) $('#orderDialog').showModal();
}

async function refreshOrder() {
  await openOrder(state.order.id);
  await loadOrders();
}

$('#closeOrderBtn').addEventListener('click', () => $('#orderDialog').close());

$('#itemRows').addEventListener('change', run(async (e) => {
  const id = e.target.dataset.itemQty;
  if (!id) return;
  try {
    await api(cfg.orderUrl, `/order_items/${id}`, { method: 'PUT', body: { quantity: Number(e.target.value) } });
    toast('Đã cập nhật số lượng', 'success');
  } finally {
    await refreshOrder();
  }
}));

$('#itemRows').addEventListener('click', run(async (e) => {
  const id = e.target.dataset.itemDel;
  if (!id || !confirm('Xóa mặt hàng này khỏi đơn?')) return;
  await api(cfg.orderUrl, `/order_items/${id}`, { method: 'DELETE' });
  toast('Đã xóa mặt hàng', 'success');
  await refreshOrder();
}));

$('#addItemForm').addEventListener('submit', run(async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  await api(cfg.orderUrl, '/order_items', {
    method: 'POST',
    body: { order_id: state.order.id, product_id: Number(f.product_id), quantity: Number(f.quantity) },
  });
  toast('Đã thêm mặt hàng', 'success');
  e.target.elements.quantity.value = 1;
  await refreshOrder();
}));

$('#orderActions').addEventListener('click', run(async (e) => {
  const status = e.target.dataset.status;
  if (!status) return;
  if (!confirm(status === 'cancelled' ? 'Hủy đơn hàng này? Tồn kho sẽ được hoàn lại.' : 'Xác nhận hoàn thành đơn hàng?')) return;
  await api(cfg.orderUrl, `/orders/${state.order.id}`, { method: 'PUT', body: { status } });
  toast(status === 'cancelled' ? 'Đã hủy đơn hàng' : 'Đơn hàng đã hoàn thành', 'success');
  await refreshOrder();
}));

// ---------- Khởi động ----------
if (!cfg) {
  document.body.innerHTML = '<p style="padding:24px">Không tải được /config.js. Hãy mở trang qua <b>npm start</b> (http://localhost:3000).</p>';
} else {
  pingServices();
  setInterval(pingServices, 10000);
  showView();
}
