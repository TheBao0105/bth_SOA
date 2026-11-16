const path = require('path');
// .env nằm ở thư mục gốc project (dùng chung cho backend và frontend)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const env = process.env;

const authPort = Number(env.AUTH_PORT) || 5000;
const productPort = Number(env.PRODUCT_PORT) || 5001;
const orderPort = Number(env.ORDER_PORT) || 5002;

module.exports = {
  db: {
    dialect: env.DB_DIALECT || 'mysql',
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    sqliteDir: env.SQLITE_DIR || path.join(__dirname, 'data'),
  },

  auth: {
    port: authPort,
    dbName: env.AUTH_DB_NAME || 'auth_service_db',
    jwtSecret: env.JWT_SECRET || 'doi-chuoi-bi-mat-nay',
    jwtExpiresIn: env.JWT_EXPIRES_IN || '1d',
  },

  product: {
    port: productPort,
    dbName: env.PRODUCT_DB_NAME || 'product_service_db',
  },

  order: {
    port: orderPort,
    dbName: env.ORDER_DB_NAME || 'order_service_db',
    updateProductStock: env.UPDATE_PRODUCT_STOCK !== 'false',
  },

  // Các service gọi nhau qua HTTP (đúng nguyên tắc SOA)
  urls: {
    authVerify: env.AUTH_VERIFY_URL || `http://localhost:${authPort}/auth/verify`,
    productService: (env.PRODUCT_SERVICE_URL || `http://localhost:${productPort}`).replace(/\/$/, ''),
  },
  authEnabled: env.AUTH_ENABLED !== 'false',
};
