const express = require('express');
const cors = require('cors');
const { ensureMysqlDatabase } = require('./database');

/**
 * Khởi động một service độc lập: cổng riêng + CSDL riêng.
 * @param {object} o { name, port, dbName, sequelize, mount(app), seed?() }
 */
async function startService({ name, port, dbName, sequelize, mount, seed }) {
  await ensureMysqlDatabase(dbName);
  await sequelize.authenticate();
  await sequelize.sync();
  if (seed) await seed();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/', (req, res) => res.json({ service: name, status: 'ok' }));
  mount(app);
  app.use((req, res) => res.status(404).json({ message: 'Endpoint không tồn tại' }));

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`[${name}] http://localhost:${port}  (database: ${dbName})`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

module.exports = startService;
