/**
 * Client gọi sang Product Service (TH3) qua REST.
 * Order Service không truy cập trực tiếp DB sản phẩm.
 */
class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const config = require('../../config');
const baseUrl = () => config.urls.productService;

// Chấp nhận các dạng response phổ biến: {...}, {data: {...}}, {product: {...}}
function normalize(body) {
  const p = body?.data ?? body?.product ?? body;
  return {
    id: Number(p.id),
    name: p.name ?? p.product_name,
    price: Number(p.price ?? p.unit_price),
    quantity: Number(p.quantity ?? p.stock ?? p.stock_quantity ?? 0),
    raw: p,
  };
}

async function getProduct(productId, authHeader) {
  let res;
  try {
    res = await fetch(`${baseUrl()}/products/${productId}`, {
      headers: authHeader ? { Authorization: authHeader } : {},
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    throw new ServiceError(503, `Không kết nối được Product Service: ${err.message}`);
  }
  if (res.status === 404) throw new ServiceError(404, `Sản phẩm id=${productId} không tồn tại`);
  if (!res.ok) throw new ServiceError(502, `Product Service trả lỗi ${res.status}`);
  return normalize(await res.json());
}

/** Kiểm tra tồn kho, trả về thông tin sản phẩm nếu đủ hàng */
async function checkStock(productId, quantity, authHeader) {
  const product = await getProduct(productId, authHeader);
  if (product.quantity < quantity) {
    throw new ServiceError(
      400,
      `Sản phẩm "${product.name}" (id=${productId}) không đủ hàng: còn ${product.quantity}, yêu cầu ${quantity}`
    );
  }
  return product;
}

/** Cộng/trừ tồn kho trên Product Service (delta âm = trừ kho) */
async function adjustStock(productId, delta, authHeader) {
  if (!config.order.updateProductStock || delta === 0) return;
  const product = await getProduct(productId, authHeader);
  const res = await fetch(`${baseUrl()}/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
    body: JSON.stringify({ quantity: product.quantity + delta }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new ServiceError(502, `Không cập nhật được tồn kho sản phẩm id=${productId}`);
}

module.exports = { getProduct, checkStock, adjustStock, ServiceError };
