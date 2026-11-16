const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { db } = require('../config');

/** Mỗi service gọi hàm này với tên CSDL riêng => 3 kết nối, 3 database độc lập */
function createDatabase(dbName) {
  if (db.dialect === 'sqlite') {
    fs.mkdirSync(db.sqliteDir, { recursive: true });
    return new Sequelize({
      dialect: 'sqlite',
      storage: path.join(db.sqliteDir, `${dbName}.sqlite`),
      logging: false,
    });
  }
  return new Sequelize(dbName, db.user, db.password, {
    host: db.host,
    port: db.port,
    dialect: 'mysql',
    logging: false,
  });
}

/** Tạo database MySQL nếu chưa có (để không phải import tay) */
async function ensureMysqlDatabase(dbName) {
  if (db.dialect !== 'mysql') return;
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();
}

module.exports = { createDatabase, ensureMysqlDatabase };
