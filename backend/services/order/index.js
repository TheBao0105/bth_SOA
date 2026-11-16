// TH4 - Order Service
const startService = require('../../shared/startService');
const authenticate = require('../../shared/authenticate');
const config = require('../../config');
const { sequelize } = require('./models');
const orders = require('./orderController');
const items = require('./orderItemController');

module.exports = () =>
  startService({
    name: 'order-service',
    port: config.order.port,
    dbName: config.order.dbName,
    sequelize,
    mount(app) {
      app.use(['/orders', '/order_items'], authenticate);

      app.get('/orders', orders.getAll);
      app.get('/orders/:id', orders.getById);
      app.post('/orders', orders.create);
      app.put('/orders/:id', orders.update);
      app.delete('/orders/:id', orders.remove);

      app.get('/order_items', items.getAll);
      app.get('/order_items/:id', items.getById);
      app.post('/order_items', items.create);
      app.put('/order_items/:id', items.update);
      app.delete('/order_items/:id', items.remove);
    },
  });
