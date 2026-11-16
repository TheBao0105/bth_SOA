/**
 * FRONTEND - phục vụ giao diện web (thư mục public/) ở cổng riêng.
 * Không truy cập CSDL, chỉ gọi 3 service backend qua REST API từ trình duyệt.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');

const env = process.env;
const WEB_PORT = Number(env.WEB_PORT) || 3000;
const ports = {
  auth: Number(env.AUTH_PORT) || 5000,
  product: Number(env.PRODUCT_PORT) || 5001,
  order: Number(env.ORDER_PORT) || 5002,
};

function start() {
  return new Promise((resolve, reject) => {
    const app = express();

    // Trình duyệt cần biết địa chỉ của 3 service backend
    app.get('/config.js', (req, res) => {
      const host = req.hostname || 'localhost';
      res.type('application/javascript').send(
        `window.SOA_CONFIG = ${JSON.stringify({
          authUrl: `http://${host}:${ports.auth}`,
          productUrl: `http://${host}:${ports.product}`,
          orderUrl: `http://${host}:${ports.order}`,
        })};`
      );
    });

    app.use(express.static(path.join(__dirname, 'public')));

    const server = app.listen(WEB_PORT, () => {
      console.log(`[frontend] Giao diện: http://localhost:${WEB_PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

module.exports = start;

// Cho phép chạy trực tiếp: node frontend/server.js
if (require.main === module) {
  start().catch((err) => {
    console.error('[frontend] Không khởi động được:', err.message);
    process.exit(1);
  });
}
