// TH2 - Auth Service
const startService = require('../../shared/startService');
const config = require('../../config');
const { sequelize } = require('./models');
const c = require('./controller');

module.exports = () =>
  startService({
    name: 'auth-service',
    port: config.auth.port,
    dbName: config.auth.dbName,
    sequelize,
    mount(app) {
      app.post('/auth/register', c.register);
      app.post('/auth/login', c.login);
      app.get('/auth/verify', c.requireToken, c.verify);
      app.get('/auth/me', c.requireToken, c.me);
    },
  });
