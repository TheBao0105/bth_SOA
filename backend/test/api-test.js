/**
 * Test toàn bộ API của 3 service. Bật `npm start` trước, rồi chạy `npm test`.
 * Test sẽ tạo user + sản phẩm + đơn hàng mới, và tự dọn sản phẩm/đơn hàng đã tạo.
 */
const config = require('../config');
const A = `http://localhost:${config.auth.port}`;
const P = `http://localhost:${config.product.port}`;
const O = `http://localhost:${config.order.port}`;

let failed = 0, token;
function check(name, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) { failed++; if (extra) console.log('       ', JSON.stringify(extra)); }
}
async function call(base, method, path, body, tk = token) {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}
const stock = async (id) => (await call(P, 'GET', `/products/${id}`)).body.quantity;

(async () => {
  // ===== TH2: Auth =====
  console.log('--- TH2 Auth ---');
  const u = `sv${Date.now()}`;
  let r = await call(A, 'POST', '/auth/register', { username: u, email: `${u}@example.com`, password: '123456' });
  check('Đăng ký', r.status === 201 && !r.body.user.password, r);
  r = await call(A, 'POST', '/auth/register', { username: u, email: `${u}@example.com`, password: '123456' });
  check('Đăng ký trùng -> 409', r.status === 409, r);
  r = await call(A, 'POST', '/auth/login', { username: u, password: 'sai-mat-khau' });
  check('Đăng nhập sai -> 401', r.status === 401, r);
  r = await call(A, 'POST', '/auth/login', { username: u, password: '123456' });
  check('Đăng nhập -> token', r.status === 200 && !!r.body.token, r);
  token = r.body.token;
  r = await call(A, 'GET', '/auth/verify');
  check('Verify token', r.status === 200 && r.body.valid, r);
  r = await call(A, 'GET', '/auth/verify', null, 'token-gia');
  check('Verify token giả -> 401', r.status === 401, r);

  // ===== TH3: Product =====
  console.log('--- TH3 Product ---');
  r = await call(P, 'GET', '/products', null, null);
  check('Không token -> 401', r.status === 401, r);
  r = await call(P, 'GET', '/products');
  check('GET /products', r.status === 200 && Array.isArray(r.body), r);
  r = await call(P, 'POST', '/products', { name: 'SP test A', price: 100000.5, quantity: 5 });
  check('POST /products', r.status === 201 && r.body.price === 100000.5, r);
  const pa = r.body.id;
  r = await call(P, 'POST', '/products', { name: 'SP test B', price: 200000, quantity: 3 });
  const pb = r.body.id;
  r = await call(P, 'POST', '/products', { name: 'X', price: -1 });
  check('Giá âm -> 400', r.status === 400, r);
  r = await call(P, 'PUT', `/products/${pa}`, { quantity: 10 });
  check('PUT /products/:id', r.status === 200 && r.body.quantity === 10 && r.body.name === 'SP test A', r);
  r = await call(P, 'GET', `/products/${pa}`);
  check('GET /products/:id', r.status === 200 && r.body.id === pa, r);

  // ===== TH4: Order =====
  console.log('--- TH4 Order ---');
  r = await call(O, 'GET', '/orders', null, null);
  check('Không token -> 401', r.status === 401, r);
  r = await call(O, 'POST', '/orders', {
    customer_name: 'Nguyễn Văn A', customer_email: 'a@example.com',
    items: [{ product_id: pa, quantity: 2 }, { product_id: pb, quantity: 1 }],
  });
  check('POST /orders', r.status === 201, r);
  const order = r.body.data;
  check('total_amount = 2*100000.5 + 200000', order?.total_amount === 400001, order);
  check('Trừ kho (A: 10->8, B: 3->2)', (await stock(pa)) === 8 && (await stock(pb)) === 2);
  r = await call(O, 'POST', '/orders', { customer_name: 'B', customer_email: 'b@example.com', items: [{ product_id: pb, quantity: 99 }] });
  check('Vượt tồn kho -> 400', r.status === 400, r);
  r = await call(O, 'POST', '/orders', { customer_name: 'B', customer_email: 'b@example.com', items: [{ product_id: 999999, quantity: 1 }] });
  check('Sản phẩm không tồn tại -> 404', r.status === 404, r);
  r = await call(O, 'POST', '/orders', { customer_name: 'B', customer_email: 'khong-phai-email', items: [{ product_id: pa, quantity: 1 }] });
  check('Email sai -> 400', r.status === 400, r);
  r = await call(O, 'GET', '/orders');
  check('GET /orders', r.status === 200 && r.body.count >= 1, r);
  r = await call(O, 'GET', `/orders/${order.id}`);
  check('GET /orders/:id kèm items', r.status === 200 && r.body.data.items.length === 2, r);
  r = await call(O, 'GET', '/orders/999999');
  check('Đơn không tồn tại -> 404', r.status === 404, r);

  r = await call(O, 'POST', '/order_items', { order_id: order.id, product_id: pb, quantity: 1 });
  check('POST /order_items', r.status === 201 && r.body.data.total_price === 200000, r);
  const item = r.body.data;
  r = await call(O, 'GET', `/orders/${order.id}`);
  check('total_amount tăng sau khi thêm item', r.body.data.total_amount === 600001, r.body.data);
  r = await call(O, 'PUT', `/order_items/${item.id}`, { quantity: 2 });
  check('PUT /order_items/:id', r.status === 200 && r.body.data.total_price === 400000, r);
  r = await call(O, 'PUT', `/order_items/${item.id}`, { quantity: 50 });
  check('PUT item vượt tồn kho -> 400', r.status === 400, r);
  r = await call(O, 'GET', `/order_items?order_id=${order.id}`);
  check('GET /order_items?order_id=', r.status === 200 && r.body.count === 3, r);
  r = await call(O, 'GET', `/order_items/${item.id}`);
  check('GET /order_items/:id', r.status === 200 && r.body.data.quantity === 2, r);
  r = await call(O, 'DELETE', `/order_items/${item.id}`);
  check('DELETE /order_items/:id', r.status === 200, r);
  r = await call(O, 'GET', `/orders/${order.id}`);
  check('total_amount giảm sau khi xóa item', r.body.data.total_amount === 400001, r.body.data);

  r = await call(O, 'PUT', `/orders/${order.id}`, { status: 'abc' });
  check('Status sai -> 400', r.status === 400, r);
  r = await call(O, 'PUT', `/orders/${order.id}`, { status: 'cancelled' });
  check('Hủy đơn', r.status === 200 && r.body.data.status === 'cancelled', r);
  check('Hoàn kho khi hủy (A về 10, B về 3)', (await stock(pa)) === 10 && (await stock(pb)) === 3);
  r = await call(O, 'PUT', `/orders/${order.id}`, { status: 'completed' });
  check('Không đổi trạng thái đơn đã hủy -> 400', r.status === 400, r);
  r = await call(O, 'POST', '/order_items', { order_id: order.id, product_id: pa, quantity: 1 });
  check('Không thêm item vào đơn đã hủy -> 400', r.status === 400, r);
  r = await call(O, 'DELETE', `/orders/${order.id}`);
  check('DELETE /orders/:id', r.status === 200, r);
  r = await call(O, 'GET', `/order_items?order_id=${order.id}`);
  check('Xóa đơn xóa luôn items', r.body.count === 0, r);

  // dọn sản phẩm test
  await call(P, 'DELETE', `/products/${pb}`);
  r = await call(P, 'DELETE', `/products/${pa}`);
  check('DELETE /products/:id', r.status === 200, r);
  r = await call(P, 'GET', `/products/${pa}`);
  check('Sản phẩm đã xóa -> 404', r.status === 404, r);

  console.log(failed ? `\n${failed} test FAIL` : '\nTất cả test PASS');
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('Không gọi được service. Đã chạy `npm start` chưa?', err.message);
  process.exit(1);
});
