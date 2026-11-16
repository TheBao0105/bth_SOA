const { DataTypes } = require('sequelize');
const { createDatabase } = require('../../shared/database');
const config = require('../../config');

const sequelize = createDatabase(config.product.dbName);

const Product = sequelize.define(
  'Product',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
    description: { type: DataTypes.TEXT },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 },
      get() {
        const v = this.getDataValue('price');
        return v == null ? v : Number(v);
      },
    },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0, isInt: true } },
  },
  { tableName: 'products', underscored: true }
);

const SAMPLE_PRODUCTS = [
  { name: 'Laptop Dell XPS 13', description: 'Laptop 13 inch, Core i7, 16GB RAM', price: 25000000, quantity: 10 },
  { name: 'Chuột Logitech MX Master 3', description: 'Chuột không dây', price: 1500000, quantity: 50 },
  { name: 'Bàn phím cơ Keychron K2', description: 'Bàn phím cơ không dây', price: 2000000, quantity: 20 },
];

module.exports = { sequelize, Product, SAMPLE_PRODUCTS };
