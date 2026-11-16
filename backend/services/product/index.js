// TH3 - Product Service
const startService = require('../../shared/startService');
const authenticate = require('../../shared/authenticate');
const config = require('../../config');
const { sequelize, Product, SAMPLE_PRODUCTS } = require('./models');
const c = require('./controller');

module.exports = () =>
  startService({
    name: 'product-service',
    port: config.product.port,
    dbName: config.product.dbName,
    sequelize,
    async seed() {
      if ((await Product.count()) === 0) await Product.bulkCreate(SAMPLE_PRODUCTS);
    },
    mount(app) {
      app.use('/products', authenticate);
      app.get('/products', c.getAll);
      app.get('/products/:id', c.getById);
      app.post('/products', c.create);
      app.put('/products/:id', c.update);
      app.delete('/products/:id', c.remove);
    },
  });
