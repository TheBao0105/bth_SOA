/**
 * Khởi động project.
 *   npm start                -> backend (3 service) + frontend
 *   npm run start:backend    -> chỉ 3 service backend
 *   npm run start:frontend   -> chỉ giao diện web (http://localhost:3000)
 *   npm run start:auth       -> chỉ Auth Service    (TH2)
 *   npm run start:product    -> chỉ Product Service (TH3)
 *   npm run start:order      -> chỉ Order Service   (TH4)
 */
const apps = {
  auth: () => require('./backend/services/auth')(),
  product: () => require('./backend/services/product')(),
  order: () => require('./backend/services/order')(),
  frontend: () => require('./frontend/server')(),
};
const groups = {
  backend: ['auth', 'product', 'order'],
  all: ['auth', 'product', 'order', 'frontend'],
};

const args = process.argv.slice(2);
const names = (args.length ? args : ['all']).flatMap((a) => groups[a] || [a]);

(async () => {
  for (const name of names) {
    if (!apps[name]) {
      console.error(`Không có "${name}". Chọn: ${[...Object.keys(groups), ...Object.keys(apps)].join(', ')}`);
      process.exit(1);
    }
    try {
      await apps[name]();
    } catch (err) {
      console.error(`[${name}] Không khởi động được: ${err.message}`);
      if (err.code === 'EADDRINUSE') console.error('  -> Cổng đang bị chiếm, đổi cổng trong .env hoặc tắt chương trình đang dùng cổng đó.');
      if (/ECONNREFUSED|Access denied/.test(err.message)) console.error('  -> Kiểm tra MySQL (XAMPP) đã bật và DB_USER/DB_PASSWORD trong .env.');
      process.exit(1);
    }
  }
})();
