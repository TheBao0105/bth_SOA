const { DataTypes } = require('sequelize');
const { createDatabase } = require('../../shared/database');
const config = require('../../config');

const sequelize = createDatabase(config.auth.dbName);

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING(255), allowNull: false }, // bcrypt hash
    role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'user', validate: { isIn: [['user', 'admin']] } },
  },
  {
    tableName: 'users',
    underscored: true,
    defaultScope: { attributes: { exclude: ['password'] } }, // không bao giờ trả password ra ngoài
    scopes: { withPassword: { attributes: { include: ['password'] } } },
  }
);

module.exports = { sequelize, User };
